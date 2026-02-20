import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

export async function GET(
    _req: NextRequest,
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

        // ── Verify ownership ──────────────────────────────────────────────────────
        const { data: doc, error: docError } = await admin
            .from('documents')
            .select('id, file_name, status, created_at')
            .eq('id', documentId)
            .eq('sender_id', user.id)
            .single()

        if (docError || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        // ── Fetch signers ─────────────────────────────────────────────────────────
        const { data: signers, error: signersError } = await admin
            .from('signers')
            .select('id, email, priority, status, signed_at, created_at')
            .eq('document_id', documentId)
            .order('priority', { ascending: true })

        if (signersError) {
            return NextResponse.json({ error: 'Failed to fetch signers' }, { status: 500 })
        }

        return NextResponse.json({ document: doc, signers: signers ?? [] })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
