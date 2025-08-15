import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, GraduationCap, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Course {
  id: string;
  code: string;
  name: string;
}

interface Student {
  id: string;
  register_number: string;
  name: string;
  semester: number;
  batch: string;
  degree: string;
}

interface AnalyticsData {
  totalStudents: number;
  totalPassed: number;
  totalFailed: number;
  courseStats: Array<{
    course: string;
    passed: number;
    failed: number;
    total: number;
    passRate: number;
  }>;
}

export const Analytics = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [filters, setFilters] = useState({
    semester: 'all',
    batch: 'all', 
    course: 'all',
    registerNumber: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadAnalytics();
    }
  }, [filters, loading]);

  const loadInitialData = async () => {
    try {
      const [coursesRes, studentsRes] = await Promise.all([
        supabase.from('courses').select('*').order('code'),
        supabase.from('students').select('*').order('name')
      ]);

      if (coursesRes.data) setCourses(coursesRes.data);
      if (studentsRes.data) setStudents(studentsRes.data);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      let query = supabase
        .from('grades')
        .select(`
          *,
          students!inner(*),
          courses!inner(*)
        `);

              // Apply filters
              if (filters.semester && filters.semester !== 'all') {
                query = query.eq('students.semester', parseInt(filters.semester));
              }
              if (filters.batch && filters.batch !== 'all') {
                query = query.eq('students.batch', filters.batch);
              }
              if (filters.course && filters.course !== 'all') {
                query = query.eq('courses.id', filters.course);
              }
      if (filters.registerNumber) {
        query = query.like('students.register_number', `%${filters.registerNumber}%`);
      }

      const { data: gradesData } = await query;

      if (gradesData) {
        const courseStatsMap = new Map();
        let totalPassed = 0;
        let totalFailed = 0;

        gradesData.forEach((grade: any) => {
          const courseKey = `${grade.courses.code} - ${grade.courses.name}`;
          
          if (!courseStatsMap.has(courseKey)) {
            courseStatsMap.set(courseKey, { passed: 0, failed: 0, total: 0 });
          }
          
          const stats = courseStatsMap.get(courseKey);
          stats.total++;
          
          if (grade.is_passed) {
            stats.passed++;
            totalPassed++;
          } else {
            stats.failed++;
            totalFailed++;
          }
        });

        const courseStats = Array.from(courseStatsMap.entries()).map(([course, stats]) => ({
          course: course.length > 50 ? course.substring(0, 47) + '...' : course,
          ...stats,
          passRate: Math.round((stats.passed / stats.total) * 100)
        })).sort((a, b) => b.passRate - a.passRate);

        // Get total students count from students table (not filtered by grades)
        let totalStudentsQuery = supabase.from('students').select('id', { count: 'exact', head: true });
        
        // Apply same filters to student count
        if (filters.semester && filters.semester !== 'all') {
          totalStudentsQuery = totalStudentsQuery.eq('semester', parseInt(filters.semester));
        }
        if (filters.batch && filters.batch !== 'all') {
          totalStudentsQuery = totalStudentsQuery.eq('batch', filters.batch);
        }
        if (filters.registerNumber) {
          totalStudentsQuery = totalStudentsQuery.like('register_number', `%${filters.registerNumber}%`);
        }
        
        const { count: totalStudentsCount } = await totalStudentsQuery;

        setAnalytics({
          totalStudents: totalStudentsCount || 0,
          totalPassed,
          totalFailed,
          courseStats
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const uniqueBatches = Array.from(new Set(students.map(s => s.batch))).sort();
  const uniqueSemesters = Array.from(new Set(students.map(s => s.semester))).sort((a, b) => a - b);

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Filters */}
      <Card className="mb-8 bg-gradient-card shadow-medium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Filters & Search
          </CardTitle>
          <CardDescription>Filter data by semester, batch, course, or search by register number</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="semester">Semester</Label>
              <Select value={filters.semester} onValueChange={(value) => setFilters(f => ({ ...f, semester: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Semesters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {uniqueSemesters.map(sem => (
                    <SelectItem key={sem} value={sem.toString()}>Semester {sem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch">Batch</Label>
              <Select value={filters.batch} onValueChange={(value) => setFilters(f => ({ ...f, batch: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {uniqueBatches.map(batch => (
                    <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <Select value={filters.course} onValueChange={(value) => setFilters(f => ({ ...f, course: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} - {course.name.length > 30 ? course.name.substring(0, 30) + '...' : course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="register">Register Number</Label>
              <Input
                id="register"
                placeholder="Search register number..."
                value={filters.registerNumber}
                onChange={(e) => setFilters(f => ({ ...f, registerNumber: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {analytics && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-card shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                    <p className="text-2xl font-bold text-foreground">{analytics.totalStudents}</p>
                  </div>
                  <Users className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Passed Exams</p>
                    <p className="text-2xl font-bold text-success">{analytics.totalPassed}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Failed Exams</p>
                    <p className="text-2xl font-bold text-destructive">{analytics.totalFailed}</p>
                  </div>
                  <TrendingDown className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Overall Pass Rate</p>
                    <p className="text-2xl font-bold text-primary">
                      {Math.round((analytics.totalPassed / (analytics.totalPassed + analytics.totalFailed)) * 100) || 0}%
                    </p>
                  </div>
                  <GraduationCap className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Bar Chart */}
            <Card className="bg-gradient-card shadow-medium">
              <CardHeader>
                <CardTitle>Pass/Fail Rate by Course</CardTitle>
                <CardDescription>Performance breakdown across all courses</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.courseStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="course" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      fontSize={10}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="passed" stackId="a" fill="#10b981" name="Passed" />
                    <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card className="bg-gradient-card shadow-medium">
              <CardHeader>
                <CardTitle>Students Passed by Course</CardTitle>
                <CardDescription>Number of students who passed each course</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={analytics.courseStats.map((course, index) => ({
                        name: course.course.length > 25 ? course.course.substring(0, 22) + '...' : course.course,
                        fullName: course.course,
                        value: course.passed,
                        passRate: course.passRate,
                        total: course.total,
                        fill: COLORS[index % COLORS.length]
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.courseStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [
                        `${value} students passed`,
                        props.payload.fullName
                      ]}
                      labelFormatter={() => ''}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Course Performance Table */}
          {analytics.courseStats.length > 0 && (
            <Card className="mt-8 bg-gradient-card shadow-medium">
              <CardHeader>
                <CardTitle>Detailed Course Performance</CardTitle>
                <CardDescription>Complete breakdown of performance by course</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Course</th>
                        <th className="text-right p-2">Total</th>
                        <th className="text-right p-2">Passed</th>
                        <th className="text-right p-2">Failed</th>
                        <th className="text-right p-2">Pass Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.courseStats.map((stat, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{stat.course}</td>
                          <td className="p-2 text-right">{stat.total}</td>
                          <td className="p-2 text-right text-success">{stat.passed}</td>
                          <td className="p-2 text-right text-destructive">{stat.failed}</td>
                          <td className="p-2 text-right">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              stat.passRate >= 80 ? 'bg-success/10 text-success' :
                              stat.passRate >= 60 ? 'bg-warning/10 text-warning' :
                              'bg-destructive/10 text-destructive'
                            }`}>
                              {stat.passRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};