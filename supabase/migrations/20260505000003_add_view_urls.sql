-- Add admin-level Google Sheet view URL
ALTER TABLE public.admin_config
  ADD COLUMN IF NOT EXISTS admin_sheet_view_url TEXT DEFAULT NULL;

-- Add instructor-level Google Sheet view URL
ALTER TABLE public.instructor_profiles
  ADD COLUMN IF NOT EXISTS google_sheet_view_url TEXT DEFAULT NULL;
