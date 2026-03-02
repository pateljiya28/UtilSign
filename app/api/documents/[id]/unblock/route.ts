import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase'
import { logEvent } from '@/lib/audit'
import { signMagicToken } from '@/lib/jwt'
import { sendSigningRequest } from '@/lib/resend'

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
        const admin = createSupabaseAdminClient()
        const supabase = await createSupabaseServerClient()

        // ── Auth check ────────────────────────────────────────────────────────────
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // ── Verify document ownership ─────────────────────────────────────────────
        const { data: doc } = await admin
            .from('documents')
            .select('id, file_name, sender_id')
            .eq('id', documentId)
            .eq('sender_id', user.id)
            .single()

        if (!doc) {
            return NextResponse.json({ error: 'Document not found or not authorized' }, { status: 404 })
        }

        // ── Parse body ────────────────────────────────────────────────────────────
        const body = await req.json() as { signerId: string }
        if (!body.signerId) {
            return NextResponse.json({ error: 'signerId is required' }, { status: 400 })
        }

        // ── Load signer ───────────────────────────────────────────────────────────
        const { data: signer } = await admin
            .from('signers')
            .select('id, email, status, document_id')
            .eq('id', body.signerId)
            .eq('document_id', documentId)
            .single()

        if (!signer) {
            return NextResponse.json({ error: 'Signer not found' }, { status: 404 })
        }

        // ── Delete all OTP records for this signer (reset attempts) ───────────────
        await admin.from('otp_records').delete().eq('signer_id', signer.id)

        // ── Generate a new magic link token ───────────────────────────────────────
        const newToken = await signMagicToken({ signerId: signer.id, documentId })
        const tokenHash = await hashTokenStr(newToken)

        // ── Re-set signer to awaiting_turn with new token ─────────────────────────
        await admin
            .from('signers')
            .update({ status: 'awaiting_turn', token_hash: tokenHash })
            .eq('id', signer.id)

        // ── Send new signing request email ────────────────────────────────────────
        const signLink = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${newToken}`
        const senderName = user.email?.split('@')[0] || 'Document sender'

        await sendSigningRequest({
            to: signer.email,
            senderName,
            documentName: doc.file_name,
            signLink,
        })

        // ── Audit ─────────────────────────────────────────────────────────────────
        await logEvent({
            documentId,
            signerId: signer.id,
            actorEmail: user.email ?? 'unknown',
            event: 'signer_unblocked',
            metadata: { signerEmail: signer.email },
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
