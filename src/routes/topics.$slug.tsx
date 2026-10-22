import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { publishedQuery, type ArticleCard } from "@/lib/content";
import { Listing } from "@/components/blog/listing";

const q = (slug: string) =>
  queryOptions({
    queryKey: ["topic", slug],
    queryFn: async () => {
      const { data: cat } = await supabase.from("categories").select("*").eq("slug", slug).maybeSingle();
      if (!cat) return null;
      const { data: kids } = await supabase.from("categories").select("id, name, slug").eq("parent_id", cat.id);
      const ids = [cat.id, ...(kids ?? []).map((k) => k.id)];
      const { data } = await publishedQuery().in("category_id", ids).order("published_at", { ascending: false }).limit(50);
      return { cat, kids: kids ?? [], articles: (data ?? []) as unknown as ArticleCard[] };
    },
  });

export const Route = createFileRoute("/topics/$slug")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(q(params.slug));
    if (!d) throw notFound();
    return { name: d.cat.name, description: d.cat.description };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Blogs` },
          { name: "description", content: loaderData.description || `Stories about ${loaderData.name} on Blogs.` },
          { property: "og:title", content: `${loaderData.name} — Blogs` },
          { property: "og:description", content: loaderData.description || `Stories about ${loaderData.name}.` },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "Topic not found — Blogs" }, { name: "robots", content: "noindex" }],
  }),
  component: Topic,
});

function Topic() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(q(slug));
  if (!data) return null;
  return (
    <Listing
      kicker="Topic"
      title={data.cat.name}
      description={data.cat.description}
      articles={data.articles}
      aside={
        data.kids.length > 0 && (
          <div>
            <h2 className="kicker mb-3 text-foreground">Subtopics</h2>
            <div className="flex flex-wrap gap-2">
              {data.kids.map((k) => (
                <Link key={k.id} to="/topics/$slug" params={{ slug: k.slug }} className="rounded-full border bg-card px-3 py-1 text-sm hover:border-foreground">{k.name}</Link>
              ))}
            </div>
          </div>
        )
      }
    />
  );
}
