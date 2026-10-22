import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { slugify } from "@/lib/content";
import { Forbidden } from "@/components/blog/forbidden";
import { EmptyState } from "@/components/blog/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "./dashboard";

type Status = Database["public"]["Enums"]["article_status"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Blogs" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="mx-auto max-w-5xl p-10"><div className="h-10 w-1/3 animate-pulse rounded bg-muted" /></div>;
  if (!isAdmin) return <Forbidden />;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="kicker">Editorial</p>
      <h1 className="font-display text-4xl font-semibold">Admin</h1>
      <Tabs defaultValue="review" className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="review">Review queue</TabsTrigger>
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="categories">Topics</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="subs">Newsletter</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="review"><Articles statuses={["submitted", "under_review"]} review /></TabsContent>
        <TabsContent value="articles"><Articles statuses={["approved", "published", "archived", "draft", "rejected"]} /></TabsContent>
        <TabsContent value="categories"><Categories /></TabsContent>
        <TabsContent value="users"><Users /></TabsContent>
        <TabsContent value="reports"><Reports /></TabsContent>
        <TabsContent value="subs"><Subs /></TabsContent>
        <TabsContent value="audit"><Audit /></TabsContent>
      </Tabs>
    </div>
  );
}

function Articles({ statuses, review }: { statuses: Status[]; review?: boolean }) {
  const qc = useQueryClient();
  const key = ["admin-articles", statuses.join()];
  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await supabase.from("articles").select("id, title, slug, status, published_at, featured, editors_pick, pinned, updated_at, author:profiles!articles_author_id_fkey(display_name)").in("status", statuses).order("updated_at", { ascending: false }).limit(200)).data ?? [],
  });
  async function update(id: string, patch: Database["public"]["Tables"]["articles"]["Update"], msg: string) {
    const { error } = await supabase.from("articles").update(patch).eq("id", id);
    if (error) { toast.error("Update failed"); return; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["admin-articles"] });
  }
  async function del(id: string) {
    if (!confirm("Delete this article permanently?")) return;
    await supabase.from("articles").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-articles"] });
  }
  if (!data.length) return <div className="mt-6"><EmptyState title={review ? "Queue is clear" : "No articles"} body={review ? "No submissions are waiting for review." : "Nothing to show yet."} /></div>;
  return (
    <ul className="mt-6 divide-y rounded-lg border bg-card">
      {data.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <Link to="/write/$id" params={{ id: a.id }} className="font-display text-lg font-semibold hover:text-accent">{a.title || "Untitled"}</Link>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={a.status} publishedAt={a.published_at} />
              <span>by {(a.author as { display_name: string } | null)?.display_name}</span>
              <span>· {format(new Date(a.updated_at), "MMM d")}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {review && (
              <>
                {a.status === "submitted" && <Button size="sm" variant="outline" onClick={() => update(a.id, { status: "under_review" }, "Marked under review")}>Start review</Button>}
                <Button size="sm" variant="outline" onClick={() => update(a.id, { status: "approved" }, "Approved")}>Approve</Button>
                <Button size="sm" variant="accent" onClick={() => update(a.id, { status: "published", published_at: new Date().toISOString() }, "Published")}>Publish</Button>
                <Button size="sm" variant="ghost" onClick={() => { const note = prompt("What should the author change?"); if (note) update(a.id, { status: "rejected", review_note: note.slice(0, 1000) }, "Sent back to author"); }}>Request changes</Button>
              </>
            )}
            {!review && a.status === "approved" && <Button size="sm" variant="accent" onClick={() => update(a.id, { status: "published", published_at: new Date().toISOString() }, "Published")}>Publish</Button>}
            {!review && a.status === "published" && (
              <>
                <Toggle on={a.featured} label="Featured" onClick={() => update(a.id, { featured: !a.featured }, "Updated")} />
                <Toggle on={a.editors_pick} label="Pick" onClick={() => update(a.id, { editors_pick: !a.editors_pick }, "Updated")} />
                <Toggle on={a.pinned} label="Pinned" onClick={() => update(a.id, { pinned: !a.pinned }, "Updated")} />
                <Button size="sm" variant="ghost" onClick={() => update(a.id, { status: "archived" }, "Archived")}>Archive</Button>
              </>
            )}
            {!review && a.status === "archived" && <Button size="sm" variant="outline" onClick={() => update(a.id, { status: "published" }, "Restored")}>Restore</Button>}
            {!review && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(a.id)}>Delete</Button>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return <Button size="sm" variant={on ? "default" : "outline"} onClick={onClick} aria-pressed={on}>{label}</Button>;
}

function Categories() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [parent, setParent] = useState("");
  const { data = [] } = useQuery({ queryKey: ["cats-all"], queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [] });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: name.trim().slice(0, 60), slug: slugify(name), description: desc.slice(0, 300), parent_id: parent || null });
    if (error) { toast.error(error.code === "23505" ? "A topic with that name exists" : "Couldn't add topic"); return; }
    setName(""); setDesc(""); setParent("");
    qc.invalidateQueries({ queryKey: ["cats-all"] });
  }
  async function del(id: string) {
    if (!confirm("Delete this topic? Stories keep their content but lose the topic.")) return;
    await supabase.from("categories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["cats-all"] });
  }
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
      <ul className="divide-y rounded-lg border bg-card">
        {data.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <div className="font-medium">{c.parent_id && <span className="text-muted-foreground">{data.find((p) => p.id === c.parent_id)?.name} / </span>}{c.name}</div>
              <div className="text-xs text-muted-foreground">/topics/{c.slug}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => del(c.id)}>Delete</Button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="font-display text-lg font-semibold">New topic</h3>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={60} />
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" maxLength={300} />
        <select value={parent} onChange={(e) => setParent(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm" aria-label="Parent topic">
          <option value="">No parent (top level)</option>
          {data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button className="w-full">Add topic</Button>
      </form>
    </div>
  );
}

function Users() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: ps }, { data: rs }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      ]);
      const admins = new Set((rs ?? []).map((r) => r.user_id));
      return (ps ?? []).map((p) => ({ ...p, admin: admins.has(p.id) }));
    },
  });
  async function toggle(id: string, admin: boolean) {
    const { error } = admin
      ? await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin")
      : await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
    if (error) { toast.error("Couldn't change role"); return; }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }
  return (
    <ul className="mt-6 divide-y rounded-lg border bg-card">
      {data.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <Link to="/u/$username" params={{ username: p.username }} className="font-medium hover:text-accent">{p.display_name}</Link>
            <div className="text-xs text-muted-foreground">@{p.username} · joined {format(new Date(p.created_at), "MMM yyyy")}</div>
          </div>
          {p.admin && <span className="kicker">Admin</span>}
          {p.id !== user?.id && <Button size="sm" variant="outline" onClick={() => toggle(p.id, p.admin)}>{p.admin ? "Remove admin" : "Make admin"}</Button>}
        </li>
      ))}
    </ul>
  );
}

