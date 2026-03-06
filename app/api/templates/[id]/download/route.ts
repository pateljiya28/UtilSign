import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

// ── Download template PDF ───────────────────────────────────────────────────
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = createSupabaseAdminClient()

        // Fetch template to get file_path
        const { data: template, error: tplError } = await admin
            .from('templates')
            .select('file_path, file_name')
            .eq('id', id)
            .eq('owner_id', user.id)
            .single()

        if (tplError || !template || !template.file_path) {
            return NextResponse.json({ error: 'Template or file not found' }, { status: 404 })
        }

        // Download from storage
        const { data: fileData, error: downloadErr } = await admin.storage
            .from('documents')
            .download(template.file_path)

        if (downloadErr || !fileData) {
            return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
        }

        const buffer = Buffer.from(await fileData.arrayBuffer())
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${template.file_name || 'template.pdf'}"`,
            },
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
