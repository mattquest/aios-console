// Back-compat re-export. The dialog now lives in agent-dialog.tsx, which
// handles both create + edit. Existing call sites that import
// `{ NewAgentDialog } from "@/components/new-agent-dialog"` keep working
// via the re-export below.
export { NewAgentDialog } from "@/components/agent-dialog";
