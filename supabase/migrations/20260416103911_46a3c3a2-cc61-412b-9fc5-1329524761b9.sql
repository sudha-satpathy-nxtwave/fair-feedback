
-- Session codes table for anti-proxy security
CREATE TABLE public.session_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  code TEXT NOT NULL,
  active_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instructor_id, active_date)
);

ALTER TABLE public.session_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read session codes"
  ON public.session_codes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert session codes"
  ON public.session_codes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update session codes"
  ON public.session_codes FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Students master roster
CREATE TABLE public.students_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  class_group TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.students_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read students"
  ON public.students_master FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert students"
  ON public.students_master FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Daily attendance table
CREATE TABLE public.daily_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Present',
  instructor_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, date, instructor_id)
);

ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read attendance"
  ON public.daily_attendance FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert attendance"
  ON public.daily_attendance FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
