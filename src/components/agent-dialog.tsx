"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { Agent } from "@/lib/types";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { DialogFormFooter } from "@/components/dialog-form-footer";
import { Plus, Pencil } from "lucide-react";

const BUILTIN_TOOLS = [
  "bash",
  "read",
  "write",
  "edit",
  "glob",
  "grep",
  "web_fetch",
  "web_search",
  "search_events",
] as const;

const DEFAULT_TOOLS: ReadonlySet<string> = new Set(["search_events"]);

type AgentDialogProps =
  | {
      mode: "create";
      onSaved?: (agent: Agent) => void;
      agent?: never;
    }
  | {
      mode: "edit";
      agent: Agent;
      onSaved?: (agent: Agent) => void;
    };

/**
 * Single dialog that handles both creating and editing an agent.
 *
 * - create: blank form, POST /v1/agents.
 * - edit:   pre-fills from `agent`, PUT /v1/agents/{id} with the current
 *           `version` for optimistic concurrency (the server only writes a
 *           new version if config actually changes).
 */
export function AgentDialog(props: AgentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial = props.mode === "edit" ? props.agent : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [system, setSystem] = useState(
    initial?.system ?? "You are a helpful assistant.",
  );
  const [tools, setTools] = useState<Set<string>>(
    initial
      ? new Set((initial.tools ?? []).map((t) => t.type))
      : new Set(DEFAULT_TOOLS),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync form state when the dialog (re)opens — covers edits to agents
  // that updated server-side after the row first rendered. Runs in the
  // open-change event handler rather than an effect, so render stays
  // free of cascading state writes.
  const handleOpenChange = (next: boolean) => {
    if (next && initial) {
      setName(initial.name);
      setModel(initial.model);
      setSystem(initial.system);
      setTools(new Set((initial.tools ?? []).map((t) => t.type)));
      setError(null);
    }
    setOpen(next);
  };

  const toggleTool = (t: string) =>
    setTools((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const resetCreate = () => {
    setName("");
    setSystem("You are a helpful assistant.");
    setTools(new Set(DEFAULT_TOOLS));
    setError(null);
  };

  const submit = async () => {
    if (!name.trim() || !model.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved =
        props.mode === "create"
          ? await api.createAgent({
              name: name.trim(),
              model: model.trim(),
              system,
              tools: [...tools].map((t) => ({ type: t })),
            })
          : await api.updateAgent(props.agent.id, {
              version: props.agent.version,
              name: name.trim(),
              model: model.trim(),
              system,
              tools: [...tools].map((t) => ({ type: t })),
            });
      setOpen(false);
      if (props.mode === "create") resetCreate();
      props.onSaved?.(saved);
      router.refresh();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const isCreate = props.mode === "create";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          isCreate ? (
            <Button
              size="sm"
              className="h-7 font-mono text-[10px] uppercase"
              data-testid="new-agent-button"
            />
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 font-mono text-[10px] uppercase"
              data-testid={`edit-agent-${props.agent.id}`}
              aria-label={`Edit agent ${props.agent.name}`}
            />
          )
        }
      >
        {isCreate ? (
          <>
            <Plus className="size-3" />
            new agent
          </>
        ) : (
          <>
            <Pencil className="size-3" />
            edit
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {isCreate ? "new agent" : `edit · ${name || "agent"}`}
          </DialogTitle>
          <DialogDescription>
            {isCreate ? (
              <>
                Agents bind a model to a system prompt + toolset. The{" "}
                <code>model</code> field is any LiteLLM-compatible URL — cloud
                provider keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc) live in
                the aios backend&apos;s <code>.env</code>, not here.
              </>
            ) : (
              <>
                Every saved change creates a new immutable agent version.
                Sessions that pin to the prior version keep their config;
                new sessions get the update.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField id="agent-name" label="name">
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="chat"
              className="font-mono text-xs"
              data-testid="agent-name-input"
            />
          </FormField>
          <FormField id="agent-model" label="model (LiteLLM URL)">
            <Input
              id="agent-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="anthropic/claude-sonnet-4-6 · openrouter/… · openai/…"
              className="font-mono text-xs"
              data-testid="agent-model-input"
            />
          </FormField>
          <FormField id="agent-system" label="system prompt">
            <Textarea
              id="agent-system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={4}
              className="font-mono text-xs resize-none"
            />
          </FormField>
          <FormField id="agent-tools" label="tools">
            <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
              {BUILTIN_TOOLS.map((t) => (
                <label
                  key={t}
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={tools.has(t)}
                    onChange={() => toggleTool(t)}
                    className="accent-foreground"
                  />
                  {t}
                </label>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground pt-1">
              Note: bash/read/write/edit/glob/grep require Docker (sandbox) on
              the aios host; web_fetch/web_search require{" "}
              <code>AIOS_TAVILY_API_KEY</code>; search_events works
              unconditionally.
            </div>
          </FormField>
          {error && (
            <div className="text-xs text-destructive font-mono break-all">
              {error}
            </div>
          )}
        </div>
        <DialogFormFooter
          submitting={submitting}
          submitDisabled={!name.trim() || !model.trim()}
          onCancel={() => setOpen(false)}
          onSubmit={submit}
          submitTestId={isCreate ? "create-agent-submit" : "save-agent-submit"}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Back-compat wrapper. The original component name is referenced in tests
 * and in agents/page.tsx — keep the export until those are migrated.
 */
export function NewAgentDialog({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  return <AgentDialog mode="create" onSaved={() => onCreated?.()} />;
}
