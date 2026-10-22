import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const [arts, cats] = await Promise.all([
          supabase.from("articles").select("slug, updated_at").eq("status", "published").lte("published_at", new Date().toISOString()).limit(5000),
          supabase.from("categories").select("slug"),
        ]);
        if (arts.error || cats.error) return new Response("Sitemap unavailable", { status: 503 });
        const urls = [
          `<url><loc>${origin}/</loc></url>`,
          `<url><loc>${origin}/topics</loc></url>`,
          ...cats.data.map((c) => `<url><loc>${origin}/topics/${c.slug}</loc></url>`),
          ...arts.data.map((a) => `<url><loc>${origin}/a/${a.slug}</loc><lastmod>${a.updated_at}</lastmod></url>`),
        ].join("");
        return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
          headers: { "content-type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
