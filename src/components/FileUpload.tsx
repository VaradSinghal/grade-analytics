import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';

interface StudentRecord {
  'S.No': number;
  'Office Name': string;
  'Register No': string;
  'Student Name': string;
  'Semester': number;
  'Batch': string;
  'Degree': string;
  'Branch of Study': string;
  'Graduation Type': string;
  'Course Code': string;
  'Course Title': string;
  'Credits': number;
  'Grade': string;
  'Mode Of Attempt': string;
}

export const FileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const { userEmail, signInWithGoogle } = useSupabaseAuth();

  // Test database connection
  const testConnection = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('courses').select('count').limit(1);
      if (error) {
        console.error('Database connection test failed:', error);
        return false;
      }
      console.log('Database connection test successful');
      return true;
    } catch (error) {
      console.error('Database connection test error:', error);
      return false;
    }
  }, []);

  const processExcelData = useCallback(async (file: File) => {
    try {
      setUploading(true);
      setProgress(0);
      setUploadStatus('Testing database connection...');

      // Test database connection first
      const isConnected = await testConnection();
      if (!isConnected) {
        throw new Error('Cannot connect to database. Please check your internet connection and try again.');
      }

      setUploadStatus('Reading Excel file...');

      // Validate file type
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        throw new Error('Please upload a valid Excel file (.xlsx or .xls)');
      }

      const data = await file.arrayBuffer();
      setProgress(10);
      
      const workbook = XLSX.read(data, { cellDates: false, raw: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      // Auto-detect header row by scanning first 10 rows for required headers
      const requiredHeaderHints = [
        'S.No', 'Office Name', 'Register No', 'Student Name', 'Semester',
        'Batch', 'Degree', 'Branch of Study', 'Graduation Type',
        'Course Code', 'Course Title', 'Credits', 'Grade', 'Mode Of Attempt'
      ].map(h => h.toLowerCase());

      const range = XLSX.utils.decode_range(worksheet['!ref'] as string);
      let headerRowIndex = range.s.r; // start row
      const maxScan = Math.min(range.s.r + 10, range.e.r);
      for (let r = range.s.r; r <= maxScan; r++) {
        const rowValues: string[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
          if (cell && typeof cell.v !== 'undefined') {
            rowValues.push(String(cell.v).trim());
          }
        }
        const normalized = rowValues.map(v => v.toLowerCase());
        const score = requiredHeaderHints.filter(hint => normalized.includes(hint)).length;
        if (score >= 6) { // heuristically enough headers found
          headerRowIndex = r;
          break;
        }
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        range: headerRowIndex,
        header: 1,
        defval: '',
        blankrows: false,
      }) as any[];

      // Convert array-of-arrays into array-of-objects using detected header row
      if (jsonData.length < 2) {
        throw new Error('Could not detect data rows in the Excel file.');
      }
      const detectedHeaders = (jsonData[0] as string[]).map(h => String(h).trim());
      const rows = jsonData.slice(1) as any[];
      const records: StudentRecord[] = rows.map((row: any[]) => {
        const obj: any = {};
        detectedHeaders.forEach((key: string, idx: number) => {
          obj[key] = row[idx];
        });
        return obj as StudentRecord;
      });

      console.log('Detected header row at index (0-based):', headerRowIndex);
      console.log('Detected headers:', detectedHeaders);
      console.log('Excel data loaded:', records.length, 'records');
      console.log('Sample record:', records[0]);

      if (records.length === 0) {
        throw new Error('Excel file is empty');
      }

      setProgress(20);
      setUploadStatus(`Processing ${records.length} records...`);

      // Validate required columns - normalize column names for comparison
      const requiredColumns = [
        'S.No', 'Office Name', 'Register No', 'Student Name', 'Semester', 
        'Batch', 'Degree', 'Branch of Study', 'Graduation Type', 
        'Course Code', 'Course Title', 'Credits', 'Grade', 'Mode Of Attempt'
      ];
      
      const firstRecord = records[0];
      const actualColumns = Object.keys(firstRecord);
      
      console.log('Actual columns in Excel:', actualColumns);
      console.log('Required columns:', requiredColumns);
      
      // Check for missing columns (case-insensitive and trim whitespace)
      const normalizedActualColumns = actualColumns.map(col => col.trim());
      const missingColumns = requiredColumns.filter(requiredCol => 
        !normalizedActualColumns.some(actualCol => 
          actualCol.toLowerCase() === requiredCol.toLowerCase()
        )
      );
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}. Found columns: ${actualColumns.join(', ')}`);
      }

      // Get unique course information from the data
      const courseMap = new Map<string, { title?: string; credits?: number }>();
      
      // Create a mapping function to handle column name variations
      const getColumnValue = (record: any, columnName: string) => {
        const keys = Object.keys(record);
        const matchingKey = keys.find(key => 
          key.trim().toLowerCase() === columnName.toLowerCase()
        );
        return matchingKey ? record[matchingKey] : undefined;
      };

      const normalizeCourseCode = (code: any) => String(code ?? '')
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9]/g, '');
      const normalizeRegisterNumber = (reg: any) => String(reg ?? '').trim();

      const allCourseCodesSet = new Set<string>();
      records.forEach(record => {
        const courseCode = normalizeCourseCode(getColumnValue(record, 'Course Code'));
        if (!courseCode) return;
        allCourseCodesSet.add(courseCode);
        const courseTitle = getColumnValue(record, 'Course Title');
        const credits = getColumnValue(record, 'Credits');
        if (!courseMap.has(courseCode)) {
          courseMap.set(courseCode, { title: courseTitle, credits });
        } else {
          // backfill missing fields if later rows have them
          const existing = courseMap.get(courseCode)!;
          if (!existing.title && courseTitle) existing.title = courseTitle;
          if (existing.credits == null && credits != null) existing.credits = credits;
        }
      });

      console.log('Course map created:', courseMap.size, 'unique courses');

      // Verify courses exist in database and insert new ones
      setProgress(30);
      setUploadStatus('Validating courses...');
      
      const allCourseCodes = Array.from(allCourseCodesSet);
      console.log('Checking existing courses:', allCourseCodes);
      
      const { data: existingCourses, error: coursesError } = await supabase
        .from('courses')
        .select('code')
        .in('code', allCourseCodes);

      if (coursesError) {
        console.error('Courses error:', coursesError);
        throw new Error(`Error checking courses: ${coursesError.message}`);
      }

      const existingCourseCodes = new Set((existingCourses || []).map(c => normalizeCourseCode(c.code)));
      const newCourses = allCourseCodes.filter(code => !existingCourseCodes.has(normalizeCourseCode(code)));

      // Insert new courses (use upsert to avoid unique constraint errors)
      if (newCourses.length > 0) {
        setUploadStatus(`Creating ${newCourses.length} new courses...`);
        const coursesToInsert = newCourses.map(code => {
          const courseInfo = courseMap.get(code) || {};
          return {
            code,
            name: courseInfo.title || code,
            credits: courseInfo.credits ?? null
          };
        });

        const { error: insertCoursesError } = await supabase
          .from('courses')
          .upsert(coursesToInsert, { onConflict: 'code', ignoreDuplicates: true });

        if (insertCoursesError) {
          throw new Error(`Error inserting courses: ${insertCoursesError.message}`);
        }
      }

      setProgress(40);
      setUploadStatus('Processing student data...');

      // Process students with new fields using flexible column mapping
      const studentsToUpsert = records.map(record => ({
        register_number: normalizeRegisterNumber(getColumnValue(record, 'Register No')),
        name: getColumnValue(record, 'Student Name'),
        semester: getColumnValue(record, 'Semester'),
        batch: getColumnValue(record, 'Batch'),
        degree: getColumnValue(record, 'Degree'),
        office_name: getColumnValue(record, 'Office Name'),
        branch_of_study: getColumnValue(record, 'Branch of Study'),
        graduation_type: getColumnValue(record, 'Graduation Type')
      }));

      // Remove duplicates based on register_number
      const uniqueStudents = studentsToUpsert.reduce((acc, student) => {
        if (!acc.find(s => s.register_number === student.register_number)) {
          acc.push(student);
        }
        return acc;
      }, [] as typeof studentsToUpsert);

      // Upsert students
      setProgress(50);
      setUploadStatus(`Upserting ${uniqueStudents.length} students...`);
      
      const { error: studentsError } = await supabase
        .from('students')
        .upsert(uniqueStudents, {
          onConflict: 'register_number'
        });

      if (studentsError) {
        throw new Error(`Error upserting students: ${studentsError.message}`);
      }

      // Get student IDs in batches to avoid URL length limits
      setProgress(60);
      setUploadStatus('Mapping student IDs...');
      
      const studentIdMap = new Map<string, string>();
      const batchSize = 100; // Process 100 students at a time
      
      for (let i = 0; i < uniqueStudents.length; i += batchSize) {
        const batch = uniqueStudents.slice(i, i + batchSize);
        const registerNumbers = batch.map(s => s.register_number);
        
        const { data: students, error: getStudentsError } = await supabase
          .from('students')
          .select('id, register_number')
          .in('register_number', registerNumbers);

        if (getStudentsError) {
          throw new Error(`Error getting students batch ${Math.floor(i/batchSize) + 1}: ${getStudentsError.message}`);
        }

        // Add to map
        students?.forEach(s => studentIdMap.set(normalizeRegisterNumber(s.register_number), s.id));
        
        // Update progress
        const batchProgress = 60 + (i / uniqueStudents.length) * 5;
        setProgress(batchProgress);
        setUploadStatus(`Mapping student IDs... ${Math.min(i + batchSize, uniqueStudents.length)}/${uniqueStudents.length}`);
      }

      // Get course IDs
      setProgress(65);
      setUploadStatus('Mapping course IDs...');
      
      let { data: courses, error: getCoursesError } = await supabase
        .from('courses')
        .select('id, code')
        .in('code', allCourseCodes);

      if (getCoursesError) {
        throw new Error(`Error getting courses: ${getCoursesError.message}`);
      }
      console.log('Fetched courses count:', (courses || []).length);
      let courseIdMap = new Map((courses || []).map(c => [normalizeCourseCode(c.code), c.id]));

      // Fallback: if nothing fetched, force-create all codes and re-fetch
      if (courseIdMap.size === 0 && allCourseCodes.length > 0) {
        const fallbackInsert = allCourseCodes.map(code => ({ code, name: code, credits: null }));
        const { error: fallbackErr } = await supabase
          .from('courses')
          .upsert(fallbackInsert, { onConflict: 'code', ignoreDuplicates: true });
        if (fallbackErr) {
          throw new Error(`Error ensuring courses: ${fallbackErr.message}`);
        }
        const refetch = await supabase
          .from('courses')
          .select('id, code')
          .in('code', allCourseCodes);
        courses = refetch.data || [];
        courseIdMap = new Map((courses || []).map(c => [normalizeCourseCode(c.code), c.id]));
        console.log('Refetched courses count:', (courses || []).length);
      }

      // Process grades with mode of attempt
      setProgress(70);
      setUploadStatus('Processing grades...');
      
      const gradesToUpsert: any[] = [];
      let processedCount = 0;
      let missingStudentId = 0;
      let missingCourseId = 0;
      let missingOrEmptyGrade = 0;

      const missingExamples: any[] = [];
      records.forEach((record, index) => {
        // Update progress every 100 records
        if (index % 100 === 0) {
          const gradeProgress = 70 + (index / records.length) * 20;
          setProgress(gradeProgress);
          setUploadStatus(`Processing grades... ${index}/${records.length}`);
        }
        
        const registerNo = normalizeRegisterNumber(getColumnValue(record, 'Register No'));
        const courseCode = normalizeCourseCode(getColumnValue(record, 'Course Code'));
        const grade = getColumnValue(record, 'Grade');
        const modeOfAttempt = getColumnValue(record, 'Mode Of Attempt');
        
        const studentId = studentIdMap.get(registerNo);
        const courseId = courseIdMap.get(courseCode);
        
        if (studentId && courseId && grade) {
          const gradeStr = grade.toString().trim();
          if (gradeStr !== '') {
            // Determine if student passed (not F, Ab, or similar failing grades)
            const isPassed = !['F', 'AB', 'Ab', 'ab', 'WH', 'Wh', 'wh'].includes(gradeStr.toUpperCase());
            
            gradesToUpsert.push({
              student_id: studentId,
              course_id: courseId,
              grade: gradeStr,
              is_passed: isPassed,
              mode_of_attempt: modeOfAttempt || 'Regular'
            });
          }
          else {
            missingOrEmptyGrade++;
          }
        }
        else {
          if (!studentId) missingStudentId++;
          if (!courseId) {
            if (missingExamples.length < 5) {
              missingExamples.push({ raw: getColumnValue(record, 'Course Code'), normalized: courseCode });
            }
            missingCourseId++;
          }
          if (!grade) missingOrEmptyGrade++;
        }
      });

      console.log('Grade processing diagnostics:', {
        totalRows: records.length,
        gradesPrepared: gradesToUpsert.length,
        missingStudentId,
        missingCourseId,
        missingOrEmptyGrade,
        sampleMissingCourseCodes: missingExamples,
        availableCourseIdKeys: Array.from(courseIdMap.keys()).slice(0, 20)
      });

      // Upsert grades in batches to avoid timeouts
      if (gradesToUpsert.length > 0) {
        setProgress(90);
        setUploadStatus(`Saving ${gradesToUpsert.length} grades...`);
        
        const gradeBatchSize = 500; // Process 500 grades at a time
        for (let i = 0; i < gradesToUpsert.length; i += gradeBatchSize) {
          const batch = gradesToUpsert.slice(i, i + gradeBatchSize);
          
          const { error: gradesError } = await supabase
            .from('grades')
            .upsert(batch, {
              onConflict: 'student_id,course_id'
            });

          if (gradesError) {
            throw new Error(`Error upserting grades batch ${Math.floor(i/gradeBatchSize) + 1}: ${gradesError.message}`);
          }
          
          // Update progress
          const gradeProgress = 90 + (i / gradesToUpsert.length) * 10;
          setProgress(gradeProgress);
          setUploadStatus(`Saving grades... ${Math.min(i + gradeBatchSize, gradesToUpsert.length)}/${gradesToUpsert.length}`);
        }
      }

      setProgress(100);
      setUploadStatus(`Successfully processed ${uniqueStudents.length} students and ${gradesToUpsert.length} grades`);
      
      toast({
        title: "Upload Successful",
        description: `Successfully processed ${uniqueStudents.length} students and ${gradesToUpsert.length} grades.`,
      });

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setUploadStatus('');
        setUploading(false);
        setProgress(0);
      }, 3000);

    } catch (error) {
      console.error('Error processing Excel file:', error);
      setUploadStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An error occurred while processing the file.",
        variant: "destructive",
      });
      setUploading(false);
      setProgress(0);
    }
  }, [toast]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processExcelData(file);
    }
  }, [processExcelData]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type.includes('sheet')) {
      processExcelData(file);
    }
  }, [processExcelData]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto bg-gradient-card shadow-large">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Upload Student Data
          </CardTitle>
          <CardDescription className="text-base">
            Upload Excel files containing student records and grades. The system will automatically process 
            and analyze the data for comprehensive academic insights.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {!userEmail && (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="mb-3">Please sign in with your <span className="font-semibold">srmist.edu.in</span> account to upload data.</p>
              <Button variant="analytics" onClick={signInWithGoogle} className="min-w-[200px]">Sign in with Google</Button>
            </div>
          )}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
              uploading ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="flex flex-col items-center gap-4">
              {uploadStatus.includes('Successfully') ? (
                <CheckCircle className="h-12 w-12 text-success" />
              ) : uploadStatus.includes('Error') ? (
                <AlertCircle className="h-12 w-12 text-destructive" />
              ) : (
                <Upload className={`h-12 w-12 ${uploading ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
              )}
              
              <div className="w-full">
                <h3 className="text-lg font-semibold mb-2">
                  {uploading ? uploadStatus || 'Processing...' : 'Drop your Excel file here'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  or click to browse and select your file
                </p>
                
                {uploading && (
                  <div className="w-full mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Progress</span>
                      <span className="text-sm font-medium">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="w-full h-2" />
                  </div>
                )}
                
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                  id="file-upload"
                />
                
                <Button
                  variant="analytics"
                  size="lg"
                  disabled={uploading || !userEmail}
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="min-w-[200px]"
                >
                  {userEmail ? (uploading ? 'Processing...' : 'Select Excel File') : 'Sign in to upload'}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-foreground">Required Excel Columns:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• S.No</li>
              <li>• Office Name</li>
              <li>• Register No</li>
              <li>• Student Name</li>
              <li>• Semester</li>
              <li>• Batch</li>
              <li>• Degree</li>
              <li>• Branch of Study</li>
              <li>• Graduation Type</li>
              <li>• Course Code</li>
              <li>• Course Title</li>
              <li>• Credits</li>
              <li>• Grade</li>
              <li>• Mode Of Attempt</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};