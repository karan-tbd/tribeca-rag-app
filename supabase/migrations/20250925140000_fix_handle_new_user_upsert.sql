-- Upsert public.users on auth.users insert to avoid duplicate email conflicts
-- and ensure the public.users.id matches auth.users.id for the same email.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (email) DO UPDATE
  SET id = EXCLUDED.id,
      name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url;

  RETURN NEW;
END;
$$;

