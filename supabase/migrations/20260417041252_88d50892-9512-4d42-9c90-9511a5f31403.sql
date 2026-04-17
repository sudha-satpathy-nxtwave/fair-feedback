-- Add section column to students_master to support per-section rosters
ALTER TABLE public.students_master 
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instructor_id text NOT NULL DEFAULT '';

-- Ensure student_id is unique so upserts work cleanly
CREATE UNIQUE INDEX IF NOT EXISTS students_master_student_id_key 
  ON public.students_master (student_id);

-- Allow updates so admins can manually toggle attendance status
CREATE POLICY "Allow public update attendance" 
  ON public.daily_attendance 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow public delete attendance" 
  ON public.daily_attendance 
  FOR DELETE 
  USING (true);

-- Allow updates/deletes on students_master for roster management
CREATE POLICY "Allow public update students" 
  ON public.students_master 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow public delete students" 
  ON public.students_master 
  FOR DELETE 
  USING (true);