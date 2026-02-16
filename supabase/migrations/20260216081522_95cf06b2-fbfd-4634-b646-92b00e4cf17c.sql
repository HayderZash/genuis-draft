ALTER TABLE public.research_projects ADD COLUMN IF NOT EXISTS include_toc boolean NOT NULL DEFAULT true;
ALTER TABLE public.research_projects ADD COLUMN IF NOT EXISTS include_list_of_tables boolean NOT NULL DEFAULT false;
ALTER TABLE public.research_projects ADD COLUMN IF NOT EXISTS include_list_of_figures boolean NOT NULL DEFAULT false;