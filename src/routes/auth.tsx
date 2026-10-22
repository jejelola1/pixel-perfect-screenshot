import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/components/blog/logo";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ mode: z.enum(["signin", "signup", "forgot"]).optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Sign in — Blogs" },
      { name: "description", content: "Sign in or create a Blogs account to write, save and follow stories." },
      { property: "og:title", content: "Sign in — Blogs" },
      { property: "og:description", content: "Sign in or create a Blogs account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const creds = z.object({ email: z.string().trim().email("Enter a valid email").max(255), password: z.string().min(8, "Use at least 8 characters").max(72) });

function AuthPage() {
  const { mode = "signin" } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("We sent a link to reset your password.");
        return;
      }
      const parsed = creds.safeParse({ email, password });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim().slice(0, 80) } },
        });
        if (error) throw error;
        setSent("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google sign-in failed. Please try again.");
  }

  const heading = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back";

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <LogoMark className="mb-6 h-10 w-10" />
      <h1 className="font-display text-4xl font-semibold">{heading}</h1>
      <p className="mt-2 text-muted-foreground">
        {mode === "signup" ? "Write, save and follow the stories you love." : mode === "forgot" ? "We'll email you a secure link." : "Sign in to continue reading and writing."}
      </p>

      {sent ? (
        <div className="mt-8 flex gap-3 rounded-lg border bg-card p-5">
          <MailCheck className="h-5 w-5 text-success" />
          <p className="text-sm">{sent}</p>
        </div>
      ) : (
        <>
          {mode !== "forgot" && (
            <>
              <Button variant="outline" className="mt-8 h-11 w-full" onClick={google} type="button">
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22ZM6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14ZM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z"/></svg>
                Continue with Google
              </Button>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
            </>
          )}
          <form onSubmit={submit} className={`space-y-4 ${mode === "forgot" ? "mt-8" : ""}`}>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label htmlFor="pw">Password</Label>
                  {mode === "signin" && <Link to="/auth" search={{ mode: "forgot" }} className="text-xs text-muted-foreground hover:text-foreground">Forgot?</Link>}
                </div>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} />
              </div>
            )}
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
            </Button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signup" ? (
          <>Already have an account? <Link to="/auth" className="font-medium text-foreground underline">Sign in</Link></>
        ) : (
          <>New to Blogs? <Link to="/auth" search={{ mode: "signup" }} className="font-medium text-foreground underline">Create an account</Link></>
        )}
      </p>
    </div>
  );
}
