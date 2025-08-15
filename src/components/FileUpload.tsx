import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

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

  const processExcelData = useCallback(async (file: File) => {
    try {
      setUploading(true);
      setProgress(0);
      setUploadStatus('Reading Excel file...');

      const data = await file.arrayBuffer();
      setProgress(10);
      
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as StudentRecord[];

      if (jsonData.length === 0) {
        throw new Error('Excel file is empty');
      }

      setProgress(20);
      setUploadStatus(`Processing ${jsonData.length} records...`);

      // Get unique course information from the data
      const courseMap = new Map<string, { title: string; credits: number }>();
      
      jsonData.forEach(record => {
        if (record['Course Code'] && record['Course Title'] && record['Credits']) {
          courseMap.set(record['Course Code'], {
            title: record['Course Title'],
            credits: record['Credits']
          });
        }
      });

      // Verify courses exist in database and insert new ones
      setProgress(30);
      setUploadStatus('Validating courses...');
      
      const courseCodes = Array.from(courseMap.keys());
      const { data: existingCourses, error: coursesError } = await supabase
        .from('courses')
        .select('code')
        .in('code', courseCodes);

      if (coursesError) {
        throw new Error(`Error checking courses: ${coursesError.message}`);
      }

      const existingCourseCodes = new Set(existingCourses?.map(c => c.code) || []);
      const newCourses = courseCodes.filter(code => !existingCourseCodes.has(code));

      // Insert new courses
      if (newCourses.length > 0) {
        setUploadStatus(`Creating ${newCourses.length} new courses...`);
        const coursesToInsert = newCourses.map(code => {
          const courseInfo = courseMap.get(code)!;
          return {
            code,
            name: courseInfo.title,
            credits: courseInfo.credits
          };
        });

        const { error: insertCoursesError } = await supabase
          .from('courses')
          .insert(coursesToInsert);

        if (insertCoursesError) {
          throw new Error(`Error inserting courses: ${insertCoursesError.message}`);
        }
      }

      setProgress(40);
      setUploadStatus('Processing student data...');

      // Process students with new fields
      const studentsToUpsert = jsonData.map(record => ({
        register_number: record['Register No'],
        name: record['Student Name'],
        semester: record['Semester'],
        batch: record['Batch'],
        degree: record['Degree'],
        office_name: record['Office Name'],
        branch_of_study: record['Branch of Study'],
        graduation_type: record['Graduation Type']
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
        students?.forEach(s => studentIdMap.set(s.register_number, s.id));
        
        // Update progress
        const batchProgress = 60 + (i / uniqueStudents.length) * 5;
        setProgress(batchProgress);
        setUploadStatus(`Mapping student IDs... ${Math.min(i + batchSize, uniqueStudents.length)}/${uniqueStudents.length}`);
      }

      // Get course IDs
      setProgress(65);
      setUploadStatus('Mapping course IDs...');
      
      const { data: courses, error: getCoursesError } = await supabase
        .from('courses')
        .select('id, code')
        .in('code', courseCodes);

      if (getCoursesError) {
        throw new Error(`Error getting courses: ${getCoursesError.message}`);
      }

      const courseIdMap = new Map(courses?.map(c => [c.code, c.id]) || []);

      // Process grades with mode of attempt
      setProgress(70);
      setUploadStatus('Processing grades...');
      
      const gradesToUpsert: any[] = [];
      let processedCount = 0;

      jsonData.forEach((record, index) => {
        // Update progress every 100 records
        if (index % 100 === 0) {
          const gradeProgress = 70 + (index / jsonData.length) * 20;
          setProgress(gradeProgress);
          setUploadStatus(`Processing grades... ${index}/${jsonData.length}`);
        }
        const studentId = studentIdMap.get(record['Register No']);
        const courseId = courseIdMap.get(record['Course Code']);
        
        if (studentId && courseId && record['Grade']) {
          const grade = record['Grade'].toString().trim();
          if (grade !== '') {
            // Determine if student passed (not F, Ab, or similar failing grades)
            const isPassed = !['F', 'AB', 'Ab', 'ab', 'WH', 'Wh', 'wh'].includes(grade.toUpperCase());
            
            gradesToUpsert.push({
              student_id: studentId,
              course_id: courseId,
              grade: grade,
              is_passed: isPassed,
              mode_of_attempt: record['Mode Of Attempt'] || 'Regular'
            });
          }
        }
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
                  disabled={uploading}
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="min-w-[200px]"
                >
                  {uploading ? 'Processing...' : 'Select Excel File'}
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