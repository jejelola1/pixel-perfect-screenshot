import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Avatar } from "./avatar";
import { excerpt, type ArticleCard as A } from "@/lib/content";

function Meta({ a }: { a: A }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {a.author && (
        <>
          <Avatar name={a.author.display_name} src={a.author.avatar_url} size={20} />
          <span className="font-medium text-foreground">{a.author.display_name}</span>
          <span aria-hidden>·</span>
        </>
      )}
      {a.published_at && <time dateTime={a.published_at}>{format(new Date(a.published_at), "MMM d, yyyy")}</time>}
      <span aria-hidden>·</span>
      <span>{a.reading_minutes} min read</span>
    </div>
  );
}

export function ArticleRow({ a }: { a: A }) {
  return (
    <article className="group grid grid-cols-[1fr_auto] gap-5 border-b py-6 last:border-0">
      <div className="min-w-0 space-y-2">
        {a.category && <span className="kicker">{a.category.name}</span>}
        <Link to="/a/$slug" params={{ slug: a.slug }} className="block">
          <h3 className="font-display text-xl font-semibold leading-snug group-hover:text-accent sm:text-2xl">
            {a.title}
          </h3>
          <p className="mt-1 line-clamp-2 font-serif text-base text-muted-foreground">
            {a.subtitle || excerpt(a.content)}
          </p>
        </Link>
        <Meta a={a} />
      </div>
      {a.cover_url && (
        <Link to="/a/$slug" params={{ slug: a.slug }} tabIndex={-1} aria-hidden>
          <img src={a.cover_url} alt="" loading="lazy" className="h-24 w-28 rounded-md object-cover sm:h-28 sm:w-40" />
        </Link>
      )}
    </article>
  );
}

export function ArticleFeature({ a }: { a: A }) {
  return (
    <article className="group animate-rise">
      <Link to="/a/$slug" params={{ slug: a.slug }} className="block space-y-4">
        {a.cover_url ? (
          <img src={a.cover_url} alt="" className="aspect-[16/9] w-full rounded-lg object-cover shadow-card" />
        ) : (
          <div className="flex aspect-[16/9] w-full items-end rounded-lg bg-primary p-6">
            <span className="font-display text-6xl text-primary-foreground/20">“</span>
          </div>
        )}
        {a.category && <span className="kicker">{a.category.name}</span>}
        <h2 className="font-display text-3xl font-semibold leading-tight group-hover:text-accent sm:text-4xl">
          {a.title}
        </h2>
        <p className="font-serif text-lg text-muted-foreground">{a.subtitle || excerpt(a.content, 220)}</p>
      </Link>
      <div className="mt-4"><Meta a={a} /></div>
    </article>
  );
}

export function ArticleCompact({ a, index }: { a: A; index?: number }) {
  return (
    <article className="group flex gap-4">
      {index !== undefined && (
        <span className="font-display text-3xl font-semibold text-border">{String(index + 1).padStart(2, "0")}</span>
      )}
      <div className="space-y-1">
        <Link to="/a/$slug" params={{ slug: a.slug }}>
          <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-accent">{a.title}</h3>
        </Link>
        <Meta a={a} />
      </div>
    </article>
  );
}
