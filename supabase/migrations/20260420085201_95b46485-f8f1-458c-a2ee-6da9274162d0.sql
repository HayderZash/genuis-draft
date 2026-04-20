-- Create exam_papers table for the new "Exam Expert" feature
CREATE TABLE IF NOT EXISTS public.exam_papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  source_text TEXT NOT NULL DEFAULT '',
  question_count INTEGER NOT NULL DEFAULT 10,
  question_types JSONB NOT NULL DEFAULT '["mcq"]'::jsonb,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  language TEXT NOT NULL DEFAULT 'ar',
  generated_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exam papers" ON public.exam_papers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own exam papers" ON public.exam_papers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exam papers" ON public.exam_papers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exam papers" ON public.exam_papers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_exam_papers_updated_at BEFORE UPDATE ON public.exam_papers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create theses table for "Graduate Studies Theses" (Master's & PhD)
CREATE TABLE IF NOT EXISTS public.theses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  thesis_type TEXT NOT NULL DEFAULT 'master', -- 'master' or 'phd'
  abstract TEXT NOT NULL DEFAULT '',
  research_language TEXT NOT NULL DEFAULT 'ar',
  text_direction TEXT NOT NULL DEFAULT 'rtl',
  field_of_study TEXT NOT NULL DEFAULT '',
  supervisor TEXT NOT NULL DEFAULT '',
  university TEXT NOT NULL DEFAULT '',
  chapter_count INTEGER NOT NULL DEFAULT 5,
  chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
  chapter_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_count INTEGER NOT NULL DEFAULT 30,
  custom_references TEXT DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  include_toc BOOLEAN NOT NULL DEFAULT true,
  include_list_of_figures BOOLEAN NOT NULL DEFAULT true,
  include_list_of_tables BOOLEAN NOT NULL DEFAULT true,
  include_abbreviations BOOLEAN NOT NULL DEFAULT true,
  include_images BOOLEAN NOT NULL DEFAULT false,
  include_data_tables BOOLEAN NOT NULL DEFAULT true,
  image_quality TEXT NOT NULL DEFAULT 'standard',
  source_files JSONB DEFAULT '[]'::jsonb,
  margin_top NUMERIC NOT NULL DEFAULT 2.5,
  margin_bottom NUMERIC NOT NULL DEFAULT 2.5,
  margin_left NUMERIC NOT NULL DEFAULT 2.5,
  margin_right NUMERIC NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.theses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own theses" ON public.theses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own theses" ON public.theses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own theses" ON public.theses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own theses" ON public.theses FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_theses_updated_at BEFORE UPDATE ON public.theses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill default feature access for new features (exam_expert, thesis) for existing users
INSERT INTO public.user_feature_access (user_id, feature, is_enabled)
SELECT DISTINCT user_id, 'exam_expert', true FROM public.profiles
ON CONFLICT DO NOTHING;

INSERT INTO public.user_feature_access (user_id, feature, is_enabled)
SELECT DISTINCT user_id, 'thesis', true FROM public.profiles
ON CONFLICT DO NOTHING;