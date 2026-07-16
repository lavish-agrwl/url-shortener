import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Navigation from '@/components/Navigation';
import DashboardView from './views/DashboardView';
import AnalyticsView from './views/AnalyticsView';
import RedirectView from './views/RedirectView';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <Toaster position="top-right" />
      <Navigation />
      <Routes>
        <Route path="/" element={<DashboardView />} />
        <Route path="/analytics/:slug" element={<AnalyticsView />} />
        <Route path="/:slug" element={<RedirectView />} />
      </Routes>
    </div>
  );
}

export default App;
