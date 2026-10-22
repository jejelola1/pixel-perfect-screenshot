create type public.app_role as enum ('admin','user');
create type public.article_status as enum ('draft','submitted','under_review','approved','scheduled','published','archived','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default '',
  bio text default '',
  avatar_url text,
  cover_url text,
  website text,
  twitter text,
  github text,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "roles self read" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "roles admin insert" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "roles admin delete" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin') and user_id <> auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare base text; uname text; n int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), '[^a-zA-Z0-9_]', '', 'g'));
  if base = '' then base := 'writer'; end if;
  uname := base;
  while exists (select 1 from public.profiles where username = uname) loop
    n := n + 1; uname := base || n;
  end loop;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', uname), new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text unique not null,
  description text default '',
  icon text default 'BookOpen',
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories read" on public.categories for select using (true);
create policy "categories admin ins" on public.categories for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "categories admin upd" on public.categories for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "categories admin del" on public.categories for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null default 'Untitled',
  subtitle text default '',
  slug text unique not null,
  content text not null default '',
  cover_url text,
  status article_status not null default 'draft',
  featured boolean not null default false,
  pinned boolean not null default false,
  editors_pick boolean not null default false,
  comments_enabled boolean not null default true,
  reading_minutes int not null default 1,
  views int not null default 0,
  review_note text,
  seo_title text, seo_description text,
  published_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (setweight(to_tsvector('english', coalesce(title,'')),'A') || setweight(to_tsvector('english', coalesce(subtitle,'')),'B') || setweight(to_tsvector('english', coalesce(content,'')),'C')) stored
);
create index articles_search_idx on public.articles using gin(search);
create index articles_status_idx on public.articles(status, published_at desc);
grant select on public.articles to anon, authenticated;
grant insert, update, delete on public.articles to authenticated;
grant all on public.articles to service_role;
alter table public.articles enable row level security;
create policy "articles public read" on public.articles for select using (status = 'published' and published_at <= now());
create policy "articles owner read" on public.articles for select to authenticated using (auth.uid() = author_id or public.has_role(auth.uid(),'admin'));
create policy "articles owner insert" on public.articles for insert to authenticated with check ((auth.uid() = author_id and status in ('draft','submitted')) or public.has_role(auth.uid(),'admin'));
create policy "articles owner update" on public.articles for update to authenticated using ((auth.uid() = author_id and status in ('draft','submitted','rejected')) or public.has_role(auth.uid(),'admin')) with check ((auth.uid() = author_id and status in ('draft','submitted')) or public.has_role(auth.uid(),'admin'));
create policy "articles delete" on public.articles for delete to authenticated using ((auth.uid() = author_id and status in ('draft','rejected')) or public.has_role(auth.uid(),'admin'));

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text unique not null,
  created_at timestamptz not null default now()
);
grant select on public.tags to anon, authenticated;
grant insert, update, delete on public.tags to authenticated;
grant all on public.tags to service_role;
alter table public.tags enable row level security;
create policy "tags read" on public.tags for select using (true);
create policy "tags insert auth" on public.tags for insert to authenticated with check (true);
create policy "tags admin" on public.tags for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "tags admin delete" on public.tags for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.article_tags (
  article_id uuid not null references public.articles(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (article_id, tag_id)
);
grant select on public.article_tags to anon, authenticated;
grant insert, delete on public.article_tags to authenticated;
grant all on public.article_tags to service_role;
alter table public.article_tags enable row level security;
create policy "article_tags read" on public.article_tags for select using (true);
create policy "article_tags owner write" on public.article_tags for insert to authenticated with check (exists (select 1 from public.articles a where a.id = article_id and (a.author_id = auth.uid() or public.has_role(auth.uid(),'admin'))));
create policy "article_tags owner delete" on public.article_tags for delete to authenticated using (exists (select 1 from public.articles a where a.id = article_id and (a.author_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create table public.article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  title text not null, content text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.article_versions to authenticated;
grant all on public.article_versions to service_role;
alter table public.article_versions enable row level security;
create policy "versions owner" on public.article_versions for select to authenticated using (exists (select 1 from public.articles a where a.id = article_id and (a.author_id = auth.uid() or public.has_role(auth.uid(),'admin'))));
create policy "versions insert" on public.article_versions for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.articles a where a.id = article_id and (a.author_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create table public.likes (
  user_id uuid not null, article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, article_id)
);
create table public.bookmarks (
  user_id uuid not null, article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, article_id)
);
create table public.follows (
  follower_id uuid not null, following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (follower_id, following_id)
);
grant select on public.likes, public.follows to anon, authenticated;
grant insert, delete on public.likes, public.bookmarks, public.follows to authenticated;
grant select on public.bookmarks to authenticated;
grant all on public.likes, public.bookmarks, public.follows to service_role;
alter table public.likes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.follows enable row level security;
create policy "likes read" on public.likes for select using (true);
create policy "likes own" on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy "likes own del" on public.likes for delete to authenticated using (auth.uid() = user_id);
create policy "bm own read" on public.bookmarks for select to authenticated using (auth.uid() = user_id);
create policy "bm own" on public.bookmarks for insert to authenticated with check (auth.uid() = user_id);
create policy "bm own del" on public.bookmarks for delete to authenticated using (auth.uid() = user_id);
create policy "follows read" on public.follows for select using (true);
create policy "follows own" on public.follows for insert to authenticated with check (auth.uid() = follower_id and follower_id <> following_id);
create policy "follows own del" on public.follows for delete to authenticated using (auth.uid() = follower_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'visible',
  created_at timestamptz not null default now()
);
grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "comments read" on public.comments for select using (status = 'visible' or auth.uid() = author_id or public.has_role(auth.uid(),'admin'));
create policy "comments insert" on public.comments for insert to authenticated with check (auth.uid() = author_id and status = 'visible' and exists (select 1 from public.articles a where a.id = article_id and a.comments_enabled and a.status='published'));
create policy "comments own delete" on public.comments for delete to authenticated using (auth.uid() = author_id or public.has_role(auth.uid(),'admin'));
create policy "comments admin update" on public.comments for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);
grant insert on public.newsletter_subscribers to anon, authenticated;
grant select, delete on public.newsletter_subscribers to authenticated;
grant all on public.newsletter_subscribers to service_role;
alter table public.newsletter_subscribers enable row level security;
create policy "subscribe anyone" on public.newsletter_subscribers for insert with check (true);
create policy "subs admin read" on public.newsletter_subscribers for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "subs admin del" on public.newsletter_subscribers for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 1000),
  reporter_id uuid,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
grant insert on public.reports to anon, authenticated;
grant select, update on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "report anyone" on public.reports for insert with check (resolved = false);
create policy "reports admin" on public.reports for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "reports admin upd" on public.reports for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid, action text not null, entity text not null, entity_id uuid,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit admin" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.articles_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_log(actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'status:' || new.status, 'article', new.id, jsonb_build_object('from', old.status, 'to', new.status));
  elsif tg_op = 'INSERT' then
    insert into public.audit_log(actor_id, action, entity, entity_id) values (auth.uid(), 'create', 'article', new.id);
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger articles_audit_trg before insert or update on public.articles for each row execute function public.articles_audit();

create or replace function public.increment_views(_article uuid)
returns void language sql security definer set search_path = public as $$
  update public.articles set views = views + 1 where id = _article and status = 'published';
$$;
grant execute on function public.increment_views(uuid) to anon, authenticated;

create policy "media read" on storage.objects for select using (bucket_id = 'media');
create policy "media upload own" on storage.objects for insert to authenticated with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media delete own" on storage.objects for delete to authenticated using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.categories (name, slug, description, icon) values
('Technology','technology','Software, hardware, and the ideas shaping how we build.','Cpu'),
('Design','design','Interfaces, typography, and the craft of making things clear.','PenTool'),
('Science','science','Research, discovery, and explanations of the natural world.','FlaskConical'),
('Culture','culture','Books, film, music, and the stories we tell each other.','Library'),
('Business','business','Startups, strategy, and the economics of work.','Briefcase'),
('Writing','writing','Essays and notes on the practice of writing itself.','Feather');