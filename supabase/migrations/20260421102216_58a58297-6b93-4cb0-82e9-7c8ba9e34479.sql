-- 1. Drop old auth artifacts
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Bootstrap first admin" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP TABLE IF EXISTS public.user_roles;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.get_user_instructor_id(uuid);
DROP TYPE IF EXISTS public.app_role;

-- 2. Admin config (single row, holds hashed PINs)
CREATE TABLE public.admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_pin_hash text NOT NULL,
  co_admin_pin_hash text,
  singleton boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_config_singleton_uniq UNIQUE (singleton)
);
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read (so the client can detect "is PIN set?" and verify hash).
-- Hashes are bcrypt so reading them is safe.
CREATE POLICY "admin_config public read"
  ON public.admin_config FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admin_config public insert"
  ON public.admin_config FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admin_config public update"
  ON public.admin_config FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Instructor profiles
CREATE TABLE public.instructor_profiles (
  username text PRIMARY KEY,
  display_name text NOT NULL,
  qr_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.instructor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructor_profiles public read"
  ON public.instructor_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "instructor_profiles public insert"
  ON public.instructor_profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "instructor_profiles public update"
  ON public.instructor_profiles FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Extend students_master with new CSV fields
ALTER TABLE public.students_master
  ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS commute_type text NOT NULL DEFAULT '';

-- 5. Storage bucket for uploaded QR images
INSERT INTO storage.buckets (id, name, public)
VALUES ('instructor-qrs', 'instructor-qrs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "instructor-qrs public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'instructor-qrs');

CREATE POLICY "instructor-qrs public upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'instructor-qrs');

CREATE POLICY "instructor-qrs public update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'instructor-qrs')
  WITH CHECK (bucket_id = 'instructor-qrs');

CREATE POLICY "instructor-qrs public delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'instructor-qrs');

-- 6. updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_config_touch
  BEFORE UPDATE ON public.admin_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_instructor_profiles_touch
  BEFORE UPDATE ON public.instructor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();