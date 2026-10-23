CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base text; uname text; n int := 0;
BEGIN
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), '[^a-zA-Z0-9_]', '', 'g'));
  IF base IS NULL OR base = '' THEN base := 'writer'; END IF;
  uname := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    n := n + 1; uname := base || n;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (new.id, uname, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', uname), new.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.set_admin_role(target_user uuid, make_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF target_user = auth.uid() AND NOT make_admin THEN
    RAISE EXCEPTION 'You cannot remove your own administrator access' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user) THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  IF make_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (target_user, 'admin') ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = target_user AND role = 'admin';
  END IF;
  INSERT INTO public.audit_log(actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), CASE WHEN make_admin THEN 'grant:admin' ELSE 'revoke:admin' END, 'user', target_user, jsonb_build_object('admin', make_admin));
END $$;
REVOKE ALL ON FUNCTION public.set_admin_role(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_admin_role(uuid, boolean) TO authenticated;
REVOKE INSERT, DELETE ON public.user_roles FROM authenticated;
COMMENT ON FUNCTION public.set_admin_role(uuid, boolean) IS 'Authenticated admin-only role changes with self-demotion protection and audit logging.';