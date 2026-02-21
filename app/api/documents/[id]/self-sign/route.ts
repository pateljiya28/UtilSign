import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { burnSignaturesIntoPDF } from '@/lib/pdf-burn'
import { logEvent } from '@/lib/audit'

interface SignatureSubmission {
    placeholderId: string
    imageBase64: string
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: documentId } = await params

        // ── Auth via Supabase session (no magic token / OTP needed) ───────────
        const supabase = await createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = createSupabaseAdminClient()

        // ── Verify document ownership & type ──────────────────────────────────
        const { data: doc, error: docErr } = await admin
            .from('documents')
            .select('id, file_path, file_name, sender_id, status, type')
            .eq('id', documentId)
            .eq('sender_id', user.id)
            .single()

        if (docErr || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }
        if (doc.type !== 'self_sign') {
            return NextResponse.json({ error: 'This document is not a self-sign document' }, { status: 400 })
        }
        // Removing the 'draft' check to allow retries if burning failed mid-way, 
        // as long as it hasn't successfully moved to 'completed'.
        if (doc.status === 'completed') {
            return NextResponse.json({ error: 'Document is already completed' }, { status: 409 })
        }

        // ── Parse body ────────────────────────────────────────────────────────
        const body = await req.json() as { signatures: SignatureSubmission[] }
        if (!Array.isArray(body.signatures) || body.signatures.length === 0) {
            return NextResponse.json({ error: 'signatures array is required' }, { status: 400 })
        }

        // ── Load placeholders ─────────────────────────────────────────────────
        const { data: placeholders, error: phErr } = await admin
            .from('placeholders')
            .select('id, page_number, x_percent, y_percent, width_percent, height_percent, assigned_signer_email')
            .eq('document_id', doc.id)
            .eq('assigned_signer_email', user.email!)

        if (phErr || !placeholders || placeholders.length === 0) {
            return NextResponse.json({ error: 'No placeholders found for self-sign' }, { status: 400 })
        }

        // ── Validate all submitted placeholders belong to this document ──────
        const ownedIds = new Set(placeholders.map(p => p.id))
        for (const sig of body.signatures) {
            if (!ownedIds.has(sig.placeholderId)) {
                return NextResponse.json({ error: `Placeholder ${sig.placeholderId} does not belong to this document` }, { status: 403 })
            }
        }

        if (body.signatures.length !== placeholders.length) {
            return NextResponse.json({
                error: `You must sign all ${placeholders.length} field(s). You signed ${body.signatures.length}.`,
            }, { status: 400 })
        }

        // ── Create or get signer row (self) ──────────────────────────────────
        // Using upsert would be better if allowed, but we'll check first to handle retries.
        let { data: signer } = await admin
            .from('signers')
            .select('id')
            .eq('document_id', doc.id)
            .eq('email', user.email!)
            .maybeSingle()

        if (!signer) {
            const { data: newSigner, error: signerErr } = await admin
                .from('signers')
                .insert({
                    document_id: doc.id,
                    email: user.email!,
                    priority: 1,
                    status: 'signed',
                    signed_at: new Date().toISOString(),
                })
                .select('id')
                .single()

            if (signerErr || !newSigner) {
                return NextResponse.json({ error: 'Failed to create signer record' }, { status: 500 })
            }
            signer = newSigner
        } else {
            // Update existing signer to 'signed'
            await admin
                .from('signers')
                .update({ status: 'signed', signed_at: new Date().toISOString() })
                .eq('id', signer.id)
        }

        // ── Insert signature rows ─────────────────────────────────────────────
        // Delete old signatures if retrying
        await admin.from('signatures').delete().eq('signer_id', signer.id)

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
            actorEmail: user.email!,
            event: 'signature_submitted',
            metadata: { count: signatureRows.length, mode: 'self_sign' },
        })

        // ── Download PDF, burn signatures, re-upload ──────────────────────────
        const { data: fileData, error: downloadErr } = await admin.storage
            .from('documents')
            .download(doc.file_path)

        if (downloadErr || !fileData) {
            return NextResponse.json({ error: 'Failed to download PDF for burning' }, { status: 500 })
        }

        const pdfBytes = new Uint8Array(await fileData.arrayBuffer())

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

        const burnedBytes = await burnSignaturesIntoPDF(pdfBytes, burnInputs)

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
            actorEmail: user.email!,
            event: 'pdf_burned',
        })

        // ── Mark document as completed ────────────────────────────────────────
        await admin.from('documents').update({ status: 'completed' }).eq('id', doc.id)

        await logEvent({
            documentId: doc.id,
            signerId: signer.id,
            actorEmail: user.email!,
            event: 'document_completed',
            metadata: { mode: 'self_sign' },
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[self-sign] Error:', err)
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
