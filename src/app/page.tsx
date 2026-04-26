import { SessionList } from "@/components/session-list";

/**
 * Landing view. Left rail lists sessions; the main pane prompts the user
 * to pick or create one. No auto-redirect to the most recent session —
 * devs often want to land on an empty state, create a fresh one, and
 * compare side by side across tabs.
 */
export default function Home() {
  return (
    <div className="flex-1 flex min-h-0 h-screen">
      <SessionList />
      <main className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          aios console
        </div>
        <div className="font-mono text-sm text-foreground/80 max-w-md">
          pick a session on the left, or click{" "}
          <span className="text-foreground">new</span> to create one
        </div>
      </main>
    </div>
  );
}
