import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { GraduationCap } from 'lucide-react';

const Login = () => {
  const { loading, signInWithGoogle } = useSupabaseAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md bg-gradient-card shadow-large">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Grade Analytics Hub
          </CardTitle>
          <CardDescription>Sign in with your srmist.edu.in account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={signInWithGoogle} size="lg" className="w-full" disabled={loading} variant="analytics">
            Continue with Google (srmist.edu.in)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;


