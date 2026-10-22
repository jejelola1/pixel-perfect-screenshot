import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "./avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type C = {
  id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
  author_id: string;
  author: { username: string; display_name: string; avatar_url: string | null } | null;
};

const LINK_SPAM = /(https?:\/\/[^\s]+.*){4,}/i;

export function Comments({ articleId, enabled }: { articleId: string; enabled: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["comments", articleId],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, body, parent_id, created_at, author_id, author:profiles(username, display_name, avatar_url)")
        .eq("article_id", articleId)
        .eq("status", "visible")
        .order("created_at");
      return (data ?? []) as unknown as C[];
    },
  });

  async function post(body: string, parent: string | null) {
    const text = body.trim();
    if (!text) return false;
    if (text.length > 5000) return toast.error("Comments are limited to 5,000 characters."), false;
    if (LINK_SPAM.test(text)) return toast.error("That looks like spam — please remove some links."), false;
    const { error } = await supabase.from("comments").insert({ article_id: articleId, author_id: user!.id, body: text, parent_id: parent });
    if (error) return toast.error("Couldn't post your comment."), false;
    qc.invalidateQueries({ queryKey: ["comments", articleId] });
    return true;
  }

  async function remove(id: string) {
    await supabase.from("comments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["comments", articleId] });
  }

  const roots = data.filter((c) => !c.parent_id);
  const children = (id: string) => data.filter((c) => c.parent_id === id);

  return (
    <section className="mt-16" aria-labelledby="comments-h">
      <h2 id="comments-h" className="font-display text-2xl font-semibold">
        Responses <span className="text-muted-foreground">({data.length})</span>
      </h2>
      {!enabled ? (
        <p className="mt-4 text-sm text-muted-foreground">Responses are turned off for this story.</p>
      ) : user ? (
        <Composer onSubmit={(b) => post(b, null)} />
      ) : (
        <p className="mt-4 rounded-lg border bg-card p-4 text-sm">
          <Link to="/auth" className="font-medium text-accent">Sign in</Link> to join the conversation.
        </p>
      )}
      <ul className="mt-8 space-y-6">
        {roots.map((c) => (
          <Item key={c.id} c={c} replies={children(c.id)} canReply={enabled && !!user} onReply={(b) => post(b, c.id)} canDelete={(x) => isAdmin || x.author_id === user?.id} onDelete={remove} />
        ))}
      </ul>
    </section>
  );
}

function Composer({ onSubmit, placeholder = "What are your thoughts?" }: { onSubmit: (b: string) => Promise<boolean | undefined | string | number>; placeholder?: string }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await onSubmit(v);
        setBusy(false);
        if (ok === true) setV("");
      }}
    >
      <Textarea value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} rows={3} maxLength={5000} className="bg-card" />
      <div className="flex justify-end">
        <Button size="sm" disabled={busy || !v.trim()}>Respond</Button>
      </div>
    </form>
  );
}

function Item({ c, replies, canReply, onReply, canDelete, onDelete }: { c: C; replies: C[]; canReply: boolean; onReply: (b: string) => Promise<boolean | undefined>; canDelete: (c: C) => boolean; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const body = (x: C) => (
    <div className="flex gap-3">
      <Avatar name={x.author?.display_name ?? "?"} src={x.author?.avatar_url} size={32} />
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          <span className="font-medium">{x.author?.display_name}</span>{" "}
          <span className="text-muted-foreground">· {formatDistanceToNow(new Date(x.created_at), { addSuffix: true })}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap font-serif text-base">
          {x.body.split(/(@[a-z0-9_]+)/gi).map((part, i) =>
            part.startsWith("@") ? <Link key={i} to="/u/$username" params={{ username: part.slice(1).toLowerCase() }} className="text-accent">{part}</Link> : part,
          )}
        </p>
        <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
          {canReply && x.id === c.id && <button onClick={() => setOpen(!open)} className="hover:text-foreground">Reply</button>}
          {canDelete(x) && <button onClick={() => onDelete(x.id)} className="hover:text-destructive">Delete</button>}
        </div>
      </div>
    </div>
  );
  return (
    <li>
      {body(c)}
      {(replies.length > 0 || open) && (
        <div className="ml-11 mt-4 space-y-4 border-l pl-4">
          {replies.map((r) => <div key={r.id}>{body(r)}</div>)}
          {open && <Composer placeholder={`Reply to ${c.author?.display_name}`} onSubmit={async (b) => { const ok = await onReply(b); if (ok) setOpen(false); return ok; }} />}
        </div>
      )}
    </li>
  );
}
