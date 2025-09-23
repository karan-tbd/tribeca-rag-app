-- Create private 'documents' bucket (idempotent) and per-user Storage RLS policies
-- This migration is safe to re-run.

-- 1) Ensure bucket exists (private)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'documents'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('documents', 'documents', FALSE)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 2) Policies: allow authenticated users to access only their own prefix `${auth.uid()}/...`
-- Read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_read_own'
  ) THEN
    CREATE POLICY "documents_read_own"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'documents'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;
END $$;

-- Insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_insert_own'
  ) THEN
    CREATE POLICY "documents_insert_own"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'documents'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;
END $$;

-- Update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_modify_own'
  ) THEN
    CREATE POLICY "documents_modify_own"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'documents'
      AND split_part(name, '/', 1) = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'documents'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;
END $$;

-- Delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_delete_own'
  ) THEN
    CREATE POLICY "documents_delete_own"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'documents'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;
END $$;

