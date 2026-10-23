import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "./empty-state";

export function AdminTags() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { data = [], isPending, error } = useQuery({ queryKey: ["admin-tags"], queryFn: async () => {
    const { data, error } = await supabase.from("tags").select("id, name, slug, article_tags(count)").order("name");
    if (error) throw error;
    return data ?? [];
  } });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("tags").insert({ name: name.trim().slice(0, 40), slug: slugify(name) });
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "That tag already exists" : "Couldn't add tag"); return; }
    setName("");
    qc.invalidateQueries({ queryKey: ["admin-tags"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete this tag? Articles will keep their content.")) return;
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete tag"); return; }
    qc.invalidateQueries({ queryKey: ["admin-tags"] });
  }
  return <div className="mt-6 space-y-5">
    <form onSubmit={add} className="flex max-w-md gap-2"><Input aria-label="New tag name" placeholder="New tag" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required /><Button disabled={busy}>Add tag</Button></form>
    {isPending ? <p>Loading tags…</p> : error ? <p role="alert" className="text-destructive">Couldn't load tags.</p> : !data.length ? <EmptyState title="No tags yet" body="Article tags appear here." /> : <ul className="divide-y rounded-lg border bg-card">{data.map((t) => <li key={t.id} className="flex items-center gap-3 p-4"><div className="flex-1"><p className="font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{t.article_tags[0]?.count ?? 0} articles · /tag/{t.slug}</p></div><Button size="sm" variant="ghost" onClick={() => remove(t.id)}>Delete</Button></li>)}</ul>}
  </div>;
}

export function AdminAnalytics() {
  const { data, isPending, error } = useQuery({ queryKey: ["admin-analytics"], queryFn: async () => {
    const [articles, accounts, subscribers] = await Promise.all([
      supabase.from("articles").select("id, title, views, status, published_at, likes(count)").order("views", { ascending: false }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
    ]);
    if (articles.error || accounts.error || subscribers.error) throw new Error("Couldn't load statistics");
    return { articles: articles.data ?? [], accounts: accounts.count ?? 0, subscribers: subscribers.count ?? 0 };
  } });
  if (isPending) return <p className="mt-6">Loading statistics…</p>;
  if (error || !data) return <p role="alert" className="mt-6 text-destructive">Couldn't load statistics.</p>;
  const published = data.articles.filter((a) => a.status === "published" && a.published_at && new Date(a.published_at) <= new Date());
  const stats: [string, number][] = [
    ["Published articles", published.length],
    ["Article views", data.articles.reduce((sum, a) => sum + a.views, 0)],
    ["Accounts", data.accounts],
    ["Subscribers", data.subscribers],
  ];
  return <div className="mt-6"><dl className="grid grid-cols-2 gap-6 border-y py-6 md:grid-cols-4">{stats.map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 font-display text-3xl font-semibold">{value.toLocaleString()}</dd></div>)}</dl>
    <h2 className="mt-8 font-display text-2xl font-semibold">Top articles</h2>
    {!published.length ? <div className="mt-4"><EmptyState title="No published articles yet" body="Article views and engagement appear after publication." /></div> : <ul className="mt-4 divide-y">{published.slice(0, 20).map((a) => <li key={a.id} className="flex justify-between gap-4 py-4"><p className="min-w-0 flex-1 font-medium">{a.title}</p><p className="text-sm text-muted-foreground">{a.views.toLocaleString()} views · {a.likes[0]?.count ?? 0} likes</p></li>)}</ul>}
  </div>;
}