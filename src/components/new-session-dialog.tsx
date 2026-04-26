"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { Agent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

/**
 * Create a new session. Requires at least one agent to exist — the dialog
 * surfaces an actionable empty state rather than a silent failure when
 * no agents are configured in the backend.
 */
export function NewSessionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [initialMessage, setInitialMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api
      .listAgents()
      .then((r) => {
        setAgents(r.data);
        if (r.data.length && !agentId) setAgentId(r.data[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [open, agentId]);

  const create = async () => {
    if (!agentId) return;
    setSubmitting(true);
    setError(null);
    try {
      const s = await api.createSession(
        agentId,
        initialMessage.trim() || undefined,
      );
      setOpen(false);
      setInitialMessage("");
      router.push(`/sessions/${s.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 font-mono text-[10px] uppercase"
            data-testid="new-session-button"
          />
        }
      >
        <Plus className="size-3" />
        new
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">new session</DialogTitle>
          <DialogDescription>
            Start a session bound to an agent. The initial message is
            optional — leave blank to create an empty session you can poke
            with curl.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="agent" className="font-mono text-xs uppercase">
              agent
            </Label>
            {agents.length === 0 ? (
              <div className="text-xs text-muted-foreground font-mono">
                no agents found — create one via POST /v1/agents first
              </div>
            ) : (
              <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "")}>
                <SelectTrigger id="agent" className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="font-mono text-xs">
                      {a.name} ·{" "}
                      <span className="text-muted-foreground">{a.model}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-2">
            <Label
              htmlFor="initial-message"
              className="font-mono text-xs uppercase"
            >
              initial message
            </Label>
            <Textarea
              id="initial-message"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="(optional) what should the agent do first?"
              rows={3}
              className="font-mono text-xs resize-none"
            />
          </div>
          {error && (
            <div className="text-xs text-destructive font-mono break-all">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            cancel
          </Button>
          <Button
            size="sm"
            onClick={create}
            disabled={!agentId || submitting}
            data-testid="create-session-submit"
          >
            {submitting ? "creating…" : "create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
