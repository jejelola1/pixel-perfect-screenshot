import type { ReactNode } from "react";
import type { ArticleCard } from "@/lib/content";
import { ArticleRow } from "./article-card";
import { EmptyState } from "./empty-state";

export function Listing({
  kicker,
  title,
  description,
  articles,
  aside,
}: {
  kicker: string;
  title: string;
  description?: string | null;
  articles: ArticleCard[];
  aside?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="border-b py-12">
        <p className="kicker mb-3">{kicker}</p>
        <h1 className="font-display text-4xl font-semibold sm:text-6xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl font-serif text-xl text-muted-foreground">{description}</p>}
      </header>
      <div className={`grid gap-12 py-6 ${aside ? "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : ""}`}>
        <div className="min-w-0">
          {articles.length ? (
            articles.map((a) => <ArticleRow key={a.id} a={a} />)
          ) : (
            <div className="py-8">
              <EmptyState title="Nothing here yet" body="No published stories match this page yet. Check back soon." />
            </div>
          )}
        </div>
        {aside && <aside className="py-6">{aside}</aside>}
      </div>
    </div>
  );
}
