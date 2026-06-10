"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Lightweight, branded markdown renderer for client-facing copy. */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          h1: ({ children }) => (
            <h1 className="mb-2 text-lg font-semibold">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 text-base font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 font-semibold">{children}</h3>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
