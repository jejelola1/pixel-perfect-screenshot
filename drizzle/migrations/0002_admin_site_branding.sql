CREATE TABLE public.site_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
 site_name text NOT NULL DEFAULT 'Blogs' CHECK (length(trim(site_name)) BETWEEN 1 AND 60),
 logo_url text,
 theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site branding public read" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "site branding admin insert" ON public.site_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "site branding admin update" ON public.site_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));