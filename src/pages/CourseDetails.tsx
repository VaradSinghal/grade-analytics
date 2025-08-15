import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Users, BookOpen, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Course {
  id: string;
  code: string;
  name: string;
  credits?: number;
}

interface StudentGrade {
  id: string;
  register_number: string;
  name: string;
  semester: number;
  batch: string;
  degree: string;
  office_name?: string;
  branch_of_study?: string;
  graduation_type?: string;
  grade: string;
  is_passed: boolean;
  mode_of_attempt?: string;
}

export const CourseDetails = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      loadStudentGrades();
    }
  }, [selectedCourse]);

  const loadCourses = async () => {
    try {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .order('code');

      if (coursesData) {
        setCourses(coursesData);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentGrades = async () => {
    if (!selectedCourse) return;

    try {
      setLoadingStudents(true);
      
      // Get all grades for the selected course
      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select(`
          student_id,
          grade,
          is_passed,
          mode_of_attempt
        `)
        .eq('course_id', selectedCourse);

      if (gradesError) {
        throw gradesError;
      }

      const studentIds = gradesData?.map(g => g.student_id) || [];

      // Get student information
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          register_number,
          name,
          semester,
          batch,
          degree,
          office_name,
          branch_of_study,
          graduation_type
        `)
        .in('id', studentIds);

      if (studentsError) {
        throw studentsError;
      }

      // Combine student and grade data
      const combinedData: StudentGrade[] = studentsData?.map(student => {
        const grade = gradesData?.find(g => g.student_id === student.id);
        return {
          ...student,
          grade: grade?.grade || '',
          is_passed: grade?.is_passed || false,
          mode_of_attempt: grade?.mode_of_attempt || 'Regular'
        };
      }) || [];

      setStudentGrades(combinedData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading student grades:', error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const selectedCourseInfo = courses.find(c => c.id === selectedCourse);
  const passedCount = studentGrades.filter(sg => sg.is_passed).length;
  const failedCount = studentGrades.length - passedCount;
  const passRate = studentGrades.length > 0 ? Math.round((passedCount / studentGrades.length) * 100) : 0;
  const arrearCount = studentGrades.filter(sg => sg.mode_of_attempt === 'Arrear').length;
  const regularCount = studentGrades.length - arrearCount;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Course Details</h1>
          <p className="text-muted-foreground">View student performance by course</p>
        </div>
      </div>

      {/* Course Selection */}
      <Card className="mb-8 bg-gradient-card shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Select Course
          </CardTitle>
          <CardDescription>Choose a course to view all students and their grades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="course">Course</Label>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger>
                <SelectValue placeholder="Select a course..." />
              </SelectTrigger>
              <SelectContent>
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code} - {course.name} {course.credits && `(${course.credits} credits)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Course Statistics */}
      {selectedCourse && selectedCourseInfo && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
            <Card className="bg-gradient-card shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                    <p className="text-2xl font-bold text-foreground">{studentGrades.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Passed</p>
                    <p className="text-2xl font-bold text-success">{passedCount}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold text-destructive">{failedCount}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pass Rate</p>
                    <p className="text-2xl font-bold text-primary">{passRate}%</p>
                  </div>
                  <BookOpen className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Regular</p>
                    <p className="text-2xl font-bold text-info">{regularCount}</p>
                  </div>
                  <Users className="h-8 w-8 text-info" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Arrear</p>
                    <p className="text-2xl font-bold text-warning">{arrearCount}</p>
                  </div>
                  <Users className="h-8 w-8 text-warning" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Students Table */}
          <Card className="bg-gradient-card shadow-medium">
            <CardHeader>
              <CardTitle>Students in {selectedCourseInfo.code}</CardTitle>
              <CardDescription>
                {selectedCourseInfo.name} 
                {selectedCourseInfo.credits && ` - ${selectedCourseInfo.credits} Credits`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingStudents ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">Loading students...</p>
                </div>
              ) : studentGrades.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Register No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Semester</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Degree</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentGrades.map((student, index) => (
                        <TableRow key={index}>
                          <TableCell>{student.register_number}</TableCell>
                          <TableCell>{student.name}</TableCell>
                          <TableCell>{student.semester}</TableCell>
                          <TableCell>{student.batch}</TableCell>
                          <TableCell>{student.degree}</TableCell>
                          <TableCell>{student.branch_of_study}</TableCell>
                          <TableCell>{student.grade}</TableCell>
                          <TableCell>
                            <Badge variant={student.mode_of_attempt === 'Arrear' ? "secondary" : "outline"}>
                              {student.mode_of_attempt || 'Regular'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={student.is_passed ? "default" : "destructive"}>
                              {student.is_passed ? "Pass" : "Fail"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No students found for this course.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};