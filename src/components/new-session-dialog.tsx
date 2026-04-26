"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { Agent, Environment } from "@/lib/types";
import { toErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { DialogFormFooter } from "@/components/dialog-form-footer";
import { Plus } from "lucide-react";

function agentLabel(agents: Agent[], id: string): string | null {
  const a = agents.find((x) => x.id === id);
  return a ? `${a.name} · ${a.model}` : null;
}

export function NewSessionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [environmentId, setEnvironmentId] = useState<string>("");
  const [initialMessage, setInitialMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([api.listAgents(), api.listEnvironments()])
      .then(([agentsResp, envResp]) => {
        setAgents(agentsResp.data);
        setEnvironments(envResp.data);
        setAgentId((prev) => prev || agentsResp.data[0]?.id || "");
        setEnvironmentId((prev) => prev || envResp.data[0]?.id || "");
      })
      .catch((e) => setError(toErrorMessage(e)));
  }, [open]);

  const create = async () => {
    if (!agentId || !environmentId) return;
    setSubmitting(true);
    setError(null);
    try {
      const s = await api.createSession(
        agentId,
        environmentId,
        initialMessage.trim() || undefined,
      );
      setOpen(false);
      setInitialMessage("");
      router.push(`/sessions/${s.id}`);
      router.refresh();
    } catch (e) {
      setError(toErrorMessage(e));
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
          <FormField id="agent" label="agent">
            {agents.length === 0 ? (
              <div className="text-xs text-muted-foreground font-mono">
                no agents found — create one via POST /v1/agents first
              </div>
            ) : (
              <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "")}>
                {/* base-ui's SelectValue falls back to the raw value when it
                    can't find a rendered item to mirror — with UUIDs that's
                    unreadable. Derive the label client-side instead. */}
                <SelectTrigger
                  id="agent"
                  className="w-full font-mono text-xs [&>span]:truncate"
                >
                  <SelectValue>
                    {agentLabel(agents, agentId) ?? "select agent…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="font-mono text-xs">
                      {`${a.name} · ${a.model}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField id="environment" label="environment">
            {environments.length === 0 ? (
              <div className="text-xs text-muted-foreground font-mono">
                no environments found — create one via POST /v1/environments
              </div>
            ) : (
              <Select
                value={environmentId}
                onValueChange={(v) => setEnvironmentId(v ?? "")}
              >
                <SelectTrigger
                  id="environment"
                  className="w-full font-mono text-xs [&>span]:truncate"
                >
                  <SelectValue>
                    {environments.find((e) => e.id === environmentId)?.name ??
                      "select environment…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {environments.map((e) => (
                    <SelectItem
                      key={e.id}
                      value={e.id}
                      className="font-mono text-xs"
                    >
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField id="initial-message" label="initial message">
            <Textarea
              id="initial-message"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="(optional) what should the agent do first?"
              rows={3}
              className="font-mono text-xs resize-none"
            />
          </FormField>
          {error && (
            <div className="text-xs text-destructive font-mono break-all">
              {error}
            </div>
          )}
        </div>
        <DialogFormFooter
          submitting={submitting}
          submitDisabled={!agentId || !environmentId}
          onCancel={() => setOpen(false)}
          onSubmit={create}
          submitTestId="create-session-submit"
        />
      </DialogContent>
    </Dialog>
  );
}
