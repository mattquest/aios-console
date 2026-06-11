import { SessionList } from "@/components/session-list";
import { SessionView } from "@/components/session-view";

type Params = Promise<{ id: string }>;

export default async function SessionPage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <>
      <SessionList activeId={id} />
      {/* Keyed so per-session state (approval decisions, agent name)
          resets when navigating between sessions. */}
      <SessionView key={id} sessionId={id} />
    </>
  );
}
