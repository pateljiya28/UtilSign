-- ============================================================
-- UtilSign — Run All Pending Migrations
-- Copy and paste this ENTIRE file into Supabase SQL Editor and click "Run"
-- https://supabase.com/dashboard → SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- 1. Add `type` column to DOCUMENTS (if missing)
-- -------------------------------------------------------
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'request_sign';

-- Backfill existing documents
UPDATE documents SET type = 'request_sign' WHERE type IS NULL;

-- -------------------------------------------------------
-- 2. Add extra columns to DOCUMENTS
-- -------------------------------------------------------
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_deleted ON documents(deleted_at);

-- -------------------------------------------------------
-- 3. Create TEMPLATES table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
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
);

CREATE INDEX IF NOT EXISTS idx_templates_owner ON templates(owner_id);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_owner_all" ON templates;

CREATE POLICY "templates_owner_all" ON templates
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================
-- Done! Both document creation and template creation should now work.
-- ============================================================
