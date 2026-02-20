import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { signMagicToken } from '@/lib/jwt'
import { sendSigningRequest, sendBroadcastNotification } from '@/lib/resend'
import { logEvent } from '@/lib/audit'

interface SignerInput {
    email: string
    priority: number
}

// Helper: hash a token for storage using Web Crypto API
async function hashTokenStr(token: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: documentId } = await params

        // ── Auth ──────────────────────────────────────────────────────────────────
        const supabase = await createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = createSupabaseAdminClient()

        // ── Verify document ownership ─────────────────────────────────────────────
        const { data: doc, error: docError } = await admin
            .from('documents')
            .select('id, file_name, status')
            .eq('id', documentId)
            .eq('sender_id', user.id)
            .single()

        if (docError || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }
        if (doc.status !== 'draft') {
            return NextResponse.json({ error: 'Document has already been sent' }, { status: 409 })
        }

        // ── Parse & validate signers ──────────────────────────────────────────────
        const body = await req.json() as { signers: SignerInput[] }
        if (!Array.isArray(body.signers) || body.signers.length === 0) {
            return NextResponse.json({ error: 'signers array is required' }, { status: 400 })
        }

        const priorities = body.signers.map(s => s.priority)
        if (new Set(priorities).size !== priorities.length) {
            return NextResponse.json({ error: 'Each signer must have a unique priority' }, { status: 400 })
        }

        // ── Upsert signers ────────────────────────────────────────────────────────
        await admin.from('signers').delete().eq('document_id', documentId)
        const signerRows = body.signers.map(s => ({
            document_id: documentId,
            email: s.email,
            priority: s.priority,
            status: 'pending',
        }))
        const { data: insertedSigners, error: signerError } = await admin
            .from('signers')
            .insert(signerRows)
            .select('id, email, priority')
        if (signerError || !insertedSigners) {
            return NextResponse.json({ error: 'Failed to save signers' }, { status: 500 })
        }

        // ── Update doc status to 'sent' ────────────────────────────────────────────
        await admin.from('documents').update({ status: 'sent' }).eq('id', documentId)

        // ── Find priority-1 signer and kick off the chain ─────────────────────────
        const firstSigner = insertedSigners.sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority)[0]
        const token = await signMagicToken({ signerId: firstSigner.id, documentId })
        const tokenHash = await hashTokenStr(token)

        await admin
            .from('signers')
            .update({ status: 'awaiting_turn', token_hash: tokenHash })
            .eq('id', firstSigner.id)

        const signLink = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${token}`
        await sendSigningRequest({
            to: firstSigner.email,
            senderName: user.email ?? 'Document sender',
            documentName: doc.file_name,
            signLink,
        })

        // ── Audit ─────────────────────────────────────────────────────────────────
        await logEvent({
            documentId,
            actorEmail: user.email ?? 'unknown',
            event: 'document_sent',
            metadata: { signerCount: body.signers.length },
        })
        await logEvent({
            documentId,
            signerId: firstSigner.id,
            actorEmail: user.email ?? 'unknown',
            event: 'email_delivered',
            metadata: { to: firstSigner.email },
        })

        // ── Broadcast to all other signers ──────────────────────────────────────────
        const sortedSigners = insertedSigners.sort(
            (a: { priority: number }, b: { priority: number }) => a.priority - b.priority
        )
        const otherSigners = sortedSigners.slice(1) // everyone except signer #1
        for (const signer of otherSigners) {
            try {
                await sendBroadcastNotification({
                    to: signer.email,
                    documentName: doc.file_name,
                    senderName: user.email ?? 'Document sender',
                    currentSignerEmail: firstSigner.email,
                    signerPosition: signer.priority,
                    totalSigners: insertedSigners.length,
                })
                await logEvent({
                    documentId,
                    signerId: signer.id,
                    actorEmail: user.email ?? 'unknown',
                    event: 'broadcast_sent',
                    metadata: { to: signer.email, position: signer.priority },
                })
            } catch (broadcastErr) {
                console.error(`[send] Broadcast to ${signer.email} failed:`, broadcastErr)
                await logEvent({
                    documentId,
                    signerId: signer.id,
                    actorEmail: user.email ?? 'unknown',
                    event: 'email_failed',
                    metadata: { to: signer.email, reason: 'broadcast_failed' },
                })
            }
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
