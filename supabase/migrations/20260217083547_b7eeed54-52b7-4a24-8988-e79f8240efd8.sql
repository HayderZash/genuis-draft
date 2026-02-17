
-- Create storage bucket for research source files
INSERT INTO storage.buckets (id, name, public) VALUES ('research-files', 'research-files', false);

-- Storage policies for research files
CREATE POLICY "Users can upload their own research files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own research files"
ON storage.objects FOR SELECT
USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own research files"
ON storage.objects FOR DELETE
USING (bucket_id = 'research-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  report_type TEXT NOT NULL DEFAULT 'scientific',
  abstract TEXT DEFAULT '',
  content JSON DEFAULT '{}',
  research_language TEXT NOT NULL DEFAULT 'ar',
  text_direction TEXT NOT NULL DEFAULT 'rtl',
  page_count INTEGER NOT NULL DEFAULT 3,
  custom_references TEXT DEFAULT '',
  reference_count INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'draft',
  margin_top NUMERIC NOT NULL DEFAULT 2.5,
  margin_bottom NUMERIC NOT NULL DEFAULT 2.5,
  margin_left NUMERIC NOT NULL DEFAULT 3,
  margin_right NUMERIC NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reports" ON public.reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reports" ON public.reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reports" ON public.reports FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create CVs table
CREATE TABLE public.cvs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  linkedin_url TEXT DEFAULT '',
  github_url TEXT DEFAULT '',
  portfolio_url TEXT DEFAULT '',
  twitter_url TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  experiences JSON DEFAULT '[]',
  technical_skills TEXT[] DEFAULT '{}',
  soft_skills TEXT[] DEFAULT '{}',
  languages JSON DEFAULT '[]',
  education JSON DEFAULT '[]',
  certifications JSON DEFAULT '[]',
  cv_language TEXT NOT NULL DEFAULT 'ar',
  generated_content TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cvs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cvs" ON public.cvs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own cvs" ON public.cvs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cvs" ON public.cvs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cvs" ON public.cvs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_cvs_updated_at BEFORE UPDATE ON public.cvs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add source_files column to research_projects for tracking uploaded files
ALTER TABLE public.research_projects ADD COLUMN IF NOT EXISTS source_files JSON DEFAULT '[]';
