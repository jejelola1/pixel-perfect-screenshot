import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadMedia } from "@/lib/content";
import { Avatar } from "@/components/blog/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Blogs" }, { name: "description", content: "Update your Blogs author profile, images and social links." }, { property: "og:title", content: "Settings — Blogs" }, { property: "og:description", content: "Manage your Blogs author profile." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Settings,
});

const schema = z.object({
  display_name: z.string().trim().min(1, "Name is required").max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "Username: 3–30 letters, numbers or underscores"),
  bio: z.string().max(300),
  website: z.union([z.literal(""), z.string().url("Website must be a full URL")]),
  twitter: z.string().max(30),
  github: z.string().max(40),
});

function Settings() {
  const { user, profile, refresh } = useAuth();
  const [f, setF] = useState({ display_name: "", username: "", bio: "", website: "", twitter: "", github: "" });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setF({ display_name: profile.display_name, username: profile.username, bio: profile.bio ?? "", website: profile.website ?? "", twitter: profile.twitter ?? "", github: profile.github ?? "" });
      setAvatar(profile.avatar_url);
      setCover(profile.cover_url);
    }
  }, [profile]);

  async function pick(file: File, which: "avatar" | "cover") {
    if (!user) return;
    try {
      const url = await uploadMedia(user.id, file);
      which === "avatar" ? setAvatar(url) : setCover(url);
    } catch {
      toast.error("Upload failed");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const p = schema.safeParse(f);
    if (!p.success) return void toast.error(p.error.issues[0]?.message ?? "Invalid input");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ ...p.data, avatar_url: avatar, cover_url: cover, website: p.data.website || null }).eq("id", user.id);
    setBusy(false);
    if (error) return void toast.error(error.code === "23505" ? "That username is taken." : "Couldn't save your profile.");
    toast.success("Profile updated");
    refresh();
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="bg-card" {...props} />
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="kicker">Settings</p>
      <h1 className="font-display text-4xl font-semibold">Your profile</h1>
      <form onSubmit={save} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label>Cover image</Label>
          <label className="block cursor-pointer overflow-hidden rounded-lg border bg-secondary">
            {cover ? <img src={cover} alt="" className="h-32 w-full object-cover" /> : <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Upload a cover</div>}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0], "cover")} />
          </label>
        </div>
        <div className="flex items-center gap-4">
          <Avatar name={f.display_name || "?"} src={avatar} size={72} />
          <label className="cursor-pointer text-sm font-medium text-accent">
            Change photo
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0], "avatar")} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("display_name", "Name", { maxLength: 80 })}
          {field("username", "Username", { maxLength: 30 })}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={300} rows={3} className="bg-card" />
          <p className="text-right text-xs text-muted-foreground">{f.bio.length}/300</p>
        </div>
        {field("website", "Website", { type: "url", placeholder: "https://" })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("twitter", "X handle")}
          {field("github", "GitHub username")}
        </div>
        <Button disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save profile</Button>
      </form>
    </div>
  );
}
