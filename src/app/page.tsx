import Link from "next/link";
import { SessionList } from "@/components/session-list";

/**
 * Landing view. Left rail lists sessions; the main pane surfaces the
 * setup path for first-time users — the common "how do I get started"
 * question is answered inline instead of buried in a README.
 */
export default function Home() {
  return (
    <>
      <SessionList />
      <main className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          aios console
        </div>
        <div className="font-mono text-sm text-foreground/80 max-w-md">
          pick a session on the left, or click{" "}
          <span className="text-foreground">+ new</span> to create one
        </div>
        <div className="font-mono text-[11px] text-muted-foreground/70 max-w-md pt-4 border-t border-border/30 mt-4">
          first time? you&apos;ll need at least one{" "}
          <Link
            href="/agents"
            className="text-foreground underline underline-offset-2"
          >
            agent
          </Link>{" "}
          and one{" "}
          <Link
            href="/environments"
            className="text-foreground underline underline-offset-2"
          >
            environment
          </Link>{" "}
          before you can open a session.
        </div>
      </main>
    </>
  );
}
