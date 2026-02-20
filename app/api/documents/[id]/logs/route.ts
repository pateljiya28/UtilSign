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
            .select('id')
            .eq('id', documentId)
            .eq('sender_id', user.id)
            .single()

        if (docError || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        // ── Fetch logs ────────────────────────────────────────────────────────────
        const { data: logs, error: logsError } = await admin
            .from('audit_logs')
            .select('id, actor_email, event_type, metadata, created_at, signer_id')
            .eq('document_id', documentId)
            .order('created_at', { ascending: false })

        if (logsError) {
            return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
        }

        return NextResponse.json({ logs: logs ?? [] })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
