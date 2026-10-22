import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Bookmark, Flag, Heart, Link2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ARTICLE_CARD_SELECT, excerpt, extractToc, type ArticleCard } from "@/lib/content";
import { useAuth } from "@/lib/auth";
import { Markdown } from "@/components/blog/markdown";
import { Avatar } from "@/components/blog/avatar";
import { ArticleCompact } from "@/components/blog/article-card";
import { Comments } from "@/components/blog/comments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const articleQuery = (slug: string) =>
  queryOptions({
    queryKey: ["article", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select(
          `${ARTICLE_CARD_SELECT}, author_id, category_id, comments_enabled, updated_at, seo_title, seo_description, status, author_full:profiles!articles_author_id_fkey(id, bio), article_tags(tag:tags(name, slug))`,
        )
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const a = data as unknown as ArticleCard & {
        author_id: string;
        category_id: string | null;
        comments_enabled: boolean;
        updated_at: string;
        seo_title: string | null;
        seo_description: string | null;
        status: string;
        author_full: { id: string; bio: string | null } | null;
        article_tags: { tag: { name: string; slug: string } }[];
      };
      const [related, prev, next] = await Promise.all([
        supabase
          .from("articles")
          .select(ARTICLE_CARD_SELECT)
          .eq("status", "published")
          .neq("id", a.id)
          .eq("category_id", a.category_id ?? "00000000-0000-0000-0000-000000000000")
          .order("published_at", { ascending: false })
          .limit(3),
        a.published_at
          ? supabase.from("articles").select("title, slug").eq("status", "published").lt("published_at", a.published_at).order("published_at", { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
        a.published_at
          ? supabase.from("articles").select("title, slug").eq("status", "published").gt("published_at", a.published_at).lte("published_at", new Date().toISOString()).order("published_at").limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return {
        article: a,
        related: (related.data ?? []) as unknown as ArticleCard[],
        prev: prev.data as { title: string; slug: string } | null,
        next: next.data as { title: string; slug: string } | null,
      };
    },
  });

export const Route = createFileRoute("/a/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(articleQuery(params.slug));
    if (!data) throw notFound();
    return { title: data.article.seo_title || data.article.title, description: data.article.seo_description || data.article.subtitle || excerpt(data.article.content, 155), cover: data.article.cover_url, author: data.article.author?.display_name, published: data.article.published_at };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Story not found — Blogs" }, { name: "robots", content: "noindex" }] };
    const meta = [
      { title: `${loaderData.title} — Blogs` },
      { name: "description", content: loaderData.description },
      { property: "og:title", content: loaderData.title },
      { property: "og:description", content: loaderData.description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(loaderData.cover?.startsWith("https://")
        ? [{ property: "og:image", content: loaderData.cover }, { name: "twitter:image", content: loaderData.cover }]
        : []),
    ];
    return {
      meta,
      links: [{ rel: "canonical", href: `/a/${params.slug}` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: loaderData.title,
            description: loaderData.description,
            datePublished: loaderData.published,
            author: { "@type": "Person", name: loaderData.author },
            publisher: { "@type": "Organization", name: "Blogs" },
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="kicker">404</p>
      <h1 className="mt-3 font-display text-4xl font-semibold">This story isn't here</h1>
      <p className="mt-3 text-muted-foreground">It may have been unpublished, moved, or the link is mistyped.</p>
      <Button asChild className="mt-6"><Link to="/">Back to the front page</Link></Button>
    </div>
  ),
  component: ArticlePage,
});

function useProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      setP(Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)));
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return p;
}

function ArticlePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(articleQuery(slug));
  const progress = useProgress();
  if (!data) return null;
  const { article: a, related, prev, next } = data;
  const toc = extractToc(a.content);

  useEffect(() => {
    if (a.status === "published") supabase.rpc("increment_views", { _article: a.id });
  }, [a.id, a.status]);

  return (
    <>
      <div className="fixed left-0 top-0 z-50 h-0.5 bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} aria-hidden />
      <article className="mx-auto max-w-6xl px-4 sm:px-6">
        {a.status !== "published" && (
          <div className="mt-6 rounded-md border border-warning bg-card px-4 py-2 text-sm">
            Preview — this story is <strong>{a.status.replace("_", " ")}</strong> and not visible to readers.
          </div>
        )}
        <nav aria-label="Breadcrumb" className="pt-10 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          {a.category && (
            <>
              <span className="mx-2">/</span>
              <Link to="/topics/$slug" params={{ slug: a.category.slug }} className="hover:text-foreground">{a.category.name}</Link>
            </>
          )}
        </nav>
        <header className="mx-auto max-w-3xl py-8 text-center">
          {a.category && <p className="kicker mb-4">{a.category.name}</p>}
          <h1 className="font-display text-4xl font-semibold leading-[1.1] sm:text-6xl">{a.title}</h1>
          {a.subtitle && <p className="mt-5 font-serif text-xl text-muted-foreground sm:text-2xl">{a.subtitle}</p>}
          {a.author && (
            <div className="mt-8 flex items-center justify-center gap-3 text-sm">
              <Avatar name={a.author.display_name} src={a.author.avatar_url} size={40} />
              <div className="text-left">
                <Link to="/u/$username" params={{ username: a.author.username }} className="font-medium hover:text-accent">{a.author.display_name}</Link>
                <div className="text-muted-foreground">
                  {a.published_at && format(new Date(a.published_at), "MMMM d, yyyy")} · {a.reading_minutes} min read
                </div>
              </div>
            </div>
          )}
        </header>
        {a.cover_url && (
          <img src={a.cover_url} alt="" className="mx-auto mb-12 aspect-[2/1] w-full max-w-5xl rounded-lg object-cover" />
        )}

        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,680px)_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24"><Actions articleId={a.id} slug={slug} title={a.title} vertical /></div>
          </aside>
          <div className="min-w-0">
            <Markdown source={a.content} />
            {a.article_tags.length > 0 && (
              <div className="mt-12 flex flex-wrap gap-2">
                {a.article_tags.map(({ tag }) => (
                  <Link key={tag.slug} to="/tag/$slug" params={{ slug: tag.slug }} className="rounded-full bg-secondary px-3 py-1 text-sm hover:bg-border">
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-10 border-y py-4 lg:hidden"><Actions articleId={a.id} slug={slug} title={a.title} /></div>

            {a.author && (
              <section className="mt-12 flex gap-4 rounded-lg border bg-card p-6">
                <Avatar name={a.author.display_name} src={a.author.avatar_url} size={56} />
                <div>
                  <p className="kicker text-muted-foreground">Written by</p>
                  <Link to="/u/$username" params={{ username: a.author.username }} className="font-display text-xl font-semibold hover:text-accent">{a.author.display_name}</Link>
                  {a.author_full?.bio && <p className="mt-1 text-sm text-muted-foreground">{a.author_full.bio}</p>}
                </div>
              </section>
            )}

            {(prev || next) && (
              <nav className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="More stories">
                {prev ? (
                  <Link to="/a/$slug" params={{ slug: prev.slug }} className="rounded-lg border p-4 hover:border-foreground">
                    <span className="text-xs text-muted-foreground">← Previous</span>
                    <div className="font-display font-semibold">{prev.title}</div>
                  </Link>
                ) : <span />}
                {next && (
                  <Link to="/a/$slug" params={{ slug: next.slug }} className="rounded-lg border p-4 text-right hover:border-foreground">
                    <span className="text-xs text-muted-foreground">Next →</span>
                    <div className="font-display font-semibold">{next.title}</div>
                  </Link>
                )}
              </nav>
            )}

            {a.status === "published" && (
              <Comments articleId={a.id} enabled={a.comments_enabled} />
            )}
          </div>
          <aside className="hidden lg:block">
            {toc.length > 1 && (
              <nav className="sticky top-24 text-sm" aria-label="Table of contents">
                <p className="kicker mb-3 text-muted-foreground">Contents</p>
                <ul className="space-y-2 border-l">
                  {toc.map((t) => (
                    <li key={t.id} className={t.level === 3 ? "pl-6" : "pl-3"}>
                      <a href={`#${t.id}`} className="text-muted-foreground hover:text-foreground">{t.text}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mx-auto mt-20 max-w-5xl">
            <h2 className="kicker mb-6 rule-top pt-3 text-foreground">More in {a.category?.name}</h2>
            <div className="grid gap-8 md:grid-cols-3">
              {related.map((r) => <ArticleCompact key={r.id} a={r} />)}
            </div>
          </section>
        )}
      </article>
    </>
  );
}

function Actions({ articleId, slug, title, vertical }: { articleId: string; slug: string; title: string; vertical?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["engagement", articleId, user?.id ?? "anon"];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [{ count }, liked, saved] = await Promise.all([
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("article_id", articleId),
        user ? supabase.from("likes").select("user_id").eq("article_id", articleId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase.from("bookmarks").select("user_id").eq("article_id", articleId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return { likes: count ?? 0, liked: !!liked.data, saved: !!saved.data };
    },
  });

  async function toggle(table: "likes" | "bookmarks", on: boolean) {
    if (!user) return toast("Sign in to " + (table === "likes" ? "like" : "save") + " stories.");
    const q = on
      ? supabase.from(table).delete().eq("article_id", articleId).eq("user_id", user.id)
      : supabase.from(table).insert({ article_id: articleId, user_id: user.id });
    const { error } = await q;
    if (error) return toast.error("Something went wrong.");
    if (table === "bookmarks") toast.success(on ? "Removed from your list" : "Saved to your list");
    qc.invalidateQueries({ queryKey: key });
  }

  const url = typeof window !== "undefined" ? `${window.location.origin}/a/${slug}` : "";
  const btn = "flex items-center gap-2 rounded-full px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className={cn("flex gap-1", vertical ? "flex-col items-center" : "items-center")}>
      <button className={btn} onClick={() => toggle("likes", !!data?.liked)} aria-pressed={data?.liked} aria-label="Like">
        <Heart className={cn("h-5 w-5", data?.liked && "fill-accent text-accent")} /> <span>{data?.likes ?? 0}</span>
      </button>
      <button className={btn} onClick={() => toggle("bookmarks", !!data?.saved)} aria-pressed={data?.saved} aria-label="Bookmark">
        <Bookmark className={cn("h-5 w-5", data?.saved && "fill-foreground text-foreground")} />
      </button>
      <button
        className={btn}
        aria-label="Copy link"
        onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))}
      >
        <Link2 className="h-5 w-5" />
      </button>
      <a className={btn} aria-label="Share on X" target="_blank" rel="noopener noreferrer" href={`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}>
        <Share2 className="h-5 w-5" />
      </a>
      <button
        className={btn}
        aria-label="Report"
        onClick={async () => {
          const reason = window.prompt("What's wrong with this story?");
          if (!reason || reason.trim().length < 3) return;
          const { error } = await supabase.from("reports").insert({ article_id: articleId, reason: reason.trim().slice(0, 1000), reporter_id: user?.id ?? null });
          error ? toast.error("Couldn't send report") : toast.success("Thanks — an editor will review it.");
        }}
      >
        <Flag className="h-5 w-5" />
      </button>
    </div>
  );
}
