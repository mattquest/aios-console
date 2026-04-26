"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

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

/**
 * Create an agent without curl. Covers the fields a typical user sets up
 * front: name, LiteLLM model string, system prompt, tool checkboxes.
 * Advanced knobs (skills, mcp_servers, triage, window min/max) stay in
 * the API for now — adding them here would crowd the dialog and users
 * rarely need them on first setup.
 */
export function NewAgentDialog({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [model, setModel] = useState(
    "openai/mlx-community/Qwen3.6-35B-A3B-4bit-DWQ",
  );
  const [system, setSystem] = useState("You are a helpful assistant.");
  const [tools, setTools] = useState<Set<string>>(new Set(DEFAULT_TOOLS));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTool = (t: string) =>
    setTools((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const reset = () => {
    setName("");
    setSystem("You are a helpful assistant.");
    setTools(new Set(DEFAULT_TOOLS));
    setError(null);
  };

  const create = async () => {
    if (!name.trim() || !model.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createAgent({
        name: name.trim(),
        model: model.trim(),
        system,
        tools: [...tools].map((t) => ({ type: t })),
      });
      setOpen(false);
      reset();
      onCreated?.();
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
            size="sm"
            className="h-7 font-mono text-[10px] uppercase"
            data-testid="new-agent-button"
          />
        }
      >
        <Plus className="size-3" />
        new agent
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">new agent</DialogTitle>
          <DialogDescription>
            Agents bind a model to a system prompt + toolset. The{" "}
            <code>model</code> field is any LiteLLM-compatible URL — cloud
            provider keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc) live in
            the aios backend&apos;s <code>.env</code>, not here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field id="agent-name" label="name">
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="chat"
              className="font-mono text-xs"
              data-testid="agent-name-input"
            />
          </Field>
          <Field id="agent-model" label="model (LiteLLM URL)">
            <Input
              id="agent-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="openai/... · anthropic/... · openrouter/..."
              className="font-mono text-xs"
              data-testid="agent-model-input"
            />
          </Field>
          <Field id="agent-system" label="system prompt">
            <Textarea
              id="agent-system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={4}
              className="font-mono text-xs resize-none"
            />
          </Field>
          <Field id="agent-tools" label="tools">
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
          </Field>
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
            disabled={!name.trim() || !model.trim() || submitting}
            data-testid="create-agent-submit"
          >
            {submitting ? "creating…" : "create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="font-mono text-xs uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
