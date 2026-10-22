import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publishedQuery, type ArticleCard } from "@/lib/content";
import { ArticleCompact, ArticleFeature, ArticleRow } from "@/components/blog/article-card";
import { EmptyState } from "@/components/blog/empty-state";
import { NewsletterForm } from "@/components/blog/newsletter";
import { Avatar } from "@/components/blog/avatar";
import { Button } from "@/components/ui/button";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    const [latest, trending, cats, tags, authors] = await Promise.all([
      publishedQuery().order("pinned", { ascending: false }).order("published_at", { ascending: false }).limit(24),
      publishedQuery().order("views", { ascending: false }).limit(5),
      supabase.from("categories").select("id, name, slug, description").is("parent_id", null).order("name"),
      supabase.from("tags").select("name, slug, article_tags(count)").limit(40),
      supabase.from("profiles").select("username, display_name, avatar_url, bio, articles(count)").limit(30),
    ]);
    const all = (latest.data ?? []) as unknown as ArticleCard[];
    const popularTags = (tags.data ?? [])
      .map((t) => ({ ...t, n: (t.article_tags as unknown as { count: number }[])[0]?.count ?? 0 }))
      .filter((t) => t.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 16);
    const topAuthors = (authors.data ?? [])
      .map((p) => ({ ...p, n: (p.articles as unknown as { count: number }[])[0]?.count ?? 0 }))
      .filter((p) => p.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    return {
      featured: all.find((a) => a.featured) ?? all[0] ?? null,
      picks: all.filter((a) => a.editors_pick).slice(0, 3),
      latest: all,
      trending: (trending.data ?? []) as unknown as ArticleCard[],
      categories: cats.data ?? [],
      tags: popularTags,
      authors: topAuthors,
    };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blogs — Careful writing from independent authors" },
      { name: "description", content: "Read essays, explainers and field notes on technology, design, science and culture, reviewed by editors before publication." },
      { property: "og:title", content: "Blogs — Careful writing from independent authors" },
      { property: "og:description", content: "Essays, explainers and field notes, reviewed by editors before publication." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: "Blogs" }),
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: Home,
});

function SectionTitle({ children, to }: { children: React.ReactNode; to?: string }) {
  return (
    <div className="mb-6 flex items-baseline justify-between rule-top pt-3">
      <h2 className="kicker text-foreground">{children}</h2>
      {to && (
        <a href={to} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent">
          See all <ArrowRight className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function Home() {
  const { data } = useSuspenseQuery(homeQuery);
  const rest = data.latest.filter((a) => a.id !== data.featured?.id);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="border-b py-12 sm:py-16">
        <p className="kicker mb-4">An independent publication</p>
        <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-7xl">
          Writing worth <em className="font-normal text-accent">slowing down</em> for.
        </h1>
        <p className="mt-5 max-w-xl font-serif text-xl text-muted-foreground">
          Essays and explainers from independent authors. Every story is read by an editor before
          it's published.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>Start writing</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/topics">Browse topics</Link>
          </Button>
        </div>
      </section>

      {!data.featured ? (
        <section className="py-16">
          <EmptyState
            title="The first issue is being written"
            body="No stories have been published yet. Writers can create an account, draft a piece and submit it for editorial review."
            action={
              <Button asChild>
                <Link to="/dashboard">Write the first story</Link>
              </Button>
            }
          />
        </section>
      ) : (
        <>
          <section className="grid gap-12 py-12 lg:grid-cols-[1.6fr_1fr]">
            <ArticleFeature a={data.featured} />
            <div>
              <SectionTitle>Trending</SectionTitle>
              <div className="space-y-6">
                {data.trending.map((a, i) => (
                  <ArticleCompact key={a.id} a={a} index={i} />
                ))}
              </div>
            </div>
          </section>

          {data.picks.length > 0 && (
            <section className="py-8">
              <SectionTitle>Editor's picks</SectionTitle>
              <div className="grid gap-8 md:grid-cols-3">
                {data.picks.map((a) => (
                  <ArticleCompact key={a.id} a={a} />
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-12 py-8 lg:grid-cols-[1.6fr_1fr]">
            <div>
              <SectionTitle>Latest</SectionTitle>
              {rest.length ? rest.map((a) => <ArticleRow key={a.id} a={a} />) : (
                <p className="text-sm text-muted-foreground">More stories are on the way.</p>
              )}
            </div>
            <aside className="space-y-12">
              {data.authors.length > 0 && (
                <div>
                  <SectionTitle>Top authors</SectionTitle>
                  <ul className="space-y-4">
                    {data.authors.map((p) => (
                      <li key={p.username}>
                        <Link to="/u/$username" params={{ username: p.username }} className="group flex items-center gap-3">
                          <Avatar name={p.display_name} src={p.avatar_url} size={40} />
                          <div className="min-w-0">
                            <div className="font-medium group-hover:text-accent">{p.display_name}</div>
                            <div className="truncate text-xs text-muted-foreground">{p.n} {p.n === 1 ? "story" : "stories"}</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.tags.length > 0 && (
                <div>
                  <SectionTitle>Popular tags</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {data.tags.map((t) => (
                      <Link key={t.slug} to="/tag/$slug" params={{ slug: t.slug }} className="rounded-full border bg-card px-3 py-1 text-sm hover:border-foreground">
                        {t.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </section>
        </>
      )}

      <section className="py-8">
        <SectionTitle to="/topics">Topics</SectionTitle>
        <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.map((c) => (
            <Link key={c.id} to="/topics/$slug" params={{ slug: c.slug }} className="group bg-card p-6 transition-colors hover:bg-muted">
              <h3 className="font-display text-xl font-semibold group-hover:text-accent">{c.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="my-12 rounded-xl bg-primary px-6 py-12 text-primary-foreground sm:px-12">
        <p className="kicker mb-3">The weekly letter</p>
        <h2 className="max-w-xl font-display text-3xl font-semibold sm:text-4xl">
          The week's best stories, chosen by our editors.
        </h2>
        <p className="mt-3 max-w-lg text-primary-foreground/70">One email on Sundays. Unsubscribe whenever you like.</p>
        <div className="mt-6 [&_input]:bg-primary-foreground [&_input]:text-primary">
          <NewsletterForm />
        </div>
      </section>
    </div>
  );
}
