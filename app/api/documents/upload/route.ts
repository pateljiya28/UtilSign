import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { logEvent } from '@/lib/audit'

export async function POST(req: NextRequest) {
    try {
        // ── Auth ──────────────────────────────────────────────────────────────────
        const supabase = await createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // ── Parse multipart ───────────────────────────────────────────────────────
        const formData = await req.formData()
        const file = formData.get('file')
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // ── Validate ──────────────────────────────────────────────────────────────
        if (file.type !== 'application/pdf') {
            return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
        }
        const TEN_MB = 10 * 1024 * 1024
        if (file.size > TEN_MB) {
            return NextResponse.json({ error: 'File must be 10 MB or smaller' }, { status: 400 })
        }

        // ── Document type (self_sign or request_sign) ────────────────────────────
        const docType = (formData.get('type') as string) || 'request_sign'
        const category = (formData.get('category') as string) || null

        // ── Upload to Supabase Storage ────────────────────────────────────────────
        const admin = createSupabaseAdminClient()
        const fileId = crypto.randomUUID()
        const storagePath = `${user.id}/${fileId}.pdf`
        const arrayBuffer = await file.arrayBuffer()
        const { error: uploadError } = await admin.storage
            .from('documents')
            .upload(storagePath, Buffer.from(arrayBuffer), {
                contentType: 'application/pdf',
                upsert: false,
            })
        if (uploadError) {
            return NextResponse.json({ error: 'Storage upload failed', detail: uploadError.message }, { status: 500 })
        }

        // ── Insert document row ───────────────────────────────────────────────────
        const { data: doc, error: insertError } = await admin
            .from('documents')
            .insert({
                sender_id: user.id,
                file_path: storagePath,
                file_name: file.name,
                status: 'draft',
                type: docType,
                category,
            })
            .select('id')
            .single()

        if (insertError || !doc) {
            return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 })
        }

        await logEvent({
            documentId: doc.id,
            actorEmail: user.email ?? 'unknown',
            event: 'document_created',
            metadata: { fileName: file.name, fileSizeBytes: file.size },
        })

        return NextResponse.json({ documentId: doc.id, filePath: storagePath })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