function Reports() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => (await supabase.from("reports").select("id, reason, created_at, article:articles(title, slug)").eq("resolved", false).order("created_at", { ascending: false })).data ?? [],
  });
  if (!data.length) return <div className="mt-6"><EmptyState title="No open reports" body="Reader reports about stories will appear here." /></div>;
  return (
    <ul className="mt-6 divide-y rounded-lg border bg-card">
      {data.map((r) => {
        const art = r.article as { title: string; slug: string } | null;
        return (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              {art && <Link to="/a/$slug" params={{ slug: art.slug }} className="font-medium hover:text-accent">{art.title}</Link>}
              <p className="text-sm text-muted-foreground">“{r.reason}” · {format(new Date(r.created_at), "MMM d")}</p>
            </div>
            <Button size="sm" variant="outline" onClick={async () => { await supabase.from("reports").update({ resolved: true }).eq("id", r.id); qc.invalidateQueries({ queryKey: ["admin-reports"] }); }}>Resolve</Button>
          </li>
        );
      })}
    </ul>
  );
}

function Subs() {
  const { data = [] } = useQuery({
    queryKey: ["admin-subs"],
    queryFn: async () => (await supabase.from("newsletter_subscribers").select("id, email, created_at").order("created_at", { ascending: false })).data ?? [],
  });
  function exportCsv() {
    const csv = "email,subscribed_at\n" + data.map((s) => `${s.email},${s.created_at}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "subscribers.csv";
    a.click();
  }
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground"><strong className="text-foreground">{data.length}</strong> subscribers</p>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data.length}>Export CSV</Button>
      </div>
      <ul className="divide-y rounded-lg border bg-card text-sm">
        {data.map((s) => <li key={s.id} className="flex justify-between px-4 py-2"><span>{s.email}</span><span className="text-muted-foreground">{format(new Date(s.created_at), "MMM d, yyyy")}</span></li>)}
      </ul>
    </div>
  );
}

function Audit() {
  const { data = [] } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <ul className="mt-6 divide-y rounded-lg border bg-card font-mono text-xs">
      {data.map((l) => (
        <li key={l.id} className="flex gap-4 px-4 py-2">
          <span className="text-muted-foreground">{format(new Date(l.created_at), "MMM d HH:mm")}</span>
          <span>{l.entity}</span>
          <span className="text-accent">{l.action}</span>
          <span className="truncate text-muted-foreground">{l.entity_id}</span>
        </li>
      ))}
    </ul>
  );
}
