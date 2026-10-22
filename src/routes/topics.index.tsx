import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const q = queryOptions({
  queryKey: ["topics"],
  queryFn: async () => {
    const { data } = await supabase.from("categories").select("id, name, slug, description, parent_id").order("name");
    return data ?? [];
  },
});

export const Route = createFileRoute("/topics/")({
  head: () => ({
    meta: [
      { title: "Topics — Blogs" },
      { name: "description", content: "Browse every topic on Blogs, from technology and design to science and culture." },
      { property: "og:title", content: "Topics — Blogs" },
      { property: "og:description", content: "Browse every topic on Blogs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Topics,
});

function Topics() {
  const { data } = useSuspenseQuery(q);
  const roots = data.filter((c) => !c.parent_id);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="border-b py-12">
        <p className="kicker mb-3">Explore</p>
        <h1 className="font-display text-4xl font-semibold sm:text-6xl">Topics</h1>
      </header>
      <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3 mt-10">
        {roots.map((c) => (
          <div key={c.id} className="bg-card p-6">
            <Link to="/topics/$slug" params={{ slug: c.slug }} className="font-display text-2xl font-semibold hover:text-accent">{c.name}</Link>
            <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {data.filter((s) => s.parent_id === c.id).map((s) => (
                <li key={s.id}>
                  <Link to="/topics/$slug" params={{ slug: s.slug }} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs hover:bg-border">{s.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
