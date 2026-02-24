import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    try {
        const admin = createSupabaseAdminClient()

        // Run all pending migrations using the admin (service role) client
        const migrations = [
            // 1. Add `type` column to documents (if missing)
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'request_sign'`,
            `UPDATE documents SET type = 'request_sign' WHERE type IS NULL`,

            // 2. Add extra columns to documents
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
            `ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`,

            // 3. Create templates table
            `CREATE TABLE IF NOT EXISTS templates (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                description TEXT,
                category    TEXT,
                recipients  JSONB NOT NULL DEFAULT '[]',
                subject     TEXT,
                message     TEXT,
                file_path   TEXT,
                file_name   TEXT,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            )`,

            // 4. RLS for templates
            `ALTER TABLE templates ENABLE ROW LEVEL SECURITY`,
            `DROP POLICY IF EXISTS "templates_owner_all" ON templates`,
            `CREATE POLICY "templates_owner_all" ON templates FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())`,
        ]

        const results: { sql: string; success: boolean; error?: string }[] = []

        for (const sql of migrations) {
            const { error } = await admin.rpc('exec_sql', { query: sql })
            if (error) {
                // Try direct approach if rpc doesn't exist
                results.push({ sql: sql.substring(0, 80) + '...', success: false, error: error.message })
            } else {
                results.push({ sql: sql.substring(0, 80) + '...', success: true })
            }
        }

        return NextResponse.json({ message: 'Migration attempted', results })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
    }
}
