import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: documentId } = await params

        // ── Auth ────────────────────────────────────────────────────────────────
        const supabase = await createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = createSupabaseAdminClient()

        // ── Verify document ownership ──────────────────────────────────────────
        const { data: doc, error: docError } = await admin
            .from('documents')
            .select('id, file_name, file_path, sender_id')
            .eq('id', documentId)
            .eq('sender_id', user.id)
            .single()

        if (docError || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        // ── Download the PDF from Supabase Storage ──────────────────────────────
        const { data: fileData, error: downloadErr } = await admin.storage
            .from('documents')
            .download(doc.file_path)

        if (downloadErr || !fileData) {
            return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
        }

        // ── Return PDF as attachment ────────────────────────────────────────────
        const arrayBuffer = await fileData.arrayBuffer()
        const safeName = doc.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')

        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="signed_${safeName}"`,
                'Content-Length': String(arrayBuffer.byteLength),
            },
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
