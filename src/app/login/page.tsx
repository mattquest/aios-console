"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!resp.ok) {
        setError(resp.status === 401 ? "wrong password" : `login failed (${resp.status})`);
        return;
      }
      const from = params.get("from");
      // Hard navigation: the session cookie is set on this fetch response and
      // client-side router.replace can fail to pick it up before the auth gate
      // runs, leaving the operator stuck on /login despite a 200.
      window.location.href = from && from.startsWith("/") ? from : "/";
    } catch {
      setError("login failed — is the console server reachable?");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border border-border/60 rounded-sm bg-card/30 p-6 space-y-4"
        data-testid="login-form"
      >
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="bracket-label">auth</span>operator login
          </div>
          <p className="font-sans text-[12px] text-muted-foreground/80 leading-relaxed">
            This console controls your assistant and can read everything it
            knows. Enter the console password (CONSOLE_PASSWORD in the
            console&apos;s environment).
          </p>
        </div>
        <Input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="console password"
          className="font-mono text-[13px]"
          data-testid="login-password"
        />
        {error && (
          <p className="font-mono text-[11px] text-signal-alert" data-testid="login-error">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={!password || submitting}
          className="w-full h-8 font-mono text-[10px] uppercase tracking-wider"
          data-testid="login-submit"
        >
          {submitting ? "checking…" : "unlock"}
        </Button>
      </form>
    </div>
  );
}
