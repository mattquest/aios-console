import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Sanitized markdown for chat message bodies. react-markdown builds a
 * React element tree from the AST — raw HTML in the source is never
 * injected into the DOM (it renders as inert text), so no separate
 * sanitizer pass is needed.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("chat-markdown min-w-0", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // External links must not hijack the console tab.
          a: ({ children: kids, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer">
              {kids}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
