import { SessionList } from "@/components/session-list";
import { SessionView } from "@/components/session-view";

type Params = Promise<{ id: string }>;

export default async function SessionPage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <>
      <SessionList activeId={id} />
      <SessionView sessionId={id} />
    </>
  );
}
