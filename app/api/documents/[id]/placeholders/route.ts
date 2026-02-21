import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

interface PlaceholderInput {
    id: string
    pageNumber: number
    xPercent: number
    yPercent: number
    widthPercent: number
    heightPercent: number
    label?: string
    assignedSignerEmail: string
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

        // ── Verify document ownership ─────────────────────────────────────────────
        const admin = createSupabaseAdminClient()
        const { data: doc, error: docError } = await admin
            .from('documents')
            .select('id')
            .eq('id', documentId)
            .eq('sender_id', user.id)
            .single()

        if (docError || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        // ── Parse body ────────────────────────────────────────────────────────────
        const body = await req.json() as { placeholders: PlaceholderInput[] }
        if (!Array.isArray(body.placeholders) || body.placeholders.length === 0) {
            return NextResponse.json({ error: 'placeholders array is required' }, { status: 400 })
        }

        // ── Replace existing placeholders atomically ──────────────────────────────
        await admin.from('placeholders').delete().eq('document_id', documentId)

        const rows = body.placeholders.map((p) => ({
            id: p.id, // Use client-provided UUID
            document_id: documentId,
            page_number: p.pageNumber,
            x_percent: p.xPercent,
            y_percent: p.yPercent,
            width_percent: p.widthPercent,
            height_percent: p.heightPercent,
            label: p.label ?? null,
            assigned_signer_email: p.assignedSignerEmail,
        }))

        const { error: insertError } = await admin.from('placeholders').insert(rows)
        if (insertError) {
            return NextResponse.json({ error: 'Failed to save placeholders' }, { status: 500 })
        }

        return NextResponse.json({ success: true, count: rows.length })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
