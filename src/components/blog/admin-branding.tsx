import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Save, Trash2, Sun, Moon, Monitor } from "lucide-react";
import { toast } from "sonner";
import { brandingQuery, brandingSchema, defaultBranding, type Branding } from "@/lib/branding";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/content";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

async function logoFile(file: File): Promise<File> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Choose a PNG, JPEG or WebP image");
  if (file.size > 5 * 1024 * 1024) throw new Error("Logo must be under 5 MB");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("Couldn't process image"); }
  const scale = 256 / Math.max(bitmap.width, bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (256 - width) / 2, (256 - height) / 2, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't process image");
  return new File([blob], "site-logo.png", { type: "image/png" });
}

export function AdminBranding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery(brandingQuery);
  const [draft, setDraft] = useState<Branding>(defaultBranding);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setDraft(data); }, [data]);
  async function upload(file: File) {
    if (!user) return;
    setBusy(true);
    try {
      const url = await uploadMedia(user.id, await logoFile(file));
      setDraft((current) => ({ ...current, logo_url: url }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't upload logo"); }
    finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = brandingSchema.safeParse(draft);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check your settings"); return; }
    setBusy(true);
    const { error } = await supabase.from("site_settings").upsert({ id: true, ...parsed.data, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { toast.error("Couldn't save site branding"); return; }
    await qc.invalidateQueries({ queryKey: brandingQuery.queryKey });
    toast.success("Site branding saved");
  }
  if (isPending) return <p className="mt-6 text-muted-foreground">Loading site branding…</p>;
  if (error) return <p role="alert" className="mt-6 text-destructive">Couldn't load site branding. Please refresh.</p>;
  return <form onSubmit={save} className="mt-6 max-w-xl space-y-8">
    <div className="space-y-2"><Label htmlFor="site-name">Site name</Label><Input id="site-name" value={draft.site_name} onChange={(e) => setDraft({ ...draft, site_name: e.target.value })} maxLength={60} required disabled={busy} /></div>
    <div className="space-y-3"><Label>Site logo</Label><div className="flex flex-wrap items-center gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border bg-card">{draft.logo_url ? <img src={draft.logo_url} alt="Site logo preview" className="h-20 w-20 object-contain" /> : <ImagePlus className="h-8 w-8 text-muted-foreground" />}</div>
      <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => document.getElementById("site-logo-upload")?.click()}><ImagePlus /> Upload logo</Button><input id="site-logo-upload" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload site logo" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />{draft.logo_url && <Button type="button" variant="ghost" size="icon" aria-label="Remove logo" title="Remove logo" disabled={busy} onClick={() => setDraft({ ...draft, logo_url: null })}><Trash2 /></Button>}</div>
    </div></div>
    <div className="space-y-3"><Label>Theme</Label><ToggleGroup type="single" value={draft.theme} onValueChange={(theme) => { if (theme === "light" || theme === "dark" || theme === "system") setDraft({ ...draft, theme }); }} className="justify-start" variant="outline" disabled={busy} aria-label="Site theme"><ToggleGroupItem value="light"><Sun className="h-4 w-4" /> Light</ToggleGroupItem><ToggleGroupItem value="dark"><Moon className="h-4 w-4" /> Dark</ToggleGroupItem><ToggleGroupItem value="system"><Monitor className="h-4 w-4" /> System</ToggleGroupItem></ToggleGroup></div>
    <Button disabled={busy} type="submit">{busy ? <Loader2 className="animate-spin" /> : <Save />} Save branding</Button>
  </form>;
}