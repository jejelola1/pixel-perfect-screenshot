import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Search as SearchIcon, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publishedQuery, type ArticleCard } from "@/lib/content";
import { ArticleRow } from "@/components/blog/article-card";
import { EmptyState } from "@/components/blog/empty-state";
import { Button } from "@/components/ui/button";

const schema = z.object({
  q: z.string().catch(""),
  category: z.string().optional().catch(undefined),
  sort: z.enum(["relevance", "newest", "popular"]).optional().catch(undefined),
});

export const Route = createFileRoute("/search")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Search — Blogs" },
      { name: "description", content: "Search every published story on Blogs by title, content, topic and author." },
      { property: "og:title", content: "Search — Blogs" },
      { property: "og:description", content: "Search every published story on Blogs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [text, setText] = useState(s.q);
  useEffect(() => setText(s.q), [s.q]);

  // debounce the URL update for instant results
  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== s.q) navigate({ search: (p) => ({ ...p, q: text }), replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: cats = [] } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => (await supabase.from("categories").select("id, name, slug").order("name")).data ?? [],
  });

  const { data = [], isFetching } = useQuery({
    queryKey: ["search", s.q, s.category, s.sort],
    queryFn: async () => {
      let qb = publishedQuery();
      if (s.q.trim()) qb = qb.textSearch("search", s.q.trim(), { type: "websearch", config: "english" });
      const cat = cats.find((c) => c.slug === s.category);
      if (cat) qb = qb.eq("category_id", cat.id);
      if (s.sort === "popular") qb = qb.order("views", { ascending: false });
      else qb = qb.order("published_at", { ascending: false });
      const { data } = await qb.limit(40);
      return (data ?? []) as unknown as ArticleCard[];
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="kicker mb-2">Discover</p>
      <h1 className="font-display text-4xl font-semibold">Explore stories</h1>
      <div className="mt-6 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-card focus-within:border-ring">
        <SearchIcon className="h-5 w-5 text-muted-foreground" />
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search titles, ideas, people…"
          aria-label="Search"
          className="min-w-0 w-full bg-transparent text-lg outline-none"
        />
        {text && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Clear search" onClick={() => setText("")}><X /></Button>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <Button size="sm" variant={!s.category ? "default" : "outline"} aria-pressed={!s.category} onClick={() => navigate({ search: (p) => ({ ...p, category: undefined }) })}>All topics</Button>
        {cats.map((c) => (
          <Button key={c.id} size="sm" variant={s.category === c.slug ? "default" : "outline"} aria-pressed={s.category === c.slug} onClick={() => navigate({ search: (p) => ({ ...p, category: c.slug }) })}>{c.name}</Button>
        ))}
        <select
          aria-label="Sort"
          value={s.sort ?? "newest"}
          onChange={(e) => navigate({ search: (p) => ({ ...p, sort: e.target.value as "newest" | "popular" }) })}
          className="ml-auto h-9 rounded-md border bg-card px-2"
        >
          <option value="newest">Newest</option>
          <option value="popular">Most read</option>
        </select>
      </div>
      <p role="status" className="mt-6 flex min-h-5 items-center gap-2 border-b pb-4 text-sm text-muted-foreground">{isFetching ? <><Loader2 className="h-4 w-4 animate-spin" />Finding stories…</> : `${data.length === 40 ? "40+" : data.length} ${data.length === 1 ? "story" : "stories"}${s.q ? ` matching “${s.q}”` : ""}`}</p>
      <div aria-busy={isFetching} className={`mt-2 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
        {data.length ? data.map((a) => <ArticleRow key={a.id} a={a} />) : !isFetching && (
          <EmptyState title="No matching stories" body={s.q ? `Nothing matched “${s.q}”. Try fewer or different words.` : "No stories have been published yet."} />
        )}
      </div>
    </div>
  );
}
