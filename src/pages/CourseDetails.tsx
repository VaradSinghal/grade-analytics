import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Users, BookOpen, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Course {
  id: string;
  code: string;
  name: string;
}

interface StudentGrade {
  student: {
    id: string;
    register_number: string;
    name: string;
    semester: number;
    batch: string;
    degree: string;
  };
  grade: string;
  is_passed: boolean;
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
      const { data: gradesData } = await supabase
        .from('grades')
        .select(`
          grade,
          is_passed,
          students!inner(
            id,
            register_number,
            name,
            semester,
            batch,
            degree
          )
        `)
        .eq('course_id', selectedCourse)
        .order('students(name)');

      if (gradesData) {
        const formattedData = gradesData.map((item: any) => ({
          student: item.students,
          grade: item.grade,
          is_passed: item.is_passed
        }));
        setStudentGrades(formattedData);
      }
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
                    {course.code} - {course.name}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
          </div>

          {/* Students List */}
          <Card className="bg-gradient-card shadow-medium">
            <CardHeader>
              <CardTitle>Students in {selectedCourseInfo.code}</CardTitle>
              <CardDescription>{selectedCourseInfo.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingStudents ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">Loading students...</p>
                </div>
              ) : studentGrades.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Register Number</th>
                        <th className="text-left p-3">Student Name</th>
                        <th className="text-center p-3">Semester</th>
                        <th className="text-center p-3">Batch</th>
                        <th className="text-center p-3">Degree</th>
                        <th className="text-center p-3">Grade</th>
                        <th className="text-center p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentGrades.map((studentGrade, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{studentGrade.student.register_number}</td>
                          <td className="p-3">{studentGrade.student.name}</td>
                          <td className="p-3 text-center">{studentGrade.student.semester}</td>
                          <td className="p-3 text-center">{studentGrade.student.batch}</td>
                          <td className="p-3 text-center">{studentGrade.student.degree}</td>
                          <td className="p-3 text-center">
                            <Badge 
                              variant={studentGrade.is_passed ? "default" : "destructive"}
                              className="font-medium"
                            >
                              {studentGrade.grade}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center">
                              {studentGrade.is_passed ? (
                                <div className="flex items-center gap-1 text-success">
                                  <CheckCircle className="h-4 w-4" />
                                  <span className="text-xs font-medium">Pass</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-destructive">
                                  <XCircle className="h-4 w-4" />
                                  <span className="text-xs font-medium">Fail</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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