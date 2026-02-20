import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { verifyToken } from '@/lib/jwt'
import { generateOTP, hashOTP } from '@/lib/otp'
import { sendOTPEmail } from '@/lib/resend'
import { logEvent } from '@/lib/audit'

// Hash the raw JWT string to compare against stored token_hash
async function hashTokenStr(token: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params
        const admin = createSupabaseAdminClient()

        // ── Verify JWT structure ──────────────────────────────────────────────────
        let payload
        try {
            payload = await verifyToken(token)
        } catch {
            return NextResponse.json({ error: 'expired', message: 'This link has expired or is invalid.' }, { status: 401 })
        }

        if (payload.type !== 'magic_link') {
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }

        // ── Load signer row ───────────────────────────────────────────────────────
        const { data: signer, error: signerError } = await admin
            .from('signers')
            .select('id, email, status, token_hash, document_id')
            .eq('id', payload.signerId)
            .single()

        if (signerError || !signer) {
            return NextResponse.json({ error: 'not_found' }, { status: 404 })
        }

        // ── Verify token hash matches ─────────────────────────────────────────────
        const tokenHash = await hashTokenStr(token)
        if (signer.token_hash !== tokenHash) {
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }

        // ── Enforce turn order ────────────────────────────────────────────────────
        if (signer.status === 'signed') {
            return NextResponse.json({ error: 'already_signed', message: 'You have already signed this document.' }, { status: 409 })
        }
        if (signer.status === 'declined') {
            return NextResponse.json({ error: 'declined', message: 'You have declined to sign this document.' }, { status: 409 })
        }
        if (signer.status === 'pending') {
            return NextResponse.json({ error: 'not_your_turn', message: 'It is not yet your turn to sign. You will receive an email when it is.' }, { status: 403 })
        }
        if (signer.status !== 'awaiting_turn') {
            return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
        }

        // ── Load document info ────────────────────────────────────────────────────
        const { data: doc } = await admin
            .from('documents')
            .select('file_name')
            .eq('id', signer.document_id)
            .single()

        // ── Audit: link opened ────────────────────────────────────────────────────
        await logEvent({
            documentId: signer.document_id,
            signerId: signer.id,
            actorEmail: signer.email,
            event: 'link_opened',
        })

        // ── Generate OTP, store hash, send email ──────────────────────────────────
        const otp = generateOTP()
        const otpHash = await hashOTP(otp)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

        // Invalidate previous OTP records for this signer
        await admin.from('otp_records').update({ used: true }).eq('signer_id', signer.id).eq('used', false)

        await admin.from('otp_records').insert({
            signer_id: signer.id,
            otp_hash: otpHash,
            expires_at: expiresAt,
        })

        await sendOTPEmail({
            to: signer.email,
            otp,
            documentName: doc?.file_name ?? 'Document',
        })

        await logEvent({
            documentId: signer.document_id,
            signerId: signer.id,
            actorEmail: signer.email,
            event: 'otp_sent',
        })

        return NextResponse.json({
            documentName: doc?.file_name ?? 'Document',
            signerEmail: signer.email,
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
