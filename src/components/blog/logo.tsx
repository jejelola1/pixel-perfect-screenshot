import { Link } from "@tanstack/react-router";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" className="fill-primary" />
      <path
        d="M10 8h7.2c3.3 0 5.3 1.7 5.3 4.3 0 1.8-1 3.1-2.6 3.6 2 .5 3.3 2 3.3 4.1 0 3-2.3 4.8-5.9 4.8H10V8Zm4 6.8h2.6c1.3 0 2-.6 2-1.7s-.7-1.7-2-1.7H14v3.4Zm0 6.8h3c1.4 0 2.2-.7 2.2-1.8 0-1.2-.8-1.9-2.2-1.9h-3v3.7Z"
        className="fill-primary-foreground"
      />
      <circle cx="25" cy="24" r="2.2" className="fill-accent" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Blogs home">
      <LogoMark />
      <span className="font-display text-xl font-semibold">Blogs</span>
    </Link>
  );
}
