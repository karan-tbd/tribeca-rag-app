-- Create storage bucket for documents (idempotent) – compatible with storage versions with/without `public` column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'public'
    ) THEN
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('documents', 'documents', false)
      ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO storage.buckets (id, name)
      VALUES ('documents', 'documents')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- Create storage policies for documents bucket (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view their own documents'
  ) THEN
    CREATE POLICY "Users can view their own documents"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own documents'
  ) THEN
    CREATE POLICY "Users can upload their own documents"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own documents'
  ) THEN
    CREATE POLICY "Users can update their own documents"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own documents'
  ) THEN
    CREATE POLICY "Users can delete their own documents"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;