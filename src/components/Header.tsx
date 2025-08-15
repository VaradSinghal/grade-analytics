import { BarChart3, GraduationCap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  currentView: 'upload' | 'analytics';
  onViewChange: (view: 'upload' | 'analytics') => void;
}

export const Header = ({ currentView, onViewChange }: HeaderProps) => {
  const navigate = useNavigate();
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
          
          <div className="flex gap-2">
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
          </div>
        </div>
      </div>
    </header>
  );
};