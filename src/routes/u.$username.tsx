import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { publishedQuery, type ArticleCard } from "@/lib/content";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/blog/avatar";
import { ArticleRow } from "@/components/blog/article-card";
import { EmptyState } from "@/components/blog/empty-state";
import { Button } from "@/components/ui/button";

const q = (username: string) =>
  queryOptions({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (!p) return null;
      const [arts, followers, following] = await Promise.all([
        publishedQuery().eq("author_id", p.id).order("published_at", { ascending: false }),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
      ]);
      return { p, articles: (arts.data ?? []) as unknown as ArticleCard[], followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });

export const Route = createFileRoute("/u/$username")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(q(params.username));
    if (!d) throw notFound();
    return { name: d.p.display_name, bio: d.p.bio };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Blogs` },
          { name: "description", content: loaderData.bio || `Stories by ${loaderData.name} on Blogs.` },
          { property: "og:title", content: `${loaderData.name} on Blogs` },
          { property: "og:description", content: loaderData.bio || `Stories by ${loaderData.name}.` },
          { property: "og:type", content: "profile" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "Author not found — Blogs" }, { name: "robots", content: "noindex" }],
  }),
  component: Profile,
});

function Profile() {
  const { username } = Route.useParams();
  const { data } = useSuspenseQuery(q(username));
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: isFollowing } = useQuery({
    queryKey: ["following", data?.p.id, user?.id],
    enabled: !!user && !!data,
    queryFn: async () => {
      const { data: r } = await supabase.from("follows").select("follower_id").eq("follower_id", user!.id).eq("following_id", data!.p.id).maybeSingle();
      return !!r;
    },
  });
  if (!data) return null;
  const { p } = data;

  async function toggleFollow() {
    if (!user) return void toast("Sign in to follow authors.");
    const r = isFollowing
      ? await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", p.id)
      : await supabase.from("follows").insert({ follower_id: user.id, following_id: p.id });
    if (r.error) return void toast.error("Couldn't update follow.");
    qc.invalidateQueries({ queryKey: ["following"] });
    qc.invalidateQueries({ queryKey: ["profile", username] });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      {p.cover_url ? (
        <img src={p.cover_url} alt="" className="mt-6 h-48 w-full rounded-lg object-cover sm:h-64" />
      ) : (
        <div className="mt-6 h-32 rounded-lg bg-secondary sm:h-40" />
      )}
      <header className="-mt-12 flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          <div className="rounded-full ring-4 ring-background"><Avatar name={p.display_name} src={p.avatar_url} size={96} /></div>
          <div className="pb-1">
            <h1 className="font-display text-3xl font-semibold">{p.display_name}</h1>
            <p className="text-sm text-muted-foreground">@{p.username}</p>
          </div>
        </div>
        {user?.id !== p.id && (
          <Button onClick={toggleFollow} variant={isFollowing ? "outline" : "default"}>{isFollowing ? "Following" : "Follow"}</Button>
        )}
      </header>
      {p.bio && <p className="mt-6 max-w-2xl px-2 font-serif text-lg">{p.bio}</p>}
      <div className="mt-4 flex flex-wrap gap-5 px-2 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{data.articles.length}</strong> stories</span>
        <span><strong className="text-foreground">{data.followers}</strong> followers</span>
        <span><strong className="text-foreground">{data.following}</strong> following</span>
        {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground"><Globe className="h-4 w-4" /> Website</a>}
        {p.twitter && <a href={`https://x.com/${p.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">X</a>}
        {p.github && <a href={`https://github.com/${p.github}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a>}
      </div>
      <section className="mt-10 rule-top pt-3">
        <h2 className="kicker mb-2 text-foreground">Published stories</h2>
        {data.articles.length ? data.articles.map((a) => <ArticleRow key={a.id} a={a} />) : (
          <div className="py-6"><EmptyState title="No stories yet" body={`${p.display_name} hasn't published anything yet.`} /></div>
        )}
      </section>
    </div>
  );
}
