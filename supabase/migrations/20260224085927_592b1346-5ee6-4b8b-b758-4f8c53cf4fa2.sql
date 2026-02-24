
-- Create table for storing generated images
CREATE TABLE public.generated_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- Users can view their own images
CREATE POLICY "Users can view own images"
ON public.generated_images FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own images
CREATE POLICY "Users can insert own images"
ON public.generated_images FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own images
CREATE POLICY "Users can delete own images"
ON public.generated_images FOR DELETE
USING (auth.uid() = user_id);
