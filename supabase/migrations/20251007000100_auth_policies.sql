 -- Enable Auth and RLS policies for srmist.edu.in users

-- Ensure RLS enabled
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'students') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow all operations on students" ON public.students';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'courses') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow all operations on courses" ON public.courses';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'grades') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow all operations on grades" ON public.grades';
  END IF;
END $$;

-- Helper check: allow only authenticated users from srmist.edu.in
CREATE OR REPLACE FUNCTION public.is_srmist_user() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT
    current_setting('request.jwt.claims', true)::jsonb ? 'email'
    AND right((current_setting('request.jwt.claims', true)::jsonb ->> 'email'), 14) = '@srmist.edu.in'
$$;

-- Read policies
CREATE POLICY "Students read for srmist users" ON public.students
FOR SELECT USING (public.is_srmist_user());

CREATE POLICY "Courses read for srmist users" ON public.courses
FOR SELECT USING (public.is_srmist_user());

CREATE POLICY "Grades read for srmist users" ON public.grades
FOR SELECT USING (public.is_srmist_user());

-- Write policies (optional: restrict to authenticated srmist)
CREATE POLICY "Students write for srmist users" ON public.students
FOR INSERT WITH CHECK (public.is_srmist_user())
;
CREATE POLICY "Students update for srmist users" ON public.students
FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());

CREATE POLICY "Courses write for srmist users" ON public.courses
FOR INSERT WITH CHECK (public.is_srmist_user());
CREATE POLICY "Courses update for srmist users" ON public.courses
FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());

CREATE POLICY "Grades write for srmist users" ON public.grades
FOR INSERT WITH CHECK (public.is_srmist_user());
CREATE POLICY "Grades update for srmist users" ON public.grades
FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());


