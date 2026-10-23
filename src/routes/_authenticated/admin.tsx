import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { slugify } from "@/lib/content";
import { canChangeAdminRole, csvCell } from "@/lib/admin-rules";
import { AdminTags, AdminAnalytics } from "@/components/blog/admin-extras";
import { AdminBranding } from "@/components/blog/admin-branding";
import { Forbidden } from "@/components/blog/forbidden";
import { EmptyState } from "@/components/blog/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "./dashboard";

type Status = Database["public"]["Enums"]["article_status"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Blogs" }, { name: "description", content: "Manage editorial reviews, articles, topics and account roles on Blogs." }, { property: "og:title", content: "Admin — Blogs" }, { property: "og:description", content: "Blogs editorial administration and role management." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
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
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="review">Review queue</TabsTrigger>
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="categories">Topics</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
           <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="subs">Newsletter</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="branding">Site branding</TabsTrigger>
        </TabsList>
        <TabsContent value="review"><Articles statuses={["submitted", "under_review"]} review /></TabsContent>
        <TabsContent value="articles"><Articles statuses={["approved", "scheduled", "published", "archived", "draft", "rejected"]} /></TabsContent>
        <TabsContent value="categories"><Categories /></TabsContent>
        <TabsContent value="tags"><AdminTags /></TabsContent>
        <TabsContent value="users"><Users /></TabsContent>
        <TabsContent value="reports"><Reports /></TabsContent>
        <TabsContent value="comments"><ModerateComments /></TabsContent>
        <TabsContent value="subs"><Subs /></TabsContent>
        <TabsContent value="audit"><Audit /></TabsContent>
        <TabsContent value="analytics"><AdminAnalytics /></TabsContent>
        <TabsContent value="branding"><AdminBranding /></TabsContent>
      </Tabs>
    </div>
  );
}

