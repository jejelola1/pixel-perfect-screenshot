import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { publishedQuery, type ArticleCard } from "@/lib/content";
import { Listing } from "@/components/blog/listing";

const q = (slug: string) =>
  queryOptions({
    queryKey: ["tag", slug],
    queryFn: async () => {
      const { data: tag } = await supabase.from("tags").select("id, name, article_tags(article_id)").eq("slug", slug).maybeSingle();
      if (!tag) return null;
      const ids = (tag.article_tags ?? []).map((x) => x.article_id);
      const { data } = ids.length
        ? await publishedQuery().in("id", ids).order("published_at", { ascending: false })
        : { data: [] };
      return { name: tag.name, articles: (data ?? []) as unknown as ArticleCard[] };
    },
  });

export const Route = createFileRoute("/tag/$slug")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(q(params.slug));
    if (!d) throw notFound();
    return { name: d.name };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `#${loaderData.name} — Blogs` },
          { name: "description", content: `Stories tagged ${loaderData.name} on Blogs.` },
          { property: "og:title", content: `#${loaderData.name} — Blogs` },
          { property: "og:description", content: `Stories tagged ${loaderData.name}.` },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "Tag not found — Blogs" }, { name: "robots", content: "noindex" }],
  }),
  component: Tag,
});

function Tag() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(q(slug));
  if (!data) return null;
  return <Listing kicker="Tag" title={`#${data.name}`} articles={data.articles} />;
}
