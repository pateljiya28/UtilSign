-- Add placeholders JSONB column to templates table
-- Stores placeholder definitions (position, size, label, fieldType, signerIndex) for reuse
ALTER TABLE templates ADD COLUMN IF NOT EXISTS placeholders JSONB DEFAULT '[]';