function Articles({ statuses, review }: { statuses: Status[]; review?: boolean }) {
  const qc = useQueryClient();
  const key = ["admin-articles", statuses.join()];
  const { data = [], isPending, error } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("articles").select("id, title, slug, status, published_at, featured, editors_pick, pinned, updated_at, author:profiles!articles_author_id_fkey(display_name)").in("status", statuses).order("updated_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  async function update(id: string, patch: Database["public"]["Tables"]["articles"]["Update"], msg: string) {
    const { error } = await supabase.from("articles").update(patch).eq("id", id);
    if (error) { toast.error("Update failed"); return; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["admin-articles"] });
    qc.invalidateQueries({ queryKey: ["admin-audit"] });
  }
  async function del(id: string) {
    if (!confirm("Delete this article permanently?")) return;
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete article"); return; }
    qc.invalidateQueries({ queryKey: ["admin-articles"] });
  }
  if (isPending) return <p className="mt-6 text-sm text-muted-foreground">Loading articles…</p>;
  if (error) return <p role="alert" className="mt-6 text-destructive">Couldn't load articles. Please refresh to try again.</p>;
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
            {!review && (a.status === "approved" || a.status === "scheduled") && <Button size="sm" variant="accent" onClick={() => update(a.id, { status: "published", published_at: new Date().toISOString() }, "Published")}>Publish</Button>}
            {!review && a.status === "published" && (
              <>
                <Toggle on={a.featured} label="Featured" onClick={() => update(a.id, { featured: !a.featured }, "Updated")} />
                <Toggle on={a.editors_pick} label="Pick" onClick={() => update(a.id, { editors_pick: !a.editors_pick }, "Updated")} />
                <Toggle on={a.pinned} label="Pinned" onClick={() => update(a.id, { pinned: !a.pinned }, "Updated")} />
                <Button size="sm" variant="ghost" onClick={() => update(a.id, { status: "archived" }, "Archived")}>Archive</Button>
              </>
            )}
            {!review && a.status === "archived" && <Button size="sm" variant="outline" onClick={() => update(a.id, { status: "published", published_at: new Date().toISOString() }, "Restored")}>Restore</Button>}
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
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete topic"); return; }
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
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const { data = [], isPending, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;
      const ps = profiles.data;
      const rs = roles.data;
      const admins = new Set((rs ?? []).map((r) => r.user_id));
      return (ps ?? []).map((p) => ({ ...p, admin: admins.has(p.id) }));
    },
  });
  async function toggle(id: string, admin: boolean) {
    if (!user || !canChangeAdminRole(user.id, id, !admin)) return;
    if (!confirm(admin ? "Remove administrator access from this account?" : "Grant full administrator access, including role management, to this account?")) return;
    setPending(id);
    const { error } = await supabase.rpc("set_admin_role", { target_user: id, make_admin: !admin });
    setPending(null);
    if (error) { toast.error("Couldn't change role. Please try again."); return; }
    toast.success(admin ? "Admin access removed" : "Admin access granted");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-audit"] });
  }
  const filtered = data.filter((p) => `${p.display_name} ${p.username}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="mt-6">
    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts" aria-label="Search accounts" className="mb-4 max-w-sm" />
    {isPending ? <p className="text-sm text-muted-foreground">Loading accounts…</p> : error ? <p role="alert" className="text-destructive">Couldn't load accounts. Please refresh to try again.</p> : !filtered.length ? <EmptyState title="No accounts found" body="Registered accounts appear here." /> : <ul className="divide-y rounded-lg border bg-card">
      {filtered.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <Link to="/u/$username" params={{ username: p.username }} className="font-medium hover:text-accent">{p.display_name}</Link>
            <div className="text-xs text-muted-foreground">@{p.username} · joined {format(new Date(p.created_at), "MMM yyyy")}</div>
          </div>
          <span className="kicker">{p.admin ? "Admin" : "Writer"}</span>
          {p.id === user?.id ? <span className="text-xs text-muted-foreground">You</span> : <Button size="sm" variant="outline" disabled={pending !== null} onClick={() => toggle(p.id, p.admin)}>{pending === p.id ? "Saving…" : p.admin ? "Remove admin" : "Make admin"}</Button>}
        </li>
      ))}
    </ul>}
    </div>
  );
}

function Reports() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => (await supabase.from("reports").select("id, reason, created_at, comment_id, article:articles(title, slug), comment:comments(body)").eq("resolved", false).order("created_at", { ascending: false })).data ?? [],
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
              {r.comment && <p className="text-sm">Comment: {r.comment.body.slice(0, 200)}</p>}
              <p className="text-sm text-muted-foreground">“{r.reason}” · {format(new Date(r.created_at), "MMM d")}</p>
            </div>
            <Button size="sm" variant="outline" onClick={async () => { const { error } = await supabase.from("reports").update({ resolved: true }).eq("id", r.id); if (error) { toast.error("Couldn't resolve report"); return; } qc.invalidateQueries({ queryKey: ["admin-reports"] }); }}>Resolve</Button>
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
    const csv = "email,subscribed_at\n" + data.map((s) => `${csvCell(s.email)},${csvCell(s.created_at)}`).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "subscribers.csv";
    a.click();
    URL.revokeObjectURL(a.href);
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

function ModerateComments() {
  const qc = useQueryClient();
  const { data = [], isPending, error } = useQuery({
    queryKey: ["admin-comments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comments").select("id, body, status, created_at, article:articles(title, slug), author:profiles!comments_author_id_fkey(display_name)").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  async function moderate(id: string, status: string) {
    const { error } = await supabase.from("comments").update({ status }).eq("id", id);
    if (error) { toast.error("Couldn't update comment"); return; }
    toast.success(status === "visible" ? "Comment restored" : "Comment hidden");
    qc.invalidateQueries({ queryKey: ["admin-comments"] });
    qc.invalidateQueries({ queryKey: ["comments"] });
  }
  if (isPending) return <p className="mt-6 text-sm text-muted-foreground">Loading comments…</p>;
  if (error) return <p role="alert" className="mt-6 text-destructive">Couldn't load comments.</p>;
  if (!data.length) return <div className="mt-6"><EmptyState title="No comments" body="Reader comments appear here." /></div>;
  return <ul className="mt-6 divide-y rounded-lg border bg-card">{data.map((c) => <li key={c.id} className="flex flex-wrap items-start gap-3 p-4">
    <div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words text-sm">{c.body}</p><p className="mt-2 text-xs text-muted-foreground">{c.author?.display_name} · {format(new Date(c.created_at), "MMM d")} · {c.status}</p>{c.article && <Link to="/a/$slug" params={{ slug: c.article.slug }} className="text-xs hover:text-accent">{c.article.title}</Link>}</div>
    <Button size="sm" variant="outline" onClick={() => moderate(c.id, c.status === "visible" ? "hidden" : "visible")}>{c.status === "visible" ? "Hide" : "Restore"}</Button>
  </li>)}</ul>;
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
