INSERT INTO storage.buckets (id, name, public) VALUES ('research-images', 'research-images', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload research images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'research-images');

CREATE POLICY "Public can read research images" ON storage.objects FOR SELECT USING (bucket_id = 'research-images');

CREATE POLICY "Users can delete own research images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'research-images');