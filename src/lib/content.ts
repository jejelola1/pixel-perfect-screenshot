import GithubSlugger from "github-slugger";
import { supabase } from "@/integrations/supabase/client";

export const SITE_NAME = "Blogs";

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
}

export function wordCount(md: string) {
  const text = md.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`[\]()!-]/g, " ");
  return text.split(/\s+/).filter(Boolean).length;
}

/** 230 words per minute, minimum one minute. */
export function readingMinutes(md: string) {
  return Math.max(1, Math.round(wordCount(md) / 230));
}

export function extractToc(md: string) {
  const slugger = new GithubSlugger();
  const out: { level: number; text: string; id: string }[] = [];
  let inCode = false;
  for (const line of md.split("\n")) {
    if (line.startsWith("```")) inCode = !inCode;
    if (inCode) continue;
    const m = /^(#{2,3})\s+(.+)$/.exec(line);
    if (m && m[1] && m[2]) {
      const text = m[2].replace(/[*_`]/g, "").trim();
      out.push({ level: m[1].length, text, id: slugger.slug(text) });
    }
  }
  return out;
}

export function excerpt(md: string, len = 180) {
  const t = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[#>*_`$]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > len ? t.slice(0, len).replace(/\s\S*$/, "") + "…" : t;
}

export const ARTICLE_CARD_SELECT =
  "id, title, subtitle, slug, cover_url, reading_minutes, published_at, views, featured, editors_pick, pinned, content, author:profiles!articles_author_id_fkey(username, display_name, avatar_url), category:categories(name, slug)";

export type ArticleCard = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  cover_url: string | null;
  reading_minutes: number;
  published_at: string | null;
  views: number;
  featured: boolean;
  editors_pick: boolean;
  pinned: boolean;
  content: string;
  author: { username: string; display_name: string; avatar_url: string | null } | null;
  category: { name: string; slug: string } | null;
};

export function publishedQuery() {
  return supabase
    .from("articles")
    .select(ARTICLE_CARD_SELECT)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString());
}

export async function uploadMedia(userId: string, file: File) {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  // Bucket is private; issue a long-lived signed link for public display.
  const { data, error: e2 } = await supabase.storage
    .from("media")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (e2 || !data) throw e2 ?? new Error("Could not create link");
  return data.signedUrl;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
  rejected: "Changes requested",
};
