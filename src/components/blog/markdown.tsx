import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";

/**
 * Renders article markdown. Supports GFM (tables, footnotes, task lists),
 * $math$, fenced code highlighting, and callouts written as
 * `> [!NOTE]` / `> [!WARNING]` blockquotes.
 */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose-blog">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSlug, rehypeKatex, rehypeHighlight]}
        components={{
          img: ({ src, alt }) => (
            <figure>
              <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" />
              {alt && <figcaption className="mt-2 text-center font-sans text-sm text-muted-foreground">{alt}</figcaption>}
            </figure>
          ),
          a: ({ href, children }) => {
            const yt = href && /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(href);
            if (yt && typeof children === "object")
              return (
                <span className="block aspect-video overflow-hidden rounded-lg">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${yt[1]}`}
                    title="Embedded video"
                    className="h-full w-full"
                    allowFullScreen
                    loading="lazy"
                  />
                </span>
              );
            const external = href?.startsWith("http");
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => {
            const text = JSON.stringify(children);
            const m = /\[!(NOTE|TIP|WARNING|IMPORTANT)\]/.exec(text);
            if (m)
              return (
                <aside
                  className={`not-italic rounded-lg border-l-4 bg-card p-4 font-sans text-base shadow-card ${
                    m[1] === "WARNING" ? "border-warning" : "border-accent"
                  }`}
                >
                  <div className="kicker mb-1">{(m[1] ?? "note").toLowerCase()}</div>
                  <div className="[&_p]:m-0">{stripMarker(children)}</div>
                </aside>
              );
            return <blockquote>{children}</blockquote>;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

function stripMarker(children: React.ReactNode): React.ReactNode {
  // Remove the "[!NOTE]" token from the first paragraph's text.
  const arr = Array.isArray(children) ? children : [children];
  return arr.map((c, i) => {
    if (c && typeof c === "object" && "props" in c) {
      const el = c as React.ReactElement<{ children?: React.ReactNode }>;
      const kids = el.props.children;
      const list = Array.isArray(kids) ? kids : [kids];
      const cleaned = list.map((k) =>
        typeof k === "string" ? k.replace(/\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*/, "") : k,
      );
      return <p key={i}>{cleaned}</p>;
    }
    return null;
  });
}
