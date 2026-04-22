-- 1. Wipe data from problematic tables (clear PIN errors + stale codes)
TRUNCATE TABLE public.admin_config;
TRUNCATE TABLE public.session_codes;
TRUNCATE TABLE public.daily_attendance;
TRUNCATE TABLE public.attendance_feedback;

-- 2. Add username column to admin_config for new auth model
ALTER TABLE public.admin_config
  ADD COLUMN IF NOT EXISTS username text;

-- 3. Enforce single master admin (singleton already exists; ensure unique)
CREATE UNIQUE INDEX IF NOT EXISTS admin_config_singleton_uidx
  ON public.admin_config (singleton)
  WHERE singleton = true;

-- 4. Unique constraint for atomic attendance upsert
CREATE UNIQUE INDEX IF NOT EXISTS daily_attendance_student_date_instructor_uidx
  ON public.daily_attendance (student_id, date, instructor_id);
