import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft, Bold, Code, Eye, Heading2, History, ImagePlus, Italic, Link2, List, ListOrdered,
  Loader2, Minus, Quote, Send, Sigma, Table, Upload, CalendarClock, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { readingMinutes, slugify, uploadMedia, wordCount } from "@/lib/content";
import { Markdown } from "@/components/blog/markdown";
import { Forbidden } from "@/components/blog/forbidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StatusBadge } from "./dashboard";

export const Route = createFileRoute("/_authenticated/write/$id")({
  head: () => ({ meta: [{ title: "Editor — Blogs" }, { name: "description", content: "Write, review and publish your Blogs articles." }, { property: "og:title", content: "Editor — Blogs" }, { property: "og:description", content: "Blogs article editor and publishing controls." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Editor,
});

type Draft = {
  title: string;
  subtitle: string;
  slug: string;
  content: string;
  cover_url: string | null;
  category_id: string | null;
  comments_enabled: boolean;
  seo_title: string;
  seo_description: string;
};

function Editor() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ta = useRef<HTMLTextAreaElement>(null);

  const { data: article, isLoading } = useQuery({
    queryKey: ["edit", id],
    queryFn: async () => {
      const { data } = await supabase.from("articles").select("*, article_tags(tag:tags(name))").eq("id", id).maybeSingle();
      return data;
    },
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["cats-all"],
    queryFn: async () => (await supabase.from("categories").select("id, name, parent_id").order("name")).data ?? [],
  });

  const [d, setD] = useState<Draft | null>(null);
  const [tags, setTags] = useState("");
  const [preview, setPreview] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState("");

  useEffect(() => {
    if (article && !d) {
      setD({
        title: article.title,
        subtitle: article.subtitle ?? "",
        slug: article.slug,
        content: article.content,
        cover_url: article.cover_url,
        category_id: article.category_id,
        comments_enabled: article.comments_enabled,
        seo_title: article.seo_title ?? "",
        seo_description: article.seo_description ?? "",
      });
      setTags(((article.article_tags ?? []) as { tag: { name: string } }[]).map((t) => t.tag.name).join(", "));
    }
  }, [article, d]);

  const editable = !!article && (isAdmin || ["draft", "submitted", "rejected"].includes(article.status));

  const save = useCallback(
    async (opts?: { version?: boolean; status?: "draft" | "submitted" | "published" | "archived"; publishedAt?: string | null }) => {
      if (!d || !user || !article) return false;
      setSaveState("saving");
      const slug = slugify(d.slug || d.title);
      const patch: TablesUpdate<"articles"> = {
        title: d.title.trim().slice(0, 200),
        subtitle: d.subtitle.trim().slice(0, 300),
        slug,
        content: d.content,
        cover_url: d.cover_url,
        category_id: d.category_id,
        comments_enabled: d.comments_enabled,
        seo_title: d.seo_title.slice(0, 70) || null,
        seo_description: d.seo_description.slice(0, 160) || null,
        reading_minutes: readingMinutes(d.content),
      };
      // An author editing a rejected story moves it back to draft.
      if (!isAdmin && article.status === "rejected") patch.status = "draft";
      if (opts?.status) patch.status = opts.status;
      if (opts?.publishedAt !== undefined) {
        patch.published_at = opts.publishedAt;
        patch.scheduled_for = opts.publishedAt && new Date(opts.publishedAt) > new Date() ? opts.publishedAt : null;
      }
      const { error } = await supabase.from("articles").update(patch).eq("id", id);
      if (error) {
        setSaveState("dirty");
        toast.error(error.code === "23505" ? "That URL slug is already taken." : "Couldn't save.");
        return false;
      }
      // tags
      const names = Array.from(new Set(tags.split(",").map((t) => t.trim()).filter(Boolean))).slice(0, 8);
      await supabase.from("article_tags").delete().eq("article_id", id);
      for (const name of names) {
        const s = slugify(name);
        let { data: t } = await supabase.from("tags").select("id").eq("slug", s).maybeSingle();
        if (!t) t = (await supabase.from("tags").insert({ name: name.slice(0, 40), slug: s }).select("id").single()).data;
        if (t) await supabase.from("article_tags").insert({ article_id: id, tag_id: t.id });
      }
      if (opts?.version) await supabase.from("article_versions").insert({ article_id: id, title: d.title, content: d.content, created_by: user.id });
      setSaveState("saved");
      qc.invalidateQueries({ queryKey: ["edit", id] });
      qc.invalidateQueries({ queryKey: ["versions", id] });
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      qc.invalidateQueries({ queryKey: ["mine"] });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
      return true;
    },
    [d, user, article, isAdmin, id, tags, qc],
  );

  // Autosave 1.5s after the last keystroke.
  useEffect(() => {
    if (saveState !== "dirty" || !editable) return;
    const t = setTimeout(() => save(), 1500);
    return () => clearTimeout(t);
  }, [d, tags, saveState, save, editable]);

  if (isLoading || (article && !d)) return <div className="mx-auto max-w-3xl p-10"><div className="h-10 w-2/3 animate-pulse rounded bg-muted" /></div>;
  if (!article || !d) return <Forbidden />;

  const set = (patch: Partial<Draft>) => {
    setD({ ...d, ...patch });
    setSaveState("dirty");
  };

  function wrap(before: string, after = before, placeholder = "") {
    const el = ta.current;
    if (!el || !d) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = d.content.slice(s, e) || placeholder;
    const next = d.content.slice(0, s) + before + sel + after + d.content.slice(e);
    set({ content: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }
  function line(prefix: string) {
    const el = ta.current;
    if (!el || !d) return;
    const s = el.selectionStart;
    const start = d.content.lastIndexOf("\n", s - 1) + 1;
    set({ content: d.content.slice(0, start) + prefix + d.content.slice(start) });
  }

  async function upload(file: File, asCover = false) {
    if (!user) return;
    if (!file.type.startsWith("image/")) return void toast.error("Only images can be uploaded.");
    if (file.size > 10 * 1024 * 1024) return void toast.error("Images must be under 10 MB.");
    const t = toast.loading("Uploading image…");
    try {
      const url = await uploadMedia(user.id, file);
      if (asCover) set({ cover_url: url });
      else wrap(`![${file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")}](${url})\n`, "", "");
      toast.success("Image added", { id: t });
    } catch {
      toast.error("Upload failed", { id: t });
    }
  }

  async function submit() {
    if (!d) return;
    if (!d.title.trim() || wordCount(d.content) < 50) return void toast.error("Add a title and at least 50 words before submitting.");
    setBusy(true);
    const ok = await save({ version: true, status: "submitted" });
    setBusy(false);
    if (ok) {
      toast.success("Submitted for review. We'll let you know when an editor responds.");
      navigate({ to: "/dashboard" });
    }
  }
  async function publish(when?: string) {
    if (!d) return;
    if (!d.title.trim()) return void toast.error("Add a title first.");
    if (when && (!Number.isFinite(new Date(when).getTime()) || new Date(when) <= new Date())) return void toast.error("Choose a future publication time.");
    setBusy(true);
    const at = when ? new Date(when).toISOString() : new Date().toISOString();
    const ok = await save({ version: true, status: "published", publishedAt: at });
    setBusy(false);
    if (ok) toast.success(when ? `Scheduled for ${format(new Date(when), "PPp")}` : "Published");
  }

  const words = wordCount(d.content);
  const tools: [typeof Bold, string, () => void][] = [
    [Heading2, "Heading", () => line("## ")],
    [Bold, "Bold", () => wrap("**", "**", "bold")],
    [Italic, "Italic", () => wrap("_", "_", "italic")],
    [Link2, "Link", () => wrap("[", "](https://)", "link text")],
    [Quote, "Quote", () => line("> ")],
    [List, "Bulleted list", () => line("- ")],
    [ListOrdered, "Numbered list", () => line("1. ")],
    [Code, "Code block", () => wrap("\n```js\n", "\n```\n", "code")],
    [Sigma, "Math", () => wrap("$", "$", "E = mc^2")],
    [Table, "Table", () => wrap("\n| Column | Column |\n| --- | --- |\n| ", " | |\n", "Cell")],
    [Info, "Callout", () => wrap("\n> [!NOTE]\n> ", "\n", "Worth knowing…")],
    [Minus, "Divider", () => wrap("\n\n---\n\n", "")],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="sticky top-16 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><ArrowLeft /> Back</Link></Button>
        <StatusBadge status={article.status} publishedAt={article.published_at} />
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : "All changes saved"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPreview(!preview)} aria-pressed={preview}><Eye /> {preview ? "Edit" : "Preview"}</Button>
          <VersionHistory articleId={id} onRestore={(v) => set({ title: v.title, content: v.content })} />
          {editable && <Button variant="outline" size="sm" onClick={() => save({ version: true }).then((ok) => ok && toast.success("Version saved"))}>Save version</Button>}
          {isAdmin ? (
            <>
              <SchedulePopover value={schedule} onChange={setSchedule} onConfirm={() => schedule && publish(schedule)} />
              <Button size="sm" variant="accent" onClick={() => publish()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Publish now</Button>
            </>
          ) : (
            editable && article.status !== "submitted" && (
              <Button size="sm" variant="accent" onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Submit for review</Button>
            )
          )}
        </div>
      </div>

      {!editable && (
        <p className="mt-4 rounded-md border bg-card px-4 py-3 text-sm">This story is {article.status.replace("_", " ")} and locked for editing. Contact an editor to request changes.</p>
      )}
      {article.status === "submitted" && !isAdmin && (
        <p className="mt-4 rounded-md border bg-card px-4 py-3 text-sm">Submitted — an editor will review it soon. You can still make edits.</p>
      )}

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="mx-auto w-full max-w-[720px]">
          {preview ? (
            <article>
              {d.cover_url && <img src={d.cover_url} alt="" className="mb-8 aspect-[2/1] w-full rounded-lg object-cover" />}
              <h1 className="font-display text-5xl font-semibold leading-tight">{d.title || "Untitled"}</h1>
              {d.subtitle && <p className="mt-4 font-serif text-2xl text-muted-foreground">{d.subtitle}</p>}
              <div className="mt-8"><Markdown source={d.content} /></div>
            </article>
          ) : (
            <fieldset disabled={!editable} className="space-y-4">
              {d.cover_url ? (
                <div className="group relative">
                  <img src={d.cover_url} alt="Cover" className="aspect-[2/1] w-full rounded-lg object-cover" />
                  <Button size="sm" variant="secondary" className="absolute right-3 top-3" onClick={() => set({ cover_url: null })}>Remove cover</Button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <ImagePlus className="h-4 w-4" /> Add a cover image
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], true)} />
                </label>
              )}
              <textarea
                value={d.title}
                onChange={(e) => set({ title: e.target.value.replace(/\n/g, "") })}
                placeholder="Title"
                rows={1}
                aria-label="Title"
                className="w-full resize-none bg-transparent font-display text-4xl font-semibold leading-tight outline-none placeholder:text-border sm:text-5xl [field-sizing:content]"
              />
              <textarea
                value={d.subtitle}
                onChange={(e) => set({ subtitle: e.target.value.replace(/\n/g, "") })}
                placeholder="Add a subtitle…"
                rows={1}
                aria-label="Subtitle"
                className="w-full resize-none bg-transparent font-serif text-xl text-muted-foreground outline-none placeholder:text-border [field-sizing:content]"
              />
              <div className="flex flex-wrap gap-0.5 rounded-md border bg-card p-1" role="toolbar" aria-label="Formatting">
                {tools.map(([Icon, label, fn]) => (
                  <Button key={label} type="button" title={label} aria-label={label} onClick={fn} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
                <label title="Upload image" className="cursor-pointer rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Upload className="h-4 w-4" />
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
              </div>
              <textarea
                ref={ta}
                value={d.content}
                onChange={(e) => set({ content: e.target.value })}
                onDrop={(e) => {
                  const f = e.dataTransfer.files?.[0];
                  if (f) {
                    e.preventDefault();
                    upload(f);
                  }
                }}
                onPaste={(e) => {
                  const f = e.clipboardData.files?.[0];
                  if (f) {
                    e.preventDefault();
                    upload(f);
                  }
                }}
                placeholder={"Tell your story…\n\nWrite in Markdown. Drop images anywhere to upload them."}
                aria-label="Story content"
                className="min-h-[60vh] w-full resize-none bg-transparent font-serif text-lg leading-relaxed outline-none placeholder:text-muted-foreground/60 [field-sizing:content]"
              />
            </fieldset>
          )}
        </div>

        <aside className="space-y-6 text-sm lg:sticky lg:top-36 lg:self-start">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border text-center">
            <Stat label="Words" value={words} />
            <Stat label="Chars" value={d.content.length} />
            <Stat label="Min read" value={readingMinutes(d.content)} />
          </div>
          <fieldset disabled={!editable} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat">Topic</Label>
              <select id="cat" value={d.category_id ?? ""} onChange={(e) => set({ category_id: e.target.value || null })} className="h-9 w-full rounded-md border bg-card px-2">
                <option value="">Choose a topic</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? "— " : ""}{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" value={tags} onChange={(e) => { setTags(e.target.value); setSaveState("dirty"); }} placeholder="design, typography" className="bg-card" />
              <p className="text-xs text-muted-foreground">Up to 8, separated by commas.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">URL</Label>
              <div className="flex items-center rounded-md border bg-card pl-2 text-xs text-muted-foreground">
                /a/<input id="slug" value={d.slug} onChange={(e) => set({ slug: e.target.value })} onBlur={() => set({ slug: slugify(d.slug || d.title) })} className="h-9 flex-1 bg-transparent px-1 text-sm text-foreground outline-none" />
              </div>
              <Button type="button" variant="link" size="sm" onClick={() => set({ slug: slugify(d.title) })} className="h-auto p-0 text-xs">Generate from title</Button>
            </div>
            <details className="rounded-md border bg-card p-3">
              <summary className="cursor-pointer font-medium">Search preview</summary>
              <div className="mt-3 space-y-3">
                <Input value={d.seo_title} onChange={(e) => set({ seo_title: e.target.value })} placeholder="SEO title (≤70)" maxLength={70} />
                <textarea value={d.seo_description} onChange={(e) => set({ seo_description: e.target.value })} placeholder="Meta description (≤160)" maxLength={160} rows={3} className="w-full rounded-md border bg-background p-2" />
                <div className="rounded bg-background p-2">
                  <div className="truncate text-[13px] text-chart-3">{d.seo_title || d.title || "Untitled"}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">{d.seo_description || d.subtitle}</div>
                </div>
              </div>
            </details>
            <label className="flex items-center justify-between">
              <span>Allow responses</span>
              <Switch checked={d.comments_enabled} onCheckedChange={(v) => set({ comments_enabled: v })} />
            </label>
          </fieldset>
          <details className="rounded-md border bg-card p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Formatting guide</summary>
            <ul className="mt-2 space-y-1 font-mono">
              <li>## Heading</li><li>**bold** _italic_</li><li>$x^2$ inline math</li><li>$$ block math $$</li><li>Footnote[^1] … [^1]: note</li><li>&gt; [!NOTE] callout</li><li>YouTube link on its own line = embed</li>
            </ul>
          </details>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card p-3">
      <div className="font-display text-xl font-semibold">{value.toLocaleString()}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function SchedulePopover({ value, onChange, onConfirm }: { value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen(!open)}><CalendarClock /> Schedule</Button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-64 space-y-2 rounded-lg border bg-popover p-3 shadow-lift">
          <Label htmlFor="when">Publish on</Label>
          <Input id="when" type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
          <Button size="sm" className="w-full" disabled={!value || new Date(value) <= new Date()} onClick={() => { onConfirm(); setOpen(false); }}>Confirm schedule</Button>
        </div>
      )}
    </div>
  );
}

function VersionHistory({ articleId, onRestore }: { articleId: string; onRestore: (v: { title: string; content: string }) => void }) {
  const { data = [] } = useQuery({
    queryKey: ["versions", articleId],
    queryFn: async () => (await supabase.from("article_versions").select("id, title, content, created_at").eq("article_id", articleId).order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm"><History /> History</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Version history</SheetTitle></SheetHeader>
        <ul className="mt-4 space-y-2 px-4">
          {data.length === 0 && <li className="text-sm text-muted-foreground">Versions are saved when you click “Save version”, submit, or publish.</li>}
          {data.map((v) => (
            <li key={v.id} className="rounded-md border p-3">
              <div className="text-sm font-medium">{v.title || "Untitled"}</div>
              <div className="text-xs text-muted-foreground">{format(new Date(v.created_at), "PPp")} · {wordCount(v.content)} words</div>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => { onRestore(v); toast.success("Version restored — it will autosave."); }}>Restore</Button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
