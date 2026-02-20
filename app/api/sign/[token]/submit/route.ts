import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { verifyToken, signMagicToken } from '@/lib/jwt'
import { burnSignaturesIntoPDF } from '@/lib/pdf-burn'
import { sendYourTurnNotification, sendProgressUpdate, sendCompletionEmail, sendDeclinedEmail } from '@/lib/resend'
import { logEvent } from '@/lib/audit'

interface SignatureSubmission {
    placeholderId: string
    imageBase64: string
}

async function hashTokenStr(token: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params
        const admin = createSupabaseAdminClient()

        // ── Verify magic-link JWT (identifies the document/signer) ────────────────
        let magicPayload
        try {
            magicPayload = await verifyToken(token)
        } catch {
            return NextResponse.json({ error: 'expired' }, { status: 401 })
        }
        if (magicPayload.type !== 'magic_link') {
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }

        // ── Verify session JWT from Authorization header ───────────────────────────
        const authHeader = req.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing session token' }, { status: 401 })
        }
        const sessionToken = authHeader.slice(7)
        let sessionPayload
        try {
            sessionPayload = await verifyToken(sessionToken)
        } catch {
            return NextResponse.json({ error: 'Session expired. Please verify OTP again.' }, { status: 401 })
        }
        if (
            sessionPayload.type !== 'signing_session' ||
            sessionPayload.signerId !== magicPayload.signerId
        ) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
        }

        // ── Parse body ────────────────────────────────────────────────────────────
        const body = await req.json() as {
            action: 'sign' | 'decline'
            signatures?: SignatureSubmission[]
        }

        if (!['sign', 'decline'].includes(body.action)) {
            return NextResponse.json({ error: 'action must be "sign" or "decline"' }, { status: 400 })
        }

        // ── Load signer ───────────────────────────────────────────────────────────
        const { data: signer, error: signerErr } = await admin
            .from('signers')
            .select('id, email, status, document_id')
            .eq('id', magicPayload.signerId)
            .single()

        if (signerErr || !signer || signer.status !== 'awaiting_turn') {
            return NextResponse.json({ error: 'Invalid or already-processed signer' }, { status: 403 })
        }

        // ── Load document ─────────────────────────────────────────────────────────
        const { data: doc, error: docErr } = await admin
            .from('documents')
            .select('id, file_path, file_name, sender_id')
            .eq('id', signer.document_id)
            .single()

        if (docErr || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        // ── Get sender email ──────────────────────────────────────────────────────
        const { data: senderData } = await admin.auth.admin.getUserById(doc.sender_id)
        const senderEmail = senderData?.user?.email ?? 'sender'

        // ════════════════════════════════════════════════════════════════════════
        // DECLINE PATH
        // ════════════════════════════════════════════════════════════════════════
        if (body.action === 'decline') {
            await admin.from('signers').update({ status: 'declined' }).eq('id', signer.id)
            await admin.from('documents').update({ status: 'cancelled' }).eq('id', doc.id)

            await logEvent({
                documentId: doc.id,
                signerId: signer.id,
                actorEmail: signer.email,
                event: 'signer_declined',
            })

            await sendDeclinedEmail({
                to: senderEmail,
                signerEmail: signer.email,
                documentName: doc.file_name,
                declinedAt: new Date().toISOString(),
            })

            return NextResponse.json({ success: true, action: 'declined' })
        }

        // ════════════════════════════════════════════════════════════════════════
        // SIGN PATH
        // ════════════════════════════════════════════════════════════════════════
        if (!Array.isArray(body.signatures) || body.signatures.length === 0) {
            return NextResponse.json({ error: 'signatures array is required for sign action' }, { status: 400 })
        }

        // ── Load this signer's placeholders ───────────────────────────────────────
        const { data: placeholders, error: phErr } = await admin
            .from('placeholders')
            .select('id, page_number, x_percent, y_percent, width_percent, height_percent, assigned_signer_email')
            .eq('document_id', doc.id)
            .eq('assigned_signer_email', signer.email)

        if (phErr || !placeholders) {
            return NextResponse.json({ error: 'Failed to load placeholders' }, { status: 500 })
        }

        // ── Validate all submitted placeholders belong to this signer ────────────
        const ownedIds = new Set(placeholders.map(p => p.id))
        for (const sig of body.signatures) {
            if (!ownedIds.has(sig.placeholderId)) {
                return NextResponse.json({ error: `Placeholder ${sig.placeholderId} does not belong to you` }, { status: 403 })
            }
        }

        // ── Validate ALL placeholders are signed (no partial submissions) ─────────
        if (body.signatures.length !== placeholders.length) {
            return NextResponse.json({
                error: `You must sign all ${placeholders.length} field(s). You signed ${body.signatures.length}.`,
            }, { status: 400 })
        }

        // ── Insert signature rows ─────────────────────────────────────────────────
        const signatureRows = body.signatures.map(sig => ({
            signer_id: signer.id,
            placeholder_id: sig.placeholderId,
            image_base64: sig.imageBase64,
        }))
        const { error: sigInsertErr } = await admin.from('signatures').insert(signatureRows)
        if (sigInsertErr) {
            return NextResponse.json({ error: 'Failed to save signatures' }, { status: 500 })
        }

        await logEvent({
            documentId: doc.id,
            signerId: signer.id,
            actorEmail: signer.email,
            event: 'signature_submitted',
            metadata: { count: signatureRows.length },
        })

        // ── Download LATEST PDF bytes from storage (always fresh) ────────────────
        const { data: fileData, error: downloadErr } = await admin.storage
            .from('documents')
            .download(doc.file_path)

        if (downloadErr || !fileData) {
            return NextResponse.json({ error: 'Failed to download PDF for burning' }, { status: 500 })
        }

        const pdfBytes = new Uint8Array(await fileData.arrayBuffer())

        // ── Build inputs for PDF burn (match submission to placeholder metadata) ──
        const burnInputs = body.signatures.map(sig => {
            const ph = placeholders.find(p => p.id === sig.placeholderId)!
            return {
                placeholder: {
                    page_number: ph.page_number,
                    x_percent: ph.x_percent,
                    y_percent: ph.y_percent,
                    width_percent: ph.width_percent,
                    height_percent: ph.height_percent,
                },
                imageBase64: sig.imageBase64,
            }
        })

        // ── Burn signatures into PDF (Y-axis flip applied inside) ─────────────────
        const burnedBytes = await burnSignaturesIntoPDF(pdfBytes, burnInputs)

        // ── Upload burned PDF back to storage (overwrite same path) ──────────────
        const { error: uploadErr } = await admin.storage
            .from('documents')
            .upload(doc.file_path, Buffer.from(burnedBytes), {
                contentType: 'application/pdf',
                upsert: true,
            })

        if (uploadErr) {
            return NextResponse.json({ error: 'Failed to upload signed PDF' }, { status: 500 })
        }

        await logEvent({
            documentId: doc.id,
            signerId: signer.id,
            actorEmail: signer.email,
            event: 'pdf_burned',
        })

        // ── Mark signer as signed ─────────────────────────────────────────────────
        await admin
            .from('signers')
            .update({ status: 'signed', signed_at: new Date().toISOString() })
            .eq('id', signer.id)

        // ── Update document to in_progress if it was still 'sent' ────────────────
        await admin
            .from('documents')
            .update({ status: 'in_progress' })
            .eq('id', doc.id)
            .eq('status', 'sent')

        // ── Find next pending signer ──────────────────────────────────────────────
        const { data: nextSigners } = await admin
            .from('signers')
            .select('id, email, priority')
            .eq('document_id', doc.id)
            .eq('status', 'pending')
            .order('priority', { ascending: true })
            .limit(1)

        if (nextSigners && nextSigners.length > 0) {
            // ── Advance chain to next signer ──────────────────────────────────────
            const next = nextSigners[0]
            const nextToken = await signMagicToken({ signerId: next.id, documentId: doc.id })
            const nextTokenHash = await hashTokenStr(nextToken)

            // Commit DB state FIRST — chain is advanced regardless of email outcome
            await admin
                .from('signers')
                .update({ status: 'awaiting_turn', token_hash: nextTokenHash })
                .eq('id', next.id)

            await logEvent({
                documentId: doc.id,
                signerId: next.id,
                actorEmail: senderEmail,
                event: 'next_signer_notified',
                metadata: { to: next.email },
            })

            // ── Fetch ALL signers for queue context ─────────────────────────────────
            const { data: allCurrentSigners } = await admin
                .from('signers')
                .select('id, email, priority, status')
                .eq('document_id', doc.id)
                .order('priority', { ascending: true })

            const totalSigners = allCurrentSigners?.length ?? 0
            const remainingCount = allCurrentSigners?.filter(s => s.status !== 'signed').length ?? 0

            // ── 1. Send "your turn" to next signer ─────────────────────────────────
            const nextSignLink = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${nextToken}`
            try {
                await sendYourTurnNotification({
                    to: next.email,
                    documentName: doc.file_name,
                    justSignedEmail: signer.email,
                    signLink: nextSignLink,
                    queuePosition: next.priority,
                    totalSigners,
                })
                await logEvent({
                    documentId: doc.id,
                    signerId: next.id,
                    actorEmail: senderEmail,
                    event: 'email_delivered',
                    metadata: { to: next.email },
                })
            } catch (emailErr) {
                await logEvent({
                    documentId: doc.id,
                    signerId: next.id,
                    actorEmail: senderEmail,
                    event: 'email_failed',
                    metadata: { to: next.email, error: emailErr instanceof Error ? emailErr.message : 'Unknown' },
                })
            }

            // ── 2. Send progress update to all other signers (not just-signed, not next) ──
            const observers = (allCurrentSigners ?? []).filter(
                s => s.email !== signer.email && s.email !== next.email
            )
            for (const obs of observers) {
                try {
                    await sendProgressUpdate({
                        to: obs.email,
                        documentName: doc.file_name,
                        justSignedEmail: signer.email,
                        nextSignerEmail: next.email,
                        remainingCount,
                    })
                    await logEvent({
                        documentId: doc.id,
                        signerId: obs.id,
                        actorEmail: senderEmail,
                        event: 'progress_notification_sent',
                        metadata: { to: obs.email },
                    })
                } catch (obsErr) {
                    console.error(`[submit] Progress update to ${obs.email} failed:`, obsErr)
                }
            }

            return NextResponse.json({ success: true, final: false })
        }

        // ── All signers done — mark document completed ────────────────────────────
        await admin.from('documents').update({ status: 'completed' }).eq('id', doc.id)

        // Collect all signer timestamps for the completion email
        const { data: allSigners } = await admin
            .from('signers')
            .select('email, signed_at')
            .eq('document_id', doc.id)
            .order('priority', { ascending: true })

        // Generate a signed download URL (1 hour)
        const { data: signedUrlData } = await admin.storage
            .from('documents')
            .createSignedUrl(doc.file_path, 3600)

        const downloadUrl = signedUrlData?.signedUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`

        const completionSigners = (allSigners ?? []).map(s => ({
            email: s.email,
            signedAt: s.signed_at ?? new Date().toISOString(),
        }))

        // Send completion email to the document sender
        await sendCompletionEmail({
            to: senderEmail,
            documentName: doc.file_name,
            signers: completionSigners,
            downloadUrl,
        })

        // Also send completion email to ALL signers (they are all participants)
        for (const s of (allSigners ?? [])) {
            try {
                await sendCompletionEmail({
                    to: s.email,
                    documentName: doc.file_name,
                    signers: completionSigners,
                    downloadUrl,
                })
            } catch (compErr) {
                console.error(`[submit] Completion email to ${s.email} failed:`, compErr)
            }
        }

        await logEvent({
            documentId: doc.id,
            signerId: signer.id,
            actorEmail: senderEmail,
            event: 'document_completed',
        })

        return NextResponse.json({ success: true, final: true })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
