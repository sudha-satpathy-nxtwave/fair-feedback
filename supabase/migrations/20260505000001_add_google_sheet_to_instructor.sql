-- Add per-instructor Google Sheet webhook URL column
ALTER TABLE public.instructor_profiles
  ADD COLUMN IF NOT EXISTS google_sheet_webhook_url TEXT DEFAULT NULL;
