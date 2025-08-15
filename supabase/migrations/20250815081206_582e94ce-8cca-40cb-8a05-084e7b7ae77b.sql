-- Add new columns to students table
ALTER TABLE public.students 
ADD COLUMN office_name TEXT,
ADD COLUMN branch_of_study TEXT,
ADD COLUMN graduation_type TEXT;

-- Add credits column to courses table
ALTER TABLE public.courses 
ADD COLUMN credits INTEGER;

-- Add mode_of_attempt column to grades table
ALTER TABLE public.grades 
ADD COLUMN mode_of_attempt TEXT;