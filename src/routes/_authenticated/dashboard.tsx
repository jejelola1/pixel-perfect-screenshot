import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Bookmark, Eye, FileText, Heart, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { STATUS_LABEL, type ArticleCard, ARTICLE_CARD_SELECT } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/blog/empty-state";
import { ArticleRow } from "@/components/blog/article-card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Blogs" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: mine = [], isLoading } = useQuery({
    queryKey: ["mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, title, slug, status, updated_at, published_at, views, review_note, likes(count)")
        .eq("author_id", user!.id)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: saved = [] } = useQuery({
    queryKey: ["saved", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("bookmarks").select(`article:articles(${ARTICLE_CARD_SELECT})`).eq("user_id", user!.id).order("created_at", { ascending: false });
      return (data ?? []).map((b) => b.article).filter(Boolean) as unknown as ArticleCard[];
    },
  });

  async function create() {
    const slug = `untitled-${crypto.randomUUID().slice(0, 8)}`;
    const { data, error } = await supabase.from("articles").insert({ author_id: user!.id, title: "", slug, status: "draft" }).select("id").single();
    if (error) return toast.error("Couldn't create a draft.");
    navigate({ to: "/write/$id", params: { id: data.id } });
  }

  async function remove(id: string) {
    if (!confirm("Delete this draft permanently?")) return;
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) return toast.error("Only drafts can be deleted.");
    qc.invalidateQueries({ queryKey: ["mine"] });
  }

  const published = mine.filter((a) => a.status === "published");
  const views = published.reduce((s, a) => s + a.views, 0);
  const likes = mine.reduce((s, a) => s + ((a.likes as unknown as { count: number }[])[0]?.count ?? 0), 0);

  const stats = [
    { label: "Published", value: published.length, icon: FileText },
    { label: "Total reads", value: views, icon: Eye },
    { label: "Likes", value: likes, icon: Heart },
    { label: "Saved", value: saved.length, icon: Bookmark },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Dashboard</p>
          <h1 className="font-display text-4xl font-semibold">Hello, {profile?.display_name?.split(" ")[0] ?? "writer"}</h1>
        </div>
        <Button onClick={create} variant="accent" size="lg"><Plus /> New story</Button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card p-5">
            <s.icon className="h-4 w-4 text-muted-foreground" />
            <div className="mt-3 font-display text-3xl font-semibold">{s.value.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="stories" className="mt-10">
        <TabsList>
          <TabsTrigger value="stories">Your stories</TabsTrigger>
          <TabsTrigger value="saved">Reading list</TabsTrigger>
        </TabsList>
        <TabsContent value="stories" className="mt-4">
          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />)}</div>
          ) : mine.length === 0 ? (
            <EmptyState title="Your first story starts here" body="Drafts are private until you submit them. An editor reviews every submission before it's published." action={<Button onClick={create}><Plus /> New story</Button>} />
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {mine.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <Link to="/write/$id" params={{ id: a.id }} className="font-display text-lg font-semibold hover:text-accent">
                      {a.title || "Untitled draft"}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={a.status} publishedAt={a.published_at} />
                      <span>Edited {format(new Date(a.updated_at), "MMM d, h:mm a")}</span>
                      {a.status === "published" && <span>· {a.views} reads</span>}
                    </div>
                    {a.status === "rejected" && a.review_note && (
                      <p className="mt-2 rounded bg-muted px-3 py-2 text-sm">Editor note: {a.review_note}</p>
                    )}
                  </div>
                  {a.status === "published" && (
                    <Button asChild variant="ghost" size="sm"><Link to="/a/$slug" params={{ slug: a.slug }}>View</Link></Button>
                  )}
                  {(a.status === "draft" || a.status === "rejected") && (
                    <Button variant="ghost" size="icon" aria-label="Delete draft" onClick={() => remove(a.id)}><Trash2 /></Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="saved" className="mt-4">
          {saved.length ? saved.map((a) => <ArticleRow key={a.id} a={a} />) : (
            <EmptyState title="Nothing saved yet" body="Tap the bookmark on any story to keep it here for later." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function StatusBadge({ status, publishedAt }: { status: string; publishedAt?: string | null }) {
  const scheduled = status === "published" && publishedAt && new Date(publishedAt) > new Date();
  const label = scheduled ? `Scheduled · ${format(new Date(publishedAt!), "MMM d")}` : STATUS_LABEL[status] ?? status;
  const variant = status === "published" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant as "default"}>{label}</Badge>;
}
