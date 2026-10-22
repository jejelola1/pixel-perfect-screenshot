import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Search as SearchIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publishedQuery, type ArticleCard } from "@/lib/content";
import { ArticleRow } from "@/components/blog/article-card";
import { EmptyState } from "@/components/blog/empty-state";

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
      <h1 className="font-display text-4xl font-semibold">Search</h1>
      <div className="mt-6 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-card focus-within:border-ring">
        <SearchIcon className="h-5 w-5 text-muted-foreground" />
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search titles, ideas, people…"
          aria-label="Search"
          className="w-full bg-transparent text-lg outline-none"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => navigate({ search: (p) => ({ ...p, category: undefined }) })} className={`rounded-full border px-3 py-1 ${!s.category ? "border-foreground bg-foreground text-background" : "bg-card"}`}>All</button>
        {cats.map((c) => (
          <button key={c.id} onClick={() => navigate({ search: (p) => ({ ...p, category: c.slug }) })} className={`rounded-full border px-3 py-1 ${s.category === c.slug ? "border-foreground bg-foreground text-background" : "bg-card"}`}>{c.name}</button>
        ))}
        <select
          aria-label="Sort"
          value={s.sort ?? "newest"}
          onChange={(e) => navigate({ search: (p) => ({ ...p, sort: e.target.value as "newest" | "popular" }) })}
          className="ml-auto rounded-md border bg-card px-2 py-1"
        >
          <option value="newest">Newest</option>
          <option value="popular">Most read</option>
        </select>
      </div>
      <div className={`mt-6 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
        {data.length ? data.map((a) => <ArticleRow key={a.id} a={a} />) : !isFetching && (
          <EmptyState title="No matching stories" body={s.q ? `Nothing matched “${s.q}”. Try fewer or different words.` : "No stories have been published yet."} />
        )}
      </div>
    </div>
  );
}
