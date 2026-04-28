-- Add original_index to preserve uploaded CSV row order for students_master
ALTER TABLE public.students_master
  ADD COLUMN IF NOT EXISTS original_index integer;

CREATE INDEX IF NOT EXISTS students_master_original_index_idx
  ON public.students_master (original_index);
