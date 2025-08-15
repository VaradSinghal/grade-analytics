import { useState } from 'react';
import { Header } from '@/components/Header';
import { FileUpload } from '@/components/FileUpload';
import { Analytics } from '@/components/Analytics';

const Index = () => {
  const [currentView, setCurrentView] = useState<'upload' | 'analytics'>('upload');

  return (
    <div className="min-h-screen bg-background">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="min-h-[calc(100vh-80px)]">
        {currentView === 'upload' ? <FileUpload /> : <Analytics />}
      </main>
    </div>
  );
};

export default Index;
