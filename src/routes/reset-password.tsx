import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Blogs" },
      { name: "description", content: "Choose a new password for your Blogs account." },
      { property: "og:title", content: "Set a new password — Blogs" },
      { property: "og:description", content: "Choose a new password for your Blogs account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-4xl font-semibold">Set a new password</h1>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 8) return toast.error("Use at least 8 characters");
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password: pw });
          setBusy(false);
          if (error) return toast.error(error.message);
          toast.success("Password updated");
          navigate({ to: "/dashboard" });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} required />
        </div>
        <Button className="w-full" disabled={busy}>Update password</Button>
      </form>
    </div>
  );
}
