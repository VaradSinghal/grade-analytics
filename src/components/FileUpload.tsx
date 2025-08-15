import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

interface StudentRecord {
  register_number: string;
  name: string;
  semester: number;
  batch: string;
  degree: string;
  [courseCode: string]: any;
}

export const FileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const processExcelData = useCallback(async (file: File) => {
    try {
      setUploading(true);
      setUploadStatus('idle');

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (jsonData.length === 0) {
        throw new Error('No data found in the Excel file');
      }

      const headers = jsonData[0];
      console.log('Excel headers:', headers);

     
      const records = jsonData.slice(1).map(row => {
        const record: any = {};
        headers.forEach((header: string, index: number) => {
          record[header] = row[index];
        });
        return record;
      });

      console.log('Sample record:', records[0]);

      const { data: courses } = await supabase
        .from('courses')
        .select('id, code, name');

      const courseMap = new Map(courses?.map(c => [c.code, c.id]) || []);
      console.log('Available course codes:', Array.from(courseMap.keys()));

      
      const courseColumns = headers.filter((header: string) => {
        if (!header) return false;
 
        const courseCode = header.split(' - ')[0].trim();
        const hasCourseCode = courseMap.has(courseCode);
        if (hasCourseCode) {
          console.log('Found course column:', header, '-> Course code:', courseCode);
        }
        return hasCourseCode;
      });

      console.log('Course columns found:', courseColumns);

      let gradesProcessed = 0;

      for (const record of records) {

        if (!record.register_number && !record.name) continue;

        const registerNumber = String(record.register_number || '').trim();
        const name = String(record.name || '').trim();
        const semester = Number(record.semester) || 0;
        const batch = String(record.batch || '').trim();
        const degree = String(record.degree || '').trim();

        
        if (!registerNumber || !name) {
          console.log('Skipping row - missing data:', { registerNumber, name, record });
          continue;
        }

        console.log('Processing student:', registerNumber, name);

        const { data: student, error: studentError } = await supabase
          .from('students')
          .upsert({
            register_number: registerNumber,
            name: name,
            semester: semester,
            batch: batch,
            degree: degree,
          }, {
            onConflict: 'register_number'
          })
          .select()
          .single();

        if (studentError) {
          console.error('Error inserting student:', studentError);
          continue;
        }

   
        for (const courseColumn of courseColumns) {
          const gradeValue = record[courseColumn];
          
          if (!gradeValue || gradeValue === '' || gradeValue === null || gradeValue === undefined) {
            continue;
          }

    
          const courseCode = courseColumn.split(' - ')[0].trim();
          const courseId = courseMap.get(courseCode);

          if (courseId) {
            const grade = String(gradeValue).trim();
            

            const passingGrades = ['O', 'A+', 'A', 'B+', 'B', 'C+', 'C'];
            const failingGrades = ['D', 'F', 'Fail', 'FAIL', 'fail', 'U', 'RA', 'Ab', 'AB', 'ab', 'Absent', 'ABSENT', 'W', 'I','Wh','WH'];

            let isPassed = false;
            if (passingGrades.includes(grade)) {
              isPassed = true;
            } else if (failingGrades.includes(grade)) {
              isPassed = false;
            } else {
          
              isPassed = !failingGrades.some(fail => grade.toLowerCase().includes(fail.toLowerCase()));
            }

            console.log(`Inserting grade: Student=${student.register_number}, Course=${courseCode}, Grade=${grade}, Passed=${isPassed}`);

            const { data: gradeData, error: gradeError } = await supabase
              .from('grades')
              .upsert({
                student_id: student.id,
                course_id: courseId,
                grade: grade,
                is_passed: isPassed,
              }, {
                onConflict: 'student_id,course_id'
              })
              .select();

            if (gradeError) {
              console.error('Error inserting grade:', gradeError, {
                student_id: student.id,
                course_id: courseId,
                grade: grade
              });
            } else {
              gradesProcessed++;
            }
          }
        }
      }

      setUploadStatus('success');
      toast({
        title: "Upload Successful",
        description: `Successfully processed ${records.length} student records and ${gradesProcessed} grades.`,
      });

      console.log(`Total grades processed: ${gradesProcessed}`);

    } catch (error) {
      console.error('Error processing file:', error);
      setUploadStatus('error');
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An error occurred while processing the file.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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
              {uploadStatus === 'success' ? (
                <CheckCircle className="h-12 w-12 text-success" />
              ) : uploadStatus === 'error' ? (
                <AlertCircle className="h-12 w-12 text-destructive" />
              ) : (
                <Upload className={`h-12 w-12 ${uploading ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
              )}
              
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {uploading ? 'Processing...' : 'Drop your Excel file here'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  or click to browse and select your file
                </p>
                
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
            <h4 className="font-semibold mb-2 text-foreground">File Requirements:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Excel file (.xlsx or .xls format)</li>
              <li>• Contains columns: register_number, name, semester, batch, degree</li>
              <li>• Course grades in columns with course codes (e.g., 21CSC101T - CourseName)</li>
              <li>• Can handle thousands of student records</li>
              <li>• Wait for the file to be processed</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};