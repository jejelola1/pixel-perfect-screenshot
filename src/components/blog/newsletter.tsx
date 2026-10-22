import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const schema = z.string().trim().email().max(255);

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(email);
    if (!parsed.success) return void toast.error("Enter a valid email address.");
    setState("loading");
    const { error } = await supabase.from("newsletter_subscribers").insert({ email: parsed.data.toLowerCase() });
    if (error && error.code !== "23505") {
      setState("idle");
      return void toast.error("Couldn't subscribe right now. Please try again.");
    }
    setState("done");
  }

  if (state === "done")
    return (
      <p className="flex items-center gap-2 text-sm text-success">
        <Check className="h-4 w-4" /> You're on the list. Look out for the next issue.
      </p>
    );

  return (
    <form onSubmit={submit} className={compact ? "flex max-w-sm gap-2" : "flex w-full max-w-md flex-col gap-2 sm:flex-row"}>
      <label htmlFor={compact ? "nl-c" : "nl"} className="sr-only">Email address</label>
      <input
        id={compact ? "nl-c" : "nl"}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
      />
      <Button type="submit" variant={compact ? "default" : "accent"} className="h-10" disabled={state === "loading"}>
        {state === "loading" && <Loader2 className="animate-spin" />} Subscribe
      </Button>
    </form>
  );
}
