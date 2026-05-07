-- Add ai_corrected_description to attendance_feedback
ALTER TABLE public.attendance_feedback
  ADD COLUMN IF NOT EXISTS ai_corrected_description TEXT DEFAULT NULL;
