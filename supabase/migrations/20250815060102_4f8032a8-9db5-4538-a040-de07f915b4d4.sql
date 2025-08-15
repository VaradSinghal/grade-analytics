-- Update existing grades to have correct is_passed values
UPDATE grades 
SET is_passed = CASE 
  WHEN grade IN ('O', 'A+', 'A', 'B+', 'B', 'C+', 'C') THEN true
  WHEN grade IN ('D', 'F', 'Fail', 'FAIL', 'fail', 'U', 'RA', 'Ab', 'AB', 'ab', 'Absent', 'ABSENT', 'W', 'I') THEN false
  ELSE false -- Default unknown grades to false for safety
END;