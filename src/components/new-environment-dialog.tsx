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
import { Plus } from "lucide-react";

/**
 * Create an environment. The aios environment resource holds sandbox
 * container config (pre-installed packages, network policies) — devs
 * on first setup just need a named default, so the dialog only surfaces
 * ``name``. Everything else can be added via the API when needed.
 */
export function NewEnvironmentDialog({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("default");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createEnvironment({ name: name.trim() });
      setOpen(false);
      setName("default");
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
            data-testid="new-environment-button"
          />
        }
      >
        <Plus className="size-3" />
        new environment
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">new environment</DialogTitle>
          <DialogDescription>
            An environment holds sandbox container config for sessions that
            use shell tools. Most setups just need one named{" "}
            <code>default</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="env-name" className="font-mono text-xs uppercase">
              name
            </Label>
            <Input
              id="env-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-mono text-xs"
              data-testid="environment-name-input"
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
            disabled={!name.trim() || submitting}
            data-testid="create-environment-submit"
          >
            {submitting ? "creating…" : "create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
