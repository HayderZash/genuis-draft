import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { FloatingAIAssistant } from "@/components/FloatingAIAssistant";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ProjectEditor from "./pages/ProjectEditor";
import Proofreading from "./pages/Proofreading";
import Reports from "./pages/Reports";
import CVBuilder from "./pages/CVBuilder";
import ResearchList from "./pages/ResearchList";
import Summarizer from "./pages/Summarizer";
import Translator from "./pages/Translator";
import AIAssistant from "./pages/AIAssistant";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import ExamExpert from "./pages/ExamExpert";
import Theses from "./pages/Theses";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">...</div>;
  if (!user) return <Navigate to="/landing" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  const showNavbar = !loading && user;
  return (
  <>
    {showNavbar && <Navbar />}
    <Routes>
      <Route path="/landing" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/research" element={<ProtectedRoute><ResearchList /></ProtectedRoute>} />
      <Route path="/project/:id" element={<ProtectedRoute><ProjectEditor /></ProtectedRoute>} />
      <Route path="/proofreading" element={<ProtectedRoute><Proofreading /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/cvs" element={<ProtectedRoute><CVBuilder /></ProtectedRoute>} />
      <Route path="/summarizer" element={<ProtectedRoute><Summarizer /></ProtectedRoute>} />
      <Route path="/translator" element={<ProtectedRoute><Translator /></ProtectedRoute>} />
      <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
      <Route path="/exam-expert" element={<ProtectedRoute><ExamExpert /></ProtectedRoute>} />
      <Route path="/theses" element={<ProtectedRoute><Theses /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      {/* Legacy redirects */}
      <Route path="/plagiarism" element={<Navigate to="/proofreading" replace />} />
      <Route path="/image-generator" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    {showNavbar && <FloatingAIAssistant />}
  </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
