import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'
import { verifyToken } from '@/lib/jwt'
import { logEvent } from '@/lib/audit'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params
        const admin = createSupabaseAdminClient()

        // ── Verify magic-link JWT ─────────────────────────────────────────────────
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
            return NextResponse.json({ error: 'Session expired' }, { status: 401 })
        }
        if (
            sessionPayload.type !== 'signing_session' ||
            sessionPayload.signerId !== magicPayload.signerId
        ) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
        }

        // ── Load signer ───────────────────────────────────────────────────────────
        const { data: signer, error: signerErr } = await admin
            .from('signers')
            .select('id, email, document_id')
            .eq('id', magicPayload.signerId)
            .single()

        if (signerErr || !signer) {
            return NextResponse.json({ error: 'Signer not found' }, { status: 404 })
        }

        // ── Load document ─────────────────────────────────────────────────────────
        const { data: doc, error: docErr } = await admin
            .from('documents')
            .select('id, file_path, file_name')
            .eq('id', signer.document_id)
            .single()

        if (docErr || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        // ── Load this signer's placeholders ───────────────────────────────────────
        const { data: placeholders } = await admin
            .from('placeholders')
            .select('id, page_number, x_percent, y_percent, width_percent, height_percent, label')
            .eq('document_id', doc.id)
            .eq('assigned_signer_email', signer.email)

        // ── Generate a short-lived signed URL for the PDF (5 min) ─────────────────
        const { data: signedUrlData } = await admin.storage
            .from('documents')
            .createSignedUrl(doc.file_path, 300)

        await logEvent({
            documentId: doc.id,
            signerId: signer.id,
            actorEmail: signer.email,
            event: 'placeholder_viewed',
        })

        return NextResponse.json({
            documentName: doc.file_name,
            placeholders: placeholders ?? [],
            pdfUrl: signedUrlData?.signedUrl ?? null,
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
