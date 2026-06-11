"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { Agent, Environment } from "@/lib/types";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { cn } from "@/lib/utils";

const MODEL_PRESETS = [
  "anthropic/claude-sonnet-4-6",
  "openai/gpt-5",
  "ollama/llama3.3",
] as const;

const DEFAULT_SYSTEM = "You are a helpful assistant.";

/**
 * Guided first run, shown when the backend has zero agents: create an
 * agent, create (or adopt) an environment, start the first session.
 * Reuses the same API calls as the resource dialogs — this is a flow,
 * not a new surface area.
 */
export function FirstRunWizard() {
  const router = useRouter();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  // An environment may already exist even when no agents do — offer to
  // use it rather than creating a duplicate.
  const [existingEnv, setExistingEnv] = useState<Environment | null>(null);

  const [name, setName] = useState("assistant");
  const [model, setModel] = useState("");
  const [system, setSystem] = useState(DEFAULT_SYSTEM);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listEnvironments()
      .then((r) => {
        if (!cancelled) setExistingEnv(r.data[0] ?? null);
      })
      .catch(() => {
        /* the create step will surface any real failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const step = agent === null ? 1 : environment === null ? 2 : 3;

  const createAgent = async () => {
    if (!name.trim() || !model.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createAgent({
        name: name.trim(),
        model: model.trim(),
        system,
        tools: [{ type: "search_events" }],
      });
      setAgent(created);
    } catch (e) {
      setError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const createEnvironment = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const env =
        existingEnv ?? (await api.createEnvironment({ name: "default" }));
      setEnvironment(env);
    } catch (e) {
      setError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const startSession = async () => {
    if (!agent || !environment) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await api.createSession(agent.id, environment.id);
      router.push(`/sessions/${session.id}`);
    } catch (e) {
      setError(e);
      setSubmitting(false);
    }
    /* on success the wizard unmounts via navigation — leave submitting on */
  };

  return (
    <main className="flex-1 min-w-0 overflow-y-auto">
      <div
        data-testid="first-run-wizard"
        className="max-w-2xl mx-auto px-4 sm:px-8 py-10 lg:py-14 space-y-6 animate-rise"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-pico text-muted-foreground">
            <span className="text-signal">{"//"}</span>
            <span>first_run</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="normal-case tracking-[0.12em]">
              step {step} / 3
            </span>
          </div>
          <h1 className="text-display text-[clamp(1.3rem,2.4vw,1.8rem)] leading-tight tracking-[-0.025em] text-foreground">
            <span className="text-muted-foreground/50">›</span> set up your
            first agent
          </h1>
          <p className="font-sans text-[13.5px] text-muted-foreground leading-[1.65] max-w-xl">
            This backend has no agents yet. Three steps gets you to a working
            chat: an agent (model + prompt), an environment, and a session.
          </p>
        </div>

        {/* step 1 — agent */}
        <WizardStep
          number={1}
          title="create an agent"
          state={step > 1 ? "done" : "active"}
          summary={agent ? `${agent.name} · ${agent.model}` : null}
        >
          <FormField id="wizard-agent-name" label="name">
            <Input
              id="wizard-agent-name"
              data-testid="wizard-agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-mono text-xs"
            />
          </FormField>
          <FormField id="wizard-agent-model" label="model">
            <Input
              id="wizard-agent-model"
              data-testid="wizard-agent-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="any LiteLLM model string"
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {MODEL_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`wizard-preset-${m.split("/")[0]}`}
                  onClick={() => setModel(m)}
                  className={cn(
                    "font-mono text-[10px] px-2 py-1 rounded-sm border transition-colors",
                    model === m
                      ? "border-signal/60 text-foreground bg-signal/10"
                      : "border-border/60 bg-background/50 text-foreground/80 hover:border-foreground/40",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-mono text-muted-foreground pt-1">
              Provider keys (ANTHROPIC_API_KEY, …) live in the aios
              backend&apos;s .env, not here.
            </p>
          </FormField>
          <FormField id="wizard-agent-system" label="system prompt">
            <Textarea
              id="wizard-agent-system"
              data-testid="wizard-agent-system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={3}
              className="font-mono text-xs resize-none"
            />
          </FormField>
          <div>
            <Button
              size="sm"
              onClick={() => void createAgent()}
              disabled={submitting || !name.trim() || !model.trim()}
              className="h-7 font-mono text-[10px] uppercase tracking-wider"
              data-testid="wizard-create-agent"
            >
              {submitting ? "creating…" : "create agent"}
            </Button>
          </div>
        </WizardStep>

        {/* step 2 — environment */}
        <WizardStep
          number={2}
          title="create an environment"
          state={step > 2 ? "done" : step === 2 ? "active" : "pending"}
          summary={environment ? environment.name : null}
        >
          <p className="font-sans text-[12.5px] text-muted-foreground leading-relaxed">
            {existingEnv
              ? `An environment named "${existingEnv.name}" already exists — sessions can use it as-is.`
              : "Sessions run inside an environment (sandbox config for shell tools). One named default is plenty."}
          </p>
          <div>
            <Button
              size="sm"
              onClick={() => void createEnvironment()}
              disabled={submitting}
              className="h-7 font-mono text-[10px] uppercase tracking-wider"
              data-testid="wizard-create-environment"
            >
              {submitting
                ? "working…"
                : existingEnv
                  ? `use ${existingEnv.name}`
                  : "create default environment"}
            </Button>
          </div>
        </WizardStep>

        {/* step 3 — session */}
        <WizardStep
          number={3}
          title="start your first session"
          state={step === 3 ? "active" : "pending"}
          summary={null}
        >
          <p className="font-sans text-[12.5px] text-muted-foreground leading-relaxed">
            Opens a live chat with {agent?.name ?? "your agent"}. You can send
            messages at any time — even while it&apos;s working.
          </p>
          <div>
            <Button
              size="sm"
              onClick={() => void startSession()}
              disabled={submitting}
              className="h-7 font-mono text-[10px] uppercase tracking-wider"
              data-testid="wizard-start-session"
            >
              {submitting ? "starting…" : "start session"}
            </Button>
          </div>
        </WizardStep>

        {error != null && <ErrorBanner error={error} testId="wizard-error" />}
      </div>
    </main>
  );
}

function WizardStep({
  number,
  title,
  state,
  summary,
  children,
}: {
  number: number;
  title: string;
  state: "pending" | "active" | "done";
  summary: string | null;
  children: React.ReactNode;
}) {
  return (
    <section
      data-testid={`wizard-step-${number}`}
      data-state={state}
      className={cn(
        "rounded-sm border backdrop-blur-sm overflow-hidden transition-colors",
        state === "active"
          ? "border-signal/40 bg-card/40"
          : "border-border/60 bg-card/20",
      )}
    >
      <div className="px-4 py-2 flex items-center gap-2 border-b border-border/50 text-pico text-muted-foreground">
        <span
          className={cn(
            "size-1.5 rounded-full",
            state === "done"
              ? "bg-signal"
              : state === "active"
                ? "bg-signal-warn animate-signal"
                : "bg-muted-foreground/40",
          )}
        />
        <span className="tabular-nums">0{number}</span>
        <span className="text-foreground/80 normal-case tracking-[0.14em]">
          {title}
        </span>
        <span className="ml-auto normal-case tracking-[0.12em]">
          {state === "done" ? "done" : state === "active" ? "now" : "next"}
        </span>
      </div>
      {state === "done" && summary ? (
        <div className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
          <span className="text-signal">✓</span> {summary}
        </div>
      ) : state === "active" ? (
        <div className="px-4 py-4 space-y-4">{children}</div>
      ) : null}
    </section>
  );
}
