import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed bg-card px-6 py-14 text-center">
      <svg viewBox="0 0 120 80" className="mb-5 h-20 w-32" aria-hidden="true">
        <rect x="20" y="14" width="60" height="56" rx="4" className="fill-muted stroke-border" />
        <rect x="40" y="8" width="60" height="56" rx="4" className="fill-card stroke-border" />
        <line x1="50" y1="22" x2="88" y2="22" className="stroke-foreground" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="32" x2="82" y2="32" className="stroke-border" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="40" x2="86" y2="40" className="stroke-border" strokeWidth="3" strokeLinecap="round" />
        <circle cx="92" cy="54" r="5" className="fill-accent" />
      </svg>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
