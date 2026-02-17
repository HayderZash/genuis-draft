
-- Platform settings for contact info
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read settings" ON public.platform_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Insert default contact settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('contact_phone', ''),
  ('contact_telegram', ''),
  ('contact_instagram', '');

-- Add account_type to profiles
ALTER TABLE public.profiles ADD COLUMN account_type text NOT NULL DEFAULT 'unlimited';

-- User feature access (per-user feature toggles)
CREATE TABLE public.user_feature_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, feature)
);
ALTER TABLE public.user_feature_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage feature access" ON public.user_feature_access
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own feature access" ON public.user_feature_access
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- User feature points (per-user per-feature points with expiry)
CREATE TABLE public.user_feature_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature text NOT NULL,
  points_remaining numeric NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature)
);
ALTER TABLE public.user_feature_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage feature points" ON public.user_feature_points
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own feature points" ON public.user_feature_points
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Assign admin role to hayderpailot@gmail.com
DO $$
DECLARE
  admin_uid uuid;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'hayderpailot@gmail.com';
  IF admin_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
