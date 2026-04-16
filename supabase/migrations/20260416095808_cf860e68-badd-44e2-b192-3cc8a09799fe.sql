
CREATE TABLE public.attendance_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  understanding_rating INTEGER NOT NULL CHECK (understanding_rating BETWEEN 1 AND 5),
  instructor_rating INTEGER NOT NULL CHECK (instructor_rating BETWEEN 1 AND 5),
  description TEXT NOT NULL DEFAULT 'NA',
  ai_score INTEGER DEFAULT 0,
  attendance_marked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts"
  ON public.attendance_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public read"
  ON public.attendance_feedback FOR SELECT
  TO anon, authenticated
  USING (true);
