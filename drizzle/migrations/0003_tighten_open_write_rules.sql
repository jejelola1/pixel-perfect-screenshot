DROP POLICY IF EXISTS "tags insert auth" ON public.tags;
CREATE POLICY "tags insert auth" ON public.tags FOR INSERT TO authenticated
  WITH CHECK (char_length(btrim(name)) BETWEEN 1 AND 40 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60);

DROP POLICY IF EXISTS "subscribe anyone" ON public.newsletter_subscribers;
CREATE POLICY "subscribe anyone" ON public.newsletter_subscribers FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(email) <= 254 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

DROP POLICY IF EXISTS "article_tags read" ON public.article_tags;
CREATE POLICY "article_tags read" ON public.article_tags FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.articles a WHERE a.id = article_tags.article_id
    AND ((a.status = 'published' AND a.published_at <= now()) OR a.author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));