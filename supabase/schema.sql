-- ============================================================
-- UtilSign — Supabase Schema
-- Run this in Supabase SQL Editor (Project > SQL Editor)
-- ============================================================

-- Enable required extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- 1. DOCUMENTS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path   TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','sent','in_progress','completed','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_sender ON documents(sender_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid "already exists" errors on re-run
DROP POLICY IF EXISTS "documents_sender_all" ON documents;

-- Senders can SELECT / UPDATE / DELETE their own documents
CREATE POLICY "documents_sender_all" ON documents
  FOR ALL
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- -------------------------------------------------------
-- 2. PLACEHOLDERS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS placeholders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number           INT  NOT NULL,
  x_percent             DOUBLE PRECISION NOT NULL,
  y_percent             DOUBLE PRECISION NOT NULL,
  width_percent         DOUBLE PRECISION NOT NULL,
  height_percent        DOUBLE PRECISION NOT NULL,
  label                 TEXT,
  assigned_signer_email TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_placeholders_doc ON placeholders(document_id);

ALTER TABLE placeholders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "placeholders_sender_all" ON placeholders;

-- Sender can manage placeholders for their documents
CREATE POLICY "placeholders_sender_all" ON placeholders
  FOR ALL
  USING (
    document_id IN (
      SELECT id FROM documents WHERE sender_id = auth.uid()
    )
  )
  WITH CHECK (
    document_id IN (
      SELECT id FROM documents WHERE sender_id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- 3. SIGNERS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS signers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  priority    INT  NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','awaiting_turn','signed','declined')),
  signed_at   TIMESTAMPTZ,
  token_hash  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signers_doc ON signers(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_signers_doc_priority ON signers(document_id, priority);

ALTER TABLE signers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signers_sender_read" ON signers;

-- Sender can read signers for their documents
CREATE POLICY "signers_sender_read" ON signers
  FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents WHERE sender_id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- 4. OTP_RECORDS  (service role only — no direct client access)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signer_id  UUID NOT NULL REFERENCES signers(id) ON DELETE CASCADE,
  otp_hash   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INT  NOT NULL DEFAULT 0,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_signer ON otp_records(signer_id);

ALTER TABLE otp_records ENABLE ROW LEVEL SECURITY;
-- No client policies — service role key only

-- -------------------------------------------------------
-- 5. SIGNATURES  (service role only)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS signatures (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signer_id      UUID NOT NULL REFERENCES signers(id) ON DELETE CASCADE,
  placeholder_id UUID NOT NULL REFERENCES placeholders(id) ON DELETE CASCADE,
  image_base64   TEXT NOT NULL,
  signed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signatures_signer ON signatures(signer_id);

ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
-- No client policies — service role key only

-- -------------------------------------------------------
-- 6. AUDIT_LOGS  (service role only)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_id   UUID REFERENCES signers(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_document ON audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_logs(created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- No client policies — service role key only
