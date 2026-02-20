import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { verifyToken } from '@/lib/jwt'
import { signSessionToken } from '@/lib/jwt'
import { verifyOTP } from '@/lib/otp'
import { logEvent } from '@/lib/audit'

const MAX_ATTEMPTS = 3

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params
        const admin = createSupabaseAdminClient()

        // ── Verify magic-link JWT ─────────────────────────────────────────────────
        let payload
        try {
            payload = await verifyToken(token)
        } catch {
            return NextResponse.json({ error: 'expired' }, { status: 401 })
        }
        if (payload.type !== 'magic_link') {
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }

        // ── Parse body ────────────────────────────────────────────────────────────
        const body = await req.json() as { otp?: string }
        if (!body.otp || typeof body.otp !== 'string' || !/^\d{6}$/.test(body.otp)) {
            return NextResponse.json({ error: 'invalid_otp', message: 'OTP must be a 6-digit number.' }, { status: 400 })
        }

        // ── Load signer ───────────────────────────────────────────────────────────
        const { data: signer, error: signerError } = await admin
            .from('signers')
            .select('id, email, status, document_id')
            .eq('id', payload.signerId)
            .single()

        if (signerError || !signer || signer.status !== 'awaiting_turn') {
            return NextResponse.json({ error: 'not_your_turn' }, { status: 403 })
        }

        // ── Load latest unused OTP record ─────────────────────────────────────────
        const { data: otpRecord, error: otpError } = await admin
            .from('otp_records')
            .select('id, otp_hash, expires_at, attempts, used')
            .eq('signer_id', signer.id)
            .eq('used', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (otpError || !otpRecord) {
            return NextResponse.json({ error: 'otp_not_found', message: 'No active OTP found. Please request a new one.' }, { status: 404 })
        }

        // ── Check expiry ──────────────────────────────────────────────────────────
        if (new Date(otpRecord.expires_at) < new Date()) {
            return NextResponse.json({ error: 'otp_expired', message: 'OTP has expired. Please request a new one.' }, { status: 410 })
        }

        // ── Check lock ────────────────────────────────────────────────────────────
        if (otpRecord.attempts >= MAX_ATTEMPTS) {
            return NextResponse.json({ error: 'otp_locked', message: 'Too many failed attempts. Please request a new OTP.' }, { status: 429 })
        }

        // ── Verify OTP ────────────────────────────────────────────────────────────
        const isValid = await verifyOTP(body.otp, otpRecord.otp_hash)

        if (!isValid) {
            const newAttempts = otpRecord.attempts + 1
            await admin
                .from('otp_records')
                .update({ attempts: newAttempts })
                .eq('id', otpRecord.id)

            await logEvent({
                documentId: signer.document_id,
                signerId: signer.id,
                actorEmail: signer.email,
                event: 'otp_failed',
                metadata: { attempt: newAttempts, maxAttempts: MAX_ATTEMPTS },
            })

            if (newAttempts >= MAX_ATTEMPTS) {
                await logEvent({
                    documentId: signer.document_id,
                    signerId: signer.id,
                    actorEmail: signer.email,
                    event: 'otp_locked',
                })
                return NextResponse.json({
                    error: 'otp_locked',
                    message: `Too many failed attempts. Please request a new OTP.`,
                    attempts: newAttempts,
                }, { status: 429 })
            }

            return NextResponse.json({
                error: 'invalid_otp',
                message: `Incorrect code. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`,
                attempts: newAttempts,
            }, { status: 400 })
        }

        // ── Mark OTP as used ──────────────────────────────────────────────────────
        await admin.from('otp_records').update({ used: true }).eq('id', otpRecord.id)

        // ── Issue session JWT ─────────────────────────────────────────────────────
        const sessionToken = await signSessionToken({
            signerId: signer.id,
            documentId: signer.document_id,
        })

        await logEvent({
            documentId: signer.document_id,
            signerId: signer.id,
            actorEmail: signer.email,
            event: 'otp_verified',
        })

        return NextResponse.json({ sessionToken })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
