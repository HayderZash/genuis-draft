
-- Add include_images and include_tables columns to reports table
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS include_images boolean NOT NULL DEFAULT false;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS include_tables boolean NOT NULL DEFAULT false;

-- Add include_images and include_data_tables columns to research_projects table
ALTER TABLE public.research_projects ADD COLUMN IF NOT EXISTS include_images boolean NOT NULL DEFAULT false;
ALTER TABLE public.research_projects ADD COLUMN IF NOT EXISTS include_data_tables boolean NOT NULL DEFAULT false;
