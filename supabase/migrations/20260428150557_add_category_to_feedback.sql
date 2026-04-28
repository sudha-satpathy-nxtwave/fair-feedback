ALTER TABLE public.attendance_feedback ADD COLUMN category TEXT DEFAULT 'improvement' CHECK (category IN ('appreciation', 'improvement', 'reject'));

-- Update existing records with category based on local logic
UPDATE public.attendance_feedback
SET category = CASE
  WHEN description IS NULL OR trim(description) = '' OR lower(trim(description)) = 'na' THEN
    CASE WHEN understanding_rating >= 4 AND instructor_rating >= 4 THEN 'appreciation' ELSE 'improvement' END
  ELSE
    CASE
      WHEN lower(trim(description)) LIKE '%great%' OR lower(trim(description)) LIKE '%excellent%' OR lower(trim(description)) LIKE '%amazing%' OR lower(trim(description)) LIKE '%wonderful%' OR lower(trim(description)) LIKE '%fantastic%' OR lower(trim(description)) LIKE '%awesome%' OR lower(trim(description)) LIKE '%very good%' OR lower(trim(description)) LIKE '%really good%' OR lower(trim(description)) LIKE '%loved it%' OR lower(trim(description)) LIKE '%perfect%' OR lower(trim(description)) LIKE '%best%' OR lower(trim(description)) LIKE '%superb%' OR lower(trim(description)) LIKE '%well done%' OR lower(trim(description)) LIKE '%clear%' OR lower(trim(description)) LIKE '%easy to understand%' OR lower(trim(description)) LIKE '%enjoyed%' OR lower(trim(description)) LIKE '%helpful%' OR lower(trim(description)) LIKE '%informative%' THEN
        CASE WHEN (understanding_rating + instructor_rating) / 2 >= 4 THEN 'appreciation' ELSE 'improvement' END
      WHEN lower(trim(description)) LIKE '%did not understand%' OR lower(trim(description)) LIKE '%didn''t understand%' OR lower(trim(description)) LIKE '%too fast%' OR lower(trim(description)) LIKE '%confusing%' OR lower(trim(description)) LIKE '%confused%' OR lower(trim(description)) LIKE '%boring%' OR lower(trim(description)) LIKE '%bad%' OR lower(trim(description)) LIKE '%worst%' OR lower(trim(description)) LIKE '%terrible%' OR lower(trim(description)) LIKE '%poor%' OR lower(trim(description)) LIKE '%unclear%' OR lower(trim(description)) LIKE '%not clear%' OR lower(trim(description)) LIKE '%audio issue%' OR lower(trim(description)) LIKE '%video issue%' OR lower(trim(description)) LIKE '%waste%' OR lower(trim(description)) LIKE '%not helpful%' OR lower(trim(description)) LIKE '%couldn''t follow%' OR lower(trim(description)) LIKE '%could not follow%' OR lower(trim(description)) LIKE '%difficult%' OR lower(trim(description)) LIKE '%hard to follow%' OR lower(trim(description)) LIKE '%not good%' OR lower(trim(description)) LIKE '%disappointing%' OR lower(trim(description)) LIKE '%slow%' OR lower(trim(description)) LIKE '%rushed%' THEN 'improvement'
      ELSE
        CASE WHEN (understanding_rating + instructor_rating) / 2 >= 4 THEN 'appreciation' ELSE 'improvement' END
    END
END;