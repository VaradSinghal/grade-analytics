-- =====================================================
-- COMPLETE DATABASE RECREATION FOR GRADE ANALYTICS
-- =====================================================
-- This migration drops all existing tables and recreates the database
-- from scratch based on the Excel format provided

-- =====================================================
-- STEP 1: DROP ALL EXISTING TABLES AND DEPENDENCIES
-- =====================================================

-- Drop all existing policies first
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on all tables
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Drop all existing triggers (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') THEN
        DROP TRIGGER IF EXISTS update_students_updated_at ON public.students;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grades') THEN
        DROP TRIGGER IF EXISTS update_grades_updated_at ON public.grades;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enrollments') THEN
        DROP TRIGGER IF EXISTS update_enrollments_updated_at ON public.enrollments;
    END IF;
END $$;

-- Drop all existing functions (with CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.is_srmist_user() CASCADE;

-- Drop all existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS public.grades CASCADE;
DROP TABLE IF EXISTS public.enrollments CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.offices CASCADE;
DROP TABLE IF EXISTS public.degrees CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.graduation_types CASCADE;

-- Drop any existing views that might conflict
DROP VIEW IF EXISTS public.student_performance_summary CASCADE;
DROP VIEW IF EXISTS public.course_performance_summary CASCADE;
DROP VIEW IF EXISTS public.semester_performance CASCADE;

-- =====================================================
-- STEP 2: CREATE NEW DATABASE SCHEMA
-- =====================================================

-- Create offices table (normalized from Office Name)
CREATE TABLE public.offices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create degrees table (normalized from Degree)
CREATE TABLE public.degrees (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    abbreviation TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create branches table (normalized from Branch of Study)
CREATE TABLE public.branches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create graduation_types table (normalized from Graduation Type)
CREATE TABLE public.graduation_types (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create students table (main student information)
CREATE TABLE public.students (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    register_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    batch INTEGER,
    semester INTEGER,
    office_name TEXT,
    degree TEXT,
    branch_of_study TEXT,
    graduation_type TEXT,
    office_id UUID REFERENCES public.offices(id) ON DELETE RESTRICT,
    degree_id UUID REFERENCES public.degrees(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
    graduation_type_id UUID REFERENCES public.graduation_types(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create courses table
CREATE TABLE public.courses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    title TEXT,
    credits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create enrollments table (main table for student-course relationships)
CREATE TABLE public.enrollments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    semester INTEGER NOT NULL,
    batch INTEGER NOT NULL,
    grade TEXT NOT NULL,
    mode_of_attempt TEXT NOT NULL DEFAULT 'Regular',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(student_id, course_id, semester)
);

-- Create grades table (for backward compatibility with existing application)
CREATE TABLE public.grades (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    grade TEXT NOT NULL,
    is_passed BOOLEAN NOT NULL DEFAULT false,
    mode_of_attempt TEXT NOT NULL DEFAULT 'Regular',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(student_id, course_id)
);

-- =====================================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Students table indexes
CREATE INDEX idx_students_register_number ON public.students(register_number);
CREATE INDEX idx_students_name ON public.students(name);
CREATE INDEX idx_students_batch ON public.students(batch);
CREATE INDEX idx_students_semester ON public.students(semester);
CREATE INDEX idx_students_office_name ON public.students(office_name);
CREATE INDEX idx_students_degree ON public.students(degree);
CREATE INDEX idx_students_branch_of_study ON public.students(branch_of_study);
CREATE INDEX idx_students_graduation_type ON public.students(graduation_type);
CREATE INDEX idx_students_office_id ON public.students(office_id);
CREATE INDEX idx_students_degree_id ON public.students(degree_id);
CREATE INDEX idx_students_branch_id ON public.students(branch_id);
CREATE INDEX idx_students_graduation_type_id ON public.students(graduation_type_id);

-- Courses table indexes
CREATE INDEX idx_courses_code ON public.courses(code);
CREATE INDEX idx_courses_name ON public.courses(name);
CREATE INDEX idx_courses_title ON public.courses(title);
CREATE INDEX idx_courses_credits ON public.courses(credits);

-- Enrollments table indexes
CREATE INDEX idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_course_id ON public.enrollments(course_id);
CREATE INDEX idx_enrollments_semester ON public.enrollments(semester);
CREATE INDEX idx_enrollments_batch ON public.enrollments(batch);
CREATE INDEX idx_enrollments_grade ON public.enrollments(grade);
CREATE INDEX idx_enrollments_mode_of_attempt ON public.enrollments(mode_of_attempt);
CREATE INDEX idx_enrollments_student_semester ON public.enrollments(student_id, semester);
CREATE INDEX idx_enrollments_course_semester ON public.enrollments(course_id, semester);

-- Grades table indexes (for backward compatibility)
CREATE INDEX idx_grades_student_id ON public.grades(student_id);
CREATE INDEX idx_grades_course_id ON public.grades(course_id);
CREATE INDEX idx_grades_grade ON public.grades(grade);
CREATE INDEX idx_grades_is_passed ON public.grades(is_passed);
CREATE INDEX idx_grades_mode_of_attempt ON public.grades(mode_of_attempt);

-- Composite indexes for optimized filtering
CREATE INDEX idx_students_semester_batch ON public.students(semester, batch);
CREATE INDEX idx_students_batch_semester ON public.students(batch, semester);
CREATE INDEX idx_students_register_number_name ON public.students(register_number, name);
CREATE INDEX idx_grades_course_student ON public.grades(course_id, student_id);
CREATE INDEX idx_grades_student_course ON public.grades(student_id, course_id);

-- =====================================================
-- STEP 4: CREATE UTILITY FUNCTIONS
-- =====================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Function to set title from name if title is null
CREATE OR REPLACE FUNCTION public.set_course_title_from_name()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    -- If title is null or empty, set it to the name
    IF NEW.title IS NULL OR NEW.title = '' THEN
        NEW.title = NEW.name;
    END IF;
    RETURN NEW;
END;
$$;

-- Function to check if user is from srmist.edu.in
CREATE OR REPLACE FUNCTION public.is_srmist_user() RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT
        current_setting('request.jwt.claims', true)::jsonb ? 'email'
        AND right((current_setting('request.jwt.claims', true)::jsonb ->> 'email'), 14) = '@srmist.edu.in'
$$;

-- Function to calculate GPA for a student
CREATE OR REPLACE FUNCTION public.calculate_student_gpa(student_uuid UUID)
RETURNS DECIMAL(3,2)
LANGUAGE plpgsql AS $$
DECLARE
    total_points DECIMAL := 0;
    total_credits INTEGER := 0;
    course_credits INTEGER;
    grade_points DECIMAL;
BEGIN
    FOR course_credits, grade_points IN
        SELECT c.credits, 
               CASE e.grade
                   WHEN 'O' THEN 10.0
                   WHEN 'A+' THEN 9.0
                   WHEN 'A' THEN 8.0
                   WHEN 'B+' THEN 7.0
                   WHEN 'B' THEN 6.0
                   WHEN 'C+' THEN 5.0
                   WHEN 'C' THEN 4.0
                   WHEN 'D' THEN 3.0
                   WHEN 'F' THEN 0.0
                   ELSE 0.0
               END
        FROM public.enrollments e
        JOIN public.courses c ON e.course_id = c.id
        WHERE e.student_id = student_uuid
        AND e.grade NOT IN ('RA', 'AB', 'W', 'I', 'Absent', 'ABSENT')
    LOOP
        total_points := total_points + (course_credits * grade_points);
        total_credits := total_credits + course_credits;
    END LOOP;
    
    IF total_credits = 0 THEN
        RETURN 0.0;
    END IF;
    
    RETURN ROUND(total_points / total_credits, 2);
END;
$$;

-- Function to get student statistics
CREATE OR REPLACE FUNCTION public.get_student_stats(student_uuid UUID)
RETURNS TABLE(
    total_courses INTEGER,
    passed_courses INTEGER,
    failed_courses INTEGER,
    total_credits INTEGER,
    earned_credits INTEGER,
    gpa DECIMAL(3,2),
    current_semester INTEGER
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_courses,
        COUNT(CASE WHEN e.grade IN ('O', 'A+', 'A', 'B+', 'B', 'C+', 'C') THEN 1 END)::INTEGER as passed_courses,
        COUNT(CASE WHEN e.grade IN ('D', 'F', 'RA', 'AB', 'W', 'I', 'Absent', 'ABSENT') THEN 1 END)::INTEGER as failed_courses,
        SUM(c.credits)::INTEGER as total_credits,
        SUM(CASE WHEN e.grade IN ('O', 'A+', 'A', 'B+', 'B', 'C+', 'C') THEN c.credits ELSE 0 END)::INTEGER as earned_credits,
        public.calculate_student_gpa(student_uuid) as gpa,
        MAX(e.semester)::INTEGER as current_semester
    FROM public.enrollments e
    JOIN public.courses c ON e.course_id = c.id
    WHERE e.student_id = student_uuid;
END;
$$;

-- Function to get filtered grades for analytics
CREATE OR REPLACE FUNCTION public.get_filtered_grades(
    p_semester INTEGER DEFAULT NULL,
    p_batch INTEGER DEFAULT NULL,
    p_course_id UUID DEFAULT NULL,
    p_register_number TEXT DEFAULT NULL
)
RETURNS TABLE(
    grade_id UUID,
    student_id UUID,
    course_id UUID,
    grade TEXT,
    is_passed BOOLEAN,
    mode_of_attempt TEXT,
    register_number TEXT,
    student_name TEXT,
    batch INTEGER,
    semester INTEGER,
    office_name TEXT,
    degree TEXT,
    branch_of_study TEXT,
    graduation_type TEXT,
    course_code TEXT,
    course_name TEXT,
    course_title TEXT,
    credits INTEGER
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id as grade_id,
        g.student_id,
        g.course_id,
        g.grade,
        g.is_passed,
        g.mode_of_attempt,
        s.register_number,
        s.name as student_name,
        s.batch,
        s.semester,
        s.office_name,
        s.degree,
        s.branch_of_study,
        s.graduation_type,
        c.code as course_code,
        c.name as course_name,
        c.title as course_title,
        c.credits
    FROM public.grades g
    JOIN public.students s ON g.student_id = s.id
    JOIN public.courses c ON g.course_id = c.id
    WHERE 
        (p_semester IS NULL OR s.semester = p_semester)
        AND (p_batch IS NULL OR s.batch = p_batch)
        AND (p_course_id IS NULL OR g.course_id = p_course_id)
        AND (p_register_number IS NULL OR s.register_number ILIKE '%' || p_register_number || '%')
    ORDER BY s.name, c.code;
END;
$$;

-- Function to get course performance with filters
CREATE OR REPLACE FUNCTION public.get_course_performance(
    p_course_id UUID DEFAULT NULL,
    p_semester INTEGER DEFAULT NULL,
    p_batch INTEGER DEFAULT NULL
)
RETURNS TABLE(
    course_id UUID,
    course_code TEXT,
    course_name TEXT,
    course_title TEXT,
    credits INTEGER,
    total_students BIGINT,
    passed_students BIGINT,
    failed_students BIGINT,
    pass_percentage DECIMAL(5,2),
    average_grade_points DECIMAL(3,2)
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as course_id,
        c.code as course_code,
        c.name as course_name,
        c.title as course_title,
        c.credits,
        COUNT(g.id) as total_students,
        COUNT(CASE WHEN g.is_passed = true THEN 1 END) as passed_students,
        COUNT(CASE WHEN g.is_passed = false THEN 1 END) as failed_students,
        ROUND(
            COUNT(CASE WHEN g.is_passed = true THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(g.id), 0) * 100, 2
        ) as pass_percentage,
        AVG(CASE 
            WHEN g.grade = 'O' THEN 10.0
            WHEN g.grade = 'A+' THEN 9.0
            WHEN g.grade = 'A' THEN 8.0
            WHEN g.grade = 'B+' THEN 7.0
            WHEN g.grade = 'B' THEN 6.0
            WHEN g.grade = 'C+' THEN 5.0
            WHEN g.grade = 'C' THEN 4.0
            WHEN g.grade = 'D' THEN 3.0
            WHEN g.grade = 'F' THEN 0.0
            ELSE NULL
        END) as average_grade_points
    FROM public.courses c
    LEFT JOIN public.grades g ON c.id = g.course_id
    LEFT JOIN public.students s ON g.student_id = s.id
    WHERE 
        (p_course_id IS NULL OR c.id = p_course_id)
        AND (p_semester IS NULL OR s.semester = p_semester)
        AND (p_batch IS NULL OR s.batch = p_batch)
    GROUP BY c.id, c.code, c.name, c.title, c.credits
    ORDER BY c.code;
END;
$$;

-- =====================================================
-- STEP 5: CREATE TRIGGERS
-- =====================================================

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at
    BEFORE UPDATE ON public.enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grades_updated_at
    BEFORE UPDATE ON public.grades
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to set title from name if title is null
CREATE TRIGGER set_course_title_trigger
    BEFORE INSERT OR UPDATE ON public.courses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_course_title_from_name();

-- =====================================================
-- STEP 6: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.degrees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graduation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: CREATE RLS POLICIES FOR SRMIST.EDU.IN USERS
-- =====================================================

-- Read policies for all tables
CREATE POLICY "Offices read for srmist users" ON public.offices
    FOR SELECT USING (public.is_srmist_user());

CREATE POLICY "Degrees read for srmist users" ON public.degrees
    FOR SELECT USING (public.is_srmist_user());

CREATE POLICY "Branches read for srmist users" ON public.branches
    FOR SELECT USING (public.is_srmist_user());

CREATE POLICY "Graduation types read for srmist users" ON public.graduation_types
    FOR SELECT USING (public.is_srmist_user());

CREATE POLICY "Students read for srmist users" ON public.students
    FOR SELECT USING (public.is_srmist_user());

CREATE POLICY "Courses read for srmist users" ON public.courses
    FOR SELECT USING (public.is_srmist_user());

CREATE POLICY "Enrollments read for srmist users" ON public.enrollments
    FOR SELECT USING (public.is_srmist_user());

CREATE POLICY "Grades read for srmist users" ON public.grades
    FOR SELECT USING (public.is_srmist_user());

-- Write policies for all tables
CREATE POLICY "Offices write for srmist users" ON public.offices
    FOR INSERT WITH CHECK (public.is_srmist_user());

CREATE POLICY "Offices update for srmist users" ON public.offices
    FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());

CREATE POLICY "Degrees write for srmist users" ON public.degrees
    FOR INSERT WITH CHECK (public.is_srmist_user());

CREATE POLICY "Degrees update for srmist users" ON public.degrees
    FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());

CREATE POLICY "Branches write for srmist users" ON public.branches
    FOR INSERT WITH CHECK (public.is_srmist_user());

CREATE POLICY "Branches update for srmist users" ON public.branches
    FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());

CREATE POLICY "Graduation types write for srmist users" ON public.graduation_types
    FOR INSERT WITH CHECK (public.is_srmist_user());

CREATE POLICY "Graduation types update for srmist users" ON public.graduation_types
    FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());

CREATE POLICY "Students write for srmist users" ON public.students
    FOR INSERT WITH CHECK (public.is_srmist_user());

CREATE POLICY "Students update for srmist users" ON public.students
    FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());

CREATE POLICY "Courses write for srmist users" ON public.courses
    FOR INSERT WITH CHECK (public.is_srmist_user());

CREATE POLICY "Courses update for srmist users" ON public.courses
    FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());

CREATE POLICY "Enrollments write for srmist users" ON public.enrollments
    FOR INSERT WITH CHECK (public.is_srmist_user());

CREATE POLICY "Enrollments update for srmist users" ON public.enrollments
    FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());

CREATE POLICY "Grades write for srmist users" ON public.grades
    FOR INSERT WITH CHECK (public.is_srmist_user());

CREATE POLICY "Grades update for srmist users" ON public.grades
    FOR UPDATE USING (public.is_srmist_user()) WITH CHECK (public.is_srmist_user());

-- Note: Views will be created later in the migration

-- =====================================================
-- STEP 8: INSERT REFERENCE DATA
-- =====================================================

-- Insert office data
INSERT INTO public.offices (name) VALUES
('Faculty of Engineering and Technology, Kattankulathur'),
('Faculty of Science and Humanities, Kattankulathur'),
('Faculty of Management, Kattankulathur'),
('Faculty of Medicine and Health Sciences, Kattankulathur');

-- Insert degree data
INSERT INTO public.degrees (name, abbreviation) VALUES
('Bachelor of Technology', 'B.Tech.'),
('Bachelor of Science', 'B.Sc.'),
('Bachelor of Business Administration', 'BBA'),
('Bachelor of Medicine and Bachelor of Surgery', 'MBBS'),
('Master of Technology', 'M.Tech.'),
('Master of Science', 'M.Sc.'),
('Master of Business Administration', 'MBA'),
('Master of Philosophy', 'M.Phil.'),
('Doctor of Philosophy', 'Ph.D.');

-- Insert branch data
INSERT INTO public.branches (name) VALUES
('Computer Science and Engineering'),
('Information Technology'),
('Electronics and Communication Engineering'),
('Electrical and Electronics Engineering'),
('Mechanical Engineering'),
('Civil Engineering'),
('Aerospace Engineering'),
('Biomedical Engineering'),
('Chemical Engineering'),
('Biotechnology'),
('Mathematics'),
('Physics'),
('Chemistry'),
('English'),
('Management Studies');

-- Insert graduation type data
INSERT INTO public.graduation_types (name) VALUES
('UG-FT-ACADEMIC'),
('UG-PT-ACADEMIC'),
('PG-FT-ACADEMIC'),
('PG-PT-ACADEMIC'),
('UG-FT-RESEARCH'),
('PG-FT-RESEARCH'),
('PG-PT-RESEARCH');

-- Insert course data (based on your Excel sample and existing data)
INSERT INTO public.courses (code, name, title, credits) VALUES
-- Core CSE Courses
('21CSC204J', 'DESIGN AND ANALYSIS OF ALGORITHMS', 'DESIGN AND ANALYSIS OF ALGORITHMS', 4),
('21CSC201J', 'DATA STRUCTURES AND ALGORITHMS', 'DATA STRUCTURES AND ALGORITHMS', 4),
('21CSC202J', 'OPERATING SYSTEMS', 'OPERATING SYSTEMS', 4),
('21CSC203P', 'ADVANCED PROGRAMMING PRACTICE', 'ADVANCED PROGRAMMING PRACTICE', 4),
('21CSC205P', 'DATABASE MANAGEMENT SYSTEMS', 'DATABASE MANAGEMENT SYSTEMS', 4),
('21CSC206T', 'ARTIFICIAL INTELLIGENCE', 'ARTIFICIAL INTELLIGENCE', 4),
('21CSC301T', 'FORMAL LANGUAGE AND AUTOMATA', 'FORMAL LANGUAGE AND AUTOMATA', 4),
('21CSC302J', 'COMPUTER NETWORKS', 'COMPUTER NETWORKS', 4),
('21CSC305P', 'MACHINE LEARNING', 'MACHINE LEARNING', 4),
('21CSS101J', 'PROGRAMMING FOR PROBLEM SOLVING', 'PROGRAMMING FOR PROBLEM SOLVING', 4),
('21CSS201T', 'COMPUTER ORGANIZATION AND ARCHITECTURE', 'COMPUTER ORGANIZATION AND ARCHITECTURE', 4),

-- Elective Courses
('21CSE251T', 'DIGITAL IMAGE PROCESSING', 'DIGITAL IMAGE PROCESSING', 3),
('21CSE253T', 'INTERNET OF THINGS', 'INTERNET OF THINGS', 3),
('21CSE254T', 'BIO INSPIRED COMPUTING', 'BIO INSPIRED COMPUTING', 3),
('21CSE255T', 'COMPUTER GRAPHICS AND ANIMATION', 'COMPUTER GRAPHICS AND ANIMATION', 3),
('21CSE292P', 'ARTIFICIAL INTELLIGENCE OF THINGS', 'ARTIFICIAL INTELLIGENCE OF THINGS', 3),
('21CSE296P', 'IOS APP PROTOTYPE DESIGN AND DEVELOPMENT', 'IOS APP PROTOTYPE DESIGN AND DEVELOPMENT', 3),
('21CSE297P', 'IOS APP DEVELOPMENT SKILLS', 'IOS APP DEVELOPMENT SKILLS', 3),
('21CSE303P', 'INTRODUCTION TO PRODUCT DESIGN AND INNOVATION', 'INTRODUCTION TO PRODUCT DESIGN AND INNOVATION', 3),
('21CSE306J', 'QUANTUM COMPUTATION', 'QUANTUM COMPUTATION', 3),
('21CSE306P', 'APPLIED GENERATIVE AI', 'APPLIED GENERATIVE AI', 3),
('21CSE307J', 'QUANTUM MACHINE LEARNING', 'QUANTUM MACHINE LEARNING', 3),
('21CSE308J', 'OFFENSIVE SECURITY', 'OFFENSIVE SECURITY', 3),
('21CSE311J', 'CLOUD BASED REMOTE SENSING AND GIS', 'CLOUD BASED REMOTE SENSING AND GIS', 3),
('21CSE324P', 'NP COMPLETENESS AND BEYOND', 'NP COMPLETENESS AND BEYOND', 3),
('21CSE325P', 'QUANTUM COMMUNICATION AND CRYPTOGRAPHY', 'QUANTUM COMMUNICATION AND CRYPTOGRAPHY', 3),
('21CSE351T', 'COMPUTATIONAL LOGIC', 'COMPUTATIONAL LOGIC', 3),
('21CSE354T', 'FULL STACK WEB DEVELOPMENT', 'FULL STACK WEB DEVELOPMENT', 3),
('21CSE359T', 'INFORMATION STORAGE AND MANAGEMENT', 'INFORMATION STORAGE AND MANAGEMENT', 3),
('21CSE361T', 'DATABASE SECURITY AND PRIVACY', 'DATABASE SECURITY AND PRIVACY', 3),
('21CSE388T', 'INFORMATION VISUALIZATION', 'INFORMATION VISUALIZATION', 3),
('21CSE390T', 'VIRTUALIZATION AND HYPER CONVERGED INFRASTRUCTURE', 'VIRTUALIZATION AND HYPER CONVERGED INFRASTRUCTURE', 3),
('21CSE395P', 'PRINCIPLES OF UX / UI DESIGN', 'PRINCIPLES OF UX / UI DESIGN', 3),
('21CSE399J', 'COMPREHENSIVE LINUX FOR ALL', 'COMPREHENSIVE LINUX FOR ALL', 3),
('21CSO361P', 'IDEA GENERATION APP DESIGN', 'IDEA GENERATION APP DESIGN', 3),

-- Mathematics Courses
('21MAB101T', 'CALCULUS AND LINEAR ALGEBRA', 'CALCULUS AND LINEAR ALGEBRA', 4),
('21MAB102T', 'ADVANCED CALCULUS AND COMPLEX ANALYSIS', 'ADVANCED CALCULUS AND COMPLEX ANALYSIS', 4),
('21MAB201T', 'TRANSFORMS AND BOUNDARY VALUE PROBLEMS', 'TRANSFORMS AND BOUNDARY VALUE PROBLEMS', 4),
('21MAB204T', 'PROBABILITY AND QUEUEING THEORY', 'PROBABILITY AND QUEUEING THEORY', 4),
('21MAB302T', 'DISCRETE MATHEMATICS', 'DISCRETE MATHEMATICS', 4),

-- Language and Communication Courses
('21LEH101T', 'COMMUNICATIVE ENGLISH', 'COMMUNICATIVE ENGLISH', 3),
('21LEH102T', 'CHINESE', 'CHINESE', 3),
('21LEH105T', 'JAPANESE', 'JAPANESE', 3),
('21LEM101T', 'CONSTITUTION OF INDIA', 'CONSTITUTION OF INDIA', 3),
('21LEM201T', 'PROFESSIONAL ETHICS', 'PROFESSIONAL ETHICS', 3),
('21LEM202T', 'UNIVERSAL HUMAN VALUES - II: UNDERSTANDING HARMONY AND ETHICAL HUMAN CONDUCT', 'UNIVERSAL HUMAN VALUES - II: UNDERSTANDING HARMONY AND ETHICAL HUMAN CONDUCT', 3),
('21LEM301T', 'INDIAN ART FORM', 'INDIAN ART FORM', 3),

-- Professional Development Courses
('21PDM101L', 'PROFESSIONAL SKILLS AND PRACTICES', 'PROFESSIONAL SKILLS AND PRACTICES', 0),
('21PDM102L', 'GENERAL APTITUDE', 'GENERAL APTITUDE', 0),
('21PDM201L', 'VERBAL REASONING', 'VERBAL REASONING', 0),
('21PDM202L', 'CRITICAL AND CREATIVE THINKING SKILLS', 'CRITICAL AND CREATIVE THINKING SKILLS', 0),
('21PDH201T', 'SOCIAL ENGINEERING', 'SOCIAL ENGINEERING', 2),

-- Science Courses
('21CYB101J', 'CHEMISTRY', 'CHEMISTRY', 4),
('21CYM101T', 'ENVIRONMENTAL SCIENCE', 'ENVIRONMENTAL SCIENCE', 3),
('21PYB102J', 'SEMICONDUCTOR PHYSICS AND COMPUTATIONAL METHODS', 'SEMICONDUCTOR PHYSICS AND COMPUTATIONAL METHODS', 4),

-- Other Engineering Courses
('21ASO301T', 'ELEMENTS OF AERONAUTICS', 'ELEMENTS OF AERONAUTICS', 3),
('21AUO101T', 'HYBRID AND ELECTRIC VEHICLES', 'HYBRID AND ELECTRIC VEHICLES', 3),
('21BMO121T', 'FUNDAMENTALS OF BIOMEDICAL ENGINEERING', 'FUNDAMENTALS OF BIOMEDICAL ENGINEERING', 3),
('21BTB102T', 'INTRODUCTION TO COMPUTATIONAL BIOLOGY', 'INTRODUCTION TO COMPUTATIONAL BIOLOGY', 3),
('21BTO101T', 'HUMAN HEALTH AND DISEASES', 'HUMAN HEALTH AND DISEASES', 3),
('21CEO307T', 'MUNICIPAL SOLID WASTE MANAGEMENT', 'MUNICIPAL SOLID WASTE MANAGEMENT', 3),
('21CEO308T', 'DISASTER MITIGATION AND MANAGEMENT', 'DISASTER MITIGATION AND MANAGEMENT', 3),
('21CEO309T', 'WATER POLLUTION AND ITS MANAGEMENT', 'WATER POLLUTION AND ITS MANAGEMENT', 3),
('21CEO310T', 'GLOBAL WARMING AND CLIMATE CHANGE', 'GLOBAL WARMING AND CLIMATE CHANGE', 3),
('21ECO101T', 'SHORT RANGE WIRELESS COMMUNICATION', 'SHORT RANGE WIRELESS COMMUNICATION', 3),
('21ECO102J', 'ELECTRONIC CIRCUITS AND SYSTEMS', 'ELECTRONIC CIRCUITS AND SYSTEMS', 4),
('21ECO103T', 'MODERN WIRELESS COMMUNICATION SYSTEMS', 'MODERN WIRELESS COMMUNICATION SYSTEMS', 3),
('21ECO104J', 'PCB DESIGN AND MANUFACTURING', 'PCB DESIGN AND MANUFACTURING', 4),
('21ECO105T', 'FIBER OPTICS AND OPTOELECTRONICS', 'FIBER OPTICS AND OPTOELECTRONICS', 3),
('21ECO106J', 'EMBEDDED SYSTEM DESIGN USING ARDUINO', 'EMBEDDED SYSTEM DESIGN USING ARDUINO', 4),
('21ECO107J', 'EMBEDDED SYSTEM DESIGN USING RASPBERRY PI', 'EMBEDDED SYSTEM DESIGN USING RASPBERRY PI', 4),
('21EEO301T', 'E-MOBILITY', 'E-MOBILITY', 3),
('21EEO303T', 'E-WASTE MANAGEMENT', 'E-WASTE MANAGEMENT', 3),
('21EEO305T', 'SURVEILLANCE TECHNOLOGY', 'SURVEILLANCE TECHNOLOGY', 3),
('21EEO307T', 'CLEAN AND GREEN ENERGY', 'CLEAN AND GREEN ENERGY', 3),
('21EES101T', 'ELECTRICAL AND ELECTRONICS ENGINEERING', 'ELECTRICAL AND ELECTRONICS ENGINEERING', 4),
('21GEO101T', 'BEHAVIORAL BIOLOGY', 'BEHAVIORAL BIOLOGY', 3),
('21GEO102T', 'MICROBES AND SOCIETY', 'MICROBES AND SOCIETY', 3),
('21GNH101J', 'PHILOSOPHY OF ENGINEERING', 'PHILOSOPHY OF ENGINEERING', 3),
('21GNM101L', 'PHYSICAL AND MENTAL HEALTH USING YOGA', 'PHYSICAL AND MENTAL HEALTH USING YOGA', 0),
('21GNP301L', 'COMMUNITY CONNECT', 'COMMUNITY CONNECT', 0),
('21IPE335J', 'FUNCTIONAL TESTING AND PROGRAMMING', 'FUNCTIONAL TESTING AND PROGRAMMING', 4),
('21IPE401J', 'CAPSTONE PROGRAM IN ELECTRONIC COOLING', 'CAPSTONE PROGRAM IN ELECTRONIC COOLING', 4),
('21IPE416T', 'SCRIPTING AND APPLICATION DEVELOPMENT FUNDAMENTALS', 'SCRIPTING AND APPLICATION DEVELOPMENT FUNDAMENTALS', 3),
('21MEO101T', 'FUNDAMENTALS OF COMPOSITE MATERIALS', 'FUNDAMENTALS OF COMPOSITE MATERIALS', 3),
('21MEO102T', 'REVERSE ENGINEERING AND 3D PRINTING', 'REVERSE ENGINEERING AND 3D PRINTING', 3),
('21MEO104T', 'TQM AND RELIABILITY ENGINEERING', 'TQM AND RELIABILITY ENGINEERING', 3),
('21MEO106T', 'INTRODUCTION TO ROBOTICS', 'INTRODUCTION TO ROBOTICS', 3),
('21MEO110T', 'ENERGY SYSTEMS FOR SUSTAINABLE BUILDINGS', 'ENERGY SYSTEMS FOR SUSTAINABLE BUILDINGS', 3),
('21MEO113J', 'ELECTRONICS THERMAL MANAGEMENT', 'ELECTRONICS THERMAL MANAGEMENT', 4),
('21MES101L', 'BASIC CIVIL AND MECHANICAL WORKSHOP', 'BASIC CIVIL AND MECHANICAL WORKSHOP', 0),
('21MES102L', 'ENGINEERING GRAPHICS AND DESIGN', 'ENGINEERING GRAPHICS AND DESIGN', 0),
('21MGO101T', 'EMOTIONAL INTELLIGENCE', 'EMOTIONAL INTELLIGENCE', 3),
('21MGO104T', 'STRESS MANAGEMENT', 'STRESS MANAGEMENT', 3),
('21MGO107T', 'FLEXIBLE WORK MODELS AND EMPLOYEE WELL-BEING', 'FLEXIBLE WORK MODELS AND EMPLOYEE WELL-BEING', 3),
('21NTO301T', 'APPLICATIONS OF NANOTECHNOLOGY', 'APPLICATIONS OF NANOTECHNOLOGY', 3),
('21NTO304T', 'ENVIRONMENTAL NANOTECHNOLOGY', 'ENVIRONMENTAL NANOTECHNOLOGY', 3),
('21NTO307T', 'NANOCOMPUTING', 'NANOCOMPUTING', 3),
('21NTO308T', 'SMART SENSOR SYSTEMS', 'SMART SENSOR SYSTEMS', 3),
('21DCO101P', 'ENTREPRENEURSHIP BOOTCAMP', 'ENTREPRENEURSHIP BOOTCAMP', 3),
('21DCS201P', 'DESIGN THINKING AND METHODOLOGY', 'DESIGN THINKING AND METHODOLOGY', 3),
('CSV0660J', 'FULL-STACK WEB DEVELOPMENT', 'FULL-STACK WEB DEVELOPMENT', 4);

-- =====================================================
-- STEP 9: CREATE ANALYTICS VIEWS AND OPTIMIZED QUERIES
-- =====================================================

-- Create a comprehensive view for grades with all student and course information
CREATE VIEW public.grades_with_details AS
SELECT 
    g.id as grade_id,
    g.student_id,
    g.course_id,
    g.grade,
    g.is_passed,
    g.mode_of_attempt,
    g.created_at as grade_created_at,
    g.updated_at as grade_updated_at,
    s.register_number,
    s.name as student_name,
    s.batch,
    s.semester,
    s.office_name,
    s.degree,
    s.branch_of_study,
    s.graduation_type,
    c.code as course_code,
    c.name as course_name,
    c.title as course_title,
    c.credits
FROM public.grades g
JOIN public.students s ON g.student_id = s.id
JOIN public.courses c ON g.course_id = c.id;

-- Create a view for course performance with student details
CREATE VIEW public.course_performance_with_students AS
SELECT 
    c.id as course_id,
    c.code as course_code,
    c.name as course_name,
    c.title as course_title,
    c.credits,
    s.id as student_id,
    s.register_number,
    s.name as student_name,
    s.batch,
    s.semester,
    s.office_name,
    s.degree,
    s.branch_of_study,
    s.graduation_type,
    g.grade,
    g.is_passed,
    g.mode_of_attempt
FROM public.courses c
LEFT JOIN public.grades g ON c.id = g.course_id
LEFT JOIN public.students s ON g.student_id = s.id;

-- Create a view for semester-wise analytics
CREATE VIEW public.semester_analytics AS
SELECT 
    s.semester,
    s.batch,
    COUNT(DISTINCT s.id) as total_students,
    COUNT(g.id) as total_grades,
    COUNT(CASE WHEN g.is_passed = true THEN 1 END) as passed_grades,
    COUNT(CASE WHEN g.is_passed = false THEN 1 END) as failed_grades,
    ROUND(
        COUNT(CASE WHEN g.is_passed = true THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(g.id), 0) * 100, 2
    ) as pass_percentage,
    AVG(CASE 
        WHEN g.grade = 'O' THEN 10.0
        WHEN g.grade = 'A+' THEN 9.0
        WHEN g.grade = 'A' THEN 8.0
        WHEN g.grade = 'B+' THEN 7.0
        WHEN g.grade = 'B' THEN 6.0
        WHEN g.grade = 'C+' THEN 5.0
        WHEN g.grade = 'C' THEN 4.0
        WHEN g.grade = 'D' THEN 3.0
        WHEN g.grade = 'F' THEN 0.0
        ELSE NULL
    END) as average_grade_points
FROM public.students s
LEFT JOIN public.grades g ON s.id = g.student_id
GROUP BY s.semester, s.batch
ORDER BY s.batch, s.semester;

-- View for student performance summary
CREATE VIEW public.student_performance_summary AS
SELECT 
    s.id,
    s.register_number,
    s.name,
    s.batch,
    s.semester,
    s.office_name,
    s.degree,
    s.branch_of_study,
    s.graduation_type,
    COUNT(e.id) as total_courses,
    COUNT(CASE WHEN e.grade IN ('O', 'A+', 'A', 'B+', 'B', 'C+', 'C') THEN 1 END) as passed_courses,
    COUNT(CASE WHEN e.grade IN ('D', 'F', 'RA', 'AB', 'W', 'I', 'Absent', 'ABSENT') THEN 1 END) as failed_courses,
    SUM(c.credits) as total_credits,
    SUM(CASE WHEN e.grade IN ('O', 'A+', 'A', 'B+', 'B', 'C+', 'C') THEN c.credits ELSE 0 END) as earned_credits,
    public.calculate_student_gpa(s.id) as gpa,
    MAX(e.semester) as current_semester
FROM public.students s
LEFT JOIN public.enrollments e ON s.id = e.student_id
LEFT JOIN public.courses c ON e.course_id = c.id
GROUP BY s.id, s.register_number, s.name, s.batch, s.semester, s.office_name, s.degree, s.branch_of_study, s.graduation_type;

-- View for course performance summary
CREATE VIEW public.course_performance_summary AS
SELECT 
    c.id,
    c.code,
    c.name,
    c.title,
    c.credits,
    COUNT(e.id) as total_enrollments,
    COUNT(CASE WHEN e.grade IN ('O', 'A+', 'A', 'B+', 'B', 'C+', 'C') THEN 1 END) as passed_enrollments,
    COUNT(CASE WHEN e.grade IN ('D', 'F', 'RA', 'AB', 'W', 'I', 'Absent', 'ABSENT') THEN 1 END) as failed_enrollments,
    ROUND(
        COUNT(CASE WHEN e.grade IN ('O', 'A+', 'A', 'B+', 'B', 'C+', 'C') THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(e.id), 0) * 100, 2
    ) as pass_percentage,
    AVG(CASE 
        WHEN e.grade = 'O' THEN 10.0
        WHEN e.grade = 'A+' THEN 9.0
        WHEN e.grade = 'A' THEN 8.0
        WHEN e.grade = 'B+' THEN 7.0
        WHEN e.grade = 'B' THEN 6.0
        WHEN e.grade = 'C+' THEN 5.0
        WHEN e.grade = 'C' THEN 4.0
        WHEN e.grade = 'D' THEN 3.0
        WHEN e.grade = 'F' THEN 0.0
        ELSE NULL
    END) as average_grade_points
FROM public.courses c
LEFT JOIN public.enrollments e ON c.id = e.course_id
GROUP BY c.id, c.code, c.name, c.title, c.credits;

-- View for semester-wise performance
CREATE VIEW public.semester_performance AS
SELECT 
    e.semester,
    e.batch,
    COUNT(DISTINCT e.student_id) as total_students,
    COUNT(e.id) as total_enrollments,
    COUNT(CASE WHEN e.grade IN ('O', 'A+', 'A', 'B+', 'B', 'C+', 'C') THEN 1 END) as passed_enrollments,
    COUNT(CASE WHEN e.grade IN ('D', 'F', 'RA', 'AB', 'W', 'I', 'Absent', 'ABSENT') THEN 1 END) as failed_enrollments,
    ROUND(
        COUNT(CASE WHEN e.grade IN ('O', 'A+', 'A', 'B+', 'B', 'C+', 'C') THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(e.id), 0) * 100, 2
    ) as pass_percentage,
    AVG(CASE 
        WHEN e.grade = 'O' THEN 10.0
        WHEN e.grade = 'A+' THEN 9.0
        WHEN e.grade = 'A' THEN 8.0
        WHEN e.grade = 'B+' THEN 7.0
        WHEN e.grade = 'B' THEN 6.0
        WHEN e.grade = 'C+' THEN 5.0
        WHEN e.grade = 'C' THEN 4.0
        WHEN e.grade = 'D' THEN 3.0
        WHEN e.grade = 'F' THEN 0.0
        ELSE NULL
    END) as average_grade_points
FROM public.enrollments e
GROUP BY e.semester, e.batch
ORDER BY e.batch, e.semester;

-- =====================================================
-- STEP 10: INSERT SAMPLE DATA (Based on your Excel)
-- =====================================================

-- Insert sample student data
INSERT INTO public.students (register_number, name, batch, semester, office_name, degree, branch_of_study, graduation_type, office_id, degree_id, branch_id, graduation_type_id) VALUES
('RA2211003010001', 'P MANVITHA RAYAL', 2022, 4,
 'Faculty of Engineering and Technology, Kattankulathur', 'B.Tech.', 'Computer Science and Engineering', 'UG-FT-ACADEMIC',
 (SELECT id FROM public.offices WHERE name = 'Faculty of Engineering and Technology, Kattankulathur'),
 (SELECT id FROM public.degrees WHERE abbreviation = 'B.Tech.'),
 (SELECT id FROM public.branches WHERE name = 'Computer Science and Engineering'),
 (SELECT id FROM public.graduation_types WHERE name = 'UG-FT-ACADEMIC'));

-- Insert sample enrollment data
INSERT INTO public.enrollments (student_id, course_id, semester, batch, grade, mode_of_attempt) VALUES
-- Student RA2211003010001 enrollments
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21CSC204J'), 4, 2022, 'A+', 'Regular'),
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21PDM202L'), 4, 2022, 'A+', 'Regular'),
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21PDH201T'), 4, 2022, 'O', 'Regular'),
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21MAB204T'), 4, 2022, 'A+', 'Regular'),
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21LEM202T'), 4, 2022, 'A+', 'Regular'),
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21CSE253T'), 4, 2022, 'O', 'Regular');

-- Insert sample grades data (for backward compatibility)
INSERT INTO public.grades (student_id, course_id, grade, is_passed, mode_of_attempt) VALUES
-- Student RA2211003010001 grades
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21CSC204J'), 'A+', true, 'Regular'),
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21PDM202L'), 'A+', true, 'Regular'),
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21PDH201T'), 'O', true, 'Regular'),
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21MAB204T'), 'A+', true, 'Regular'),
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21LEM202T'), 'A+', true, 'Regular'),
((SELECT id FROM public.students WHERE register_number = 'RA2211003010001'),
 (SELECT id FROM public.courses WHERE code = '21CSE253T'), 'O', true, 'Regular');

-- =====================================================
-- STEP 11: CONFIGURE VIEW SECURITY
-- =====================================================

-- Enable RLS on views (after they are created)
ALTER VIEW public.grades_with_details SET (security_invoker = true);
ALTER VIEW public.course_performance_with_students SET (security_invoker = true);
ALTER VIEW public.semester_analytics SET (security_invoker = true);

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

-- The database has been successfully recreated with:
-- 1. Normalized schema with proper relationships
-- 2. Authentication and RLS policies for srmist.edu.in users
-- 3. Performance indexes and triggers
-- 4. Analytics functions and views
-- 5. Sample data matching your Excel format
-- 6. Ready for bulk data import from Excel files

SELECT 'Database recreation completed successfully!' as status;
