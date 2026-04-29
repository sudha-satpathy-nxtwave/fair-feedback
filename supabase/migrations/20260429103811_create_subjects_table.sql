-- Create subjects table
CREATE TABLE public.subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts"
  ON public.subjects FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public read"
  ON public.subjects FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow admin and instructors to update"
  ON public.subjects FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
