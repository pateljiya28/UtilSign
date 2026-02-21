-- ============================================================
-- Migration: Add `type` column to documents table
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'request_sign'
    CHECK (type IN ('self_sign','request_sign'));

-- Backfill existing documents as 'request_sign'
UPDATE documents SET type = 'request_sign' WHERE type IS NULL;
