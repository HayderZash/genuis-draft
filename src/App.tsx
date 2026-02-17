import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ProjectEditor from "./pages/ProjectEditor";
import Proofreading from "./pages/Proofreading";
import Reports from "./pages/Reports";
import CVBuilder from "./pages/CVBuilder";
import ResearchList from "./pages/ResearchList";
import Summarizer from "./pages/Summarizer";
import Translator from "./pages/Translator";
import PlagiarismChecker from "./pages/PlagiarismChecker";
import PresentationGenerator from "./pages/PresentationGenerator";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <>
    <Navbar />
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/research" element={<ProtectedRoute><ResearchList /></ProtectedRoute>} />
      <Route path="/project/:id" element={<ProtectedRoute><ProjectEditor /></ProtectedRoute>} />
      <Route path="/proofreading" element={<ProtectedRoute><Proofreading /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/cvs" element={<ProtectedRoute><CVBuilder /></ProtectedRoute>} />
      <Route path="/summarizer" element={<ProtectedRoute><Summarizer /></ProtectedRoute>} />
      <Route path="/translator" element={<ProtectedRoute><Translator /></ProtectedRoute>} />
      <Route path="/plagiarism" element={<ProtectedRoute><PlagiarismChecker /></ProtectedRoute>} />
      <Route path="/presentations" element={<ProtectedRoute><PresentationGenerator /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </>
);

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
