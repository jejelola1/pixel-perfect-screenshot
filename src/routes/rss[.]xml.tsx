import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { excerpt } from "@/lib/content";

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const { data } = await supabase
          .from("articles")
          .select("title, subtitle, slug, content, published_at")
          .eq("status", "published")
          .lte("published_at", new Date().toISOString())
          .order("published_at", { ascending: false })
          .limit(50);
        const items = (data ?? [])
          .map((a) => `<item><title>${esc(a.title)}</title><link>${origin}/a/${a.slug}</link><guid>${origin}/a/${a.slug}</guid><pubDate>${new Date(a.published_at!).toUTCString()}</pubDate><description>${esc(a.subtitle || excerpt(a.content, 300))}</description></item>`)
          .join("");
        const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Blogs</title><link>${origin}</link><description>Careful writing from independent authors.</description>${items}</channel></rss>`;
        return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
      },
    },
  },
});
