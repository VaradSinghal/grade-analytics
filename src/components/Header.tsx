import { BarChart3, GraduationCap, BookOpen, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';

interface HeaderProps {
  currentView: 'upload' | 'analytics';
  onViewChange: (view: 'upload' | 'analytics') => void;
}

export const Header = ({ currentView, onViewChange }: HeaderProps) => {
  const navigate = useNavigate();
  const { userEmail, signInWithGoogle, signOut } = useSupabaseAuth();
  return (
    <header className="border-b bg-gradient-card shadow-soft">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-primary p-2 rounded-lg">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Grade Analytics Hub</h1>
              <p className="text-sm text-muted-foreground">Student Performance Analytics Platform</p>
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
            <Button
              variant={currentView === 'upload' ? 'analytics' : 'professional'}
              onClick={() => onViewChange('upload')}
              className="flex items-center gap-2"
            >
              <GraduationCap className="h-4 w-4" />
              Upload Data
            </Button>
            <Button
              variant={currentView === 'analytics' ? 'analytics' : 'professional'}
              onClick={() => onViewChange('analytics')}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
            <Button
              variant="professional"
              onClick={() => navigate('/course-details')}
              className="flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Course Details
            </Button>
            {userEmail ? (
              <>
                <span className="text-sm text-muted-foreground hidden md:inline-flex items-center gap-1">
                  <User className="h-4 w-4" /> {userEmail}
                </span>
                <Button variant="outline" onClick={signOut} className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={signInWithGoogle} className="flex items-center gap-2">
                <LogIn className="h-4 w-4" /> Sign in
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};