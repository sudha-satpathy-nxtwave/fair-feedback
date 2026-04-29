-- Add subject_id to attendance_feedback
ALTER TABLE public.attendance_feedback ADD COLUMN subject_id UUID;

-- Add foreign key to subjects table
ALTER TABLE public.attendance_feedback
ADD CONSTRAINT fk_attendance_feedback_subject
FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- Create index for efficient duplicate checking within 1 hour (time-based validation happens in app logic)
CREATE INDEX idx_feedback_student_subject_time
ON public.attendance_feedback(student_id, subject_id, created_at DESC);
