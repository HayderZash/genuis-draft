import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { FloatingAIAssistant } from "@/components/FloatingAIAssistant";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";

const ProjectEditor = lazy(() => import("./pages/ProjectEditor"));
const Proofreading = lazy(() => import("./pages/Proofreading"));
const Reports = lazy(() => import("./pages/Reports"));
const CVBuilder = lazy(() => import("./pages/CVBuilder"));
const ResearchList = lazy(() => import("./pages/ResearchList"));
const Summarizer = lazy(() => import("./pages/Summarizer"));
const Translator = lazy(() => import("./pages/Translator"));
const AIAssistant = lazy(() => import("./pages/AIAssistant"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ExamExpert = lazy(() => import("./pages/ExamExpert"));
const Theses = lazy(() => import("./pages/Theses"));

const queryClient = new QueryClient();

const RouteFallback = () => <div className="flex items-center justify-center min-h-screen text-muted-foreground">...</div>;

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
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/index" element={<Navigate to="/" replace />} />
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
        <Route path="/plagiarism" element={<Navigate to="/proofreading" replace />} />
        <Route path="/image-generator" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
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
