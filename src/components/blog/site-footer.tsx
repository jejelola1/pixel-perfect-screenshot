import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            A home for careful writing. Essays, explainers, and field notes from independent
            authors, reviewed by editors before they reach you.
          </p>
          <NewsletterForm compact />
        </div>
        <div>
          <h3 className="kicker mb-3 text-muted-foreground">Read</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/topics" className="hover:text-accent">All topics</Link></li>
            <li><Link to="/search" search={{ q: "" }} className="hover:text-accent">Search</Link></li>
            <li><a href="/rss.xml" className="hover:text-accent">RSS feed</a></li>
          </ul>
        </div>
        <div>
          <h3 className="kicker mb-3 text-muted-foreground">Write</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/auth" search={{ mode: "signup" }} className="hover:text-accent">Create an account</Link></li>
            <li><Link to="/dashboard" className="hover:text-accent">Your dashboard</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl justify-between px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} Blogs</span>
          <a href="/sitemap.xml" className="hover:text-foreground">Sitemap</a>
        </div>
      </div>
    </footer>
  );
}
