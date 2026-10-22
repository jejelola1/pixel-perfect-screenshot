import { Link } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Forbidden() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <ShieldOff className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="kicker mt-6">403 — Restricted</p>
      <h1 className="mt-3 font-display text-4xl font-semibold">You don't have access to this page</h1>
      <p className="mt-3 text-muted-foreground">
        This area is for editors. If you think you should have access, ask an administrator to update your role.
      </p>
      <Button asChild className="mt-6"><Link to="/dashboard">Go to your dashboard</Link></Button>
    </div>
  );
}
