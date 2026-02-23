import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

// ── List templates ──────────────────────────────────────────────────────────
export async function GET() {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = createSupabaseAdminClient()
        const { data, error } = await admin
            .from('templates')
            .select('id, name, description, category, recipients, subject, message, file_name, created_at, updated_at')
            .eq('owner_id', user.id)
            .order('updated_at', { ascending: false })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ templates: data ?? [] })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// ── Create template ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const supabase = await createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { name, description, category, recipients, subject, message, file_path, file_name } = body

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
        }

        const admin = createSupabaseAdminClient()
        const { data, error } = await admin
            .from('templates')
            .insert({
                owner_id: user.id,
                name: name.trim(),
                description: description || null,
                category: category || null,
                recipients: recipients || [],
                subject: subject || null,
                message: message || null,
                file_path: file_path || null,
                file_name: file_name || null,
            })
            .select('id')
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ templateId: data.id })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
