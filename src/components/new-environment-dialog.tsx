"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
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
import { FormField } from "@/components/form-field";
import { DialogFormFooter } from "@/components/dialog-form-footer";
import { Plus } from "lucide-react";

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
          <FormField id="env-name" label="name">
            <Input
              id="env-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-mono text-xs"
              data-testid="environment-name-input"
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
          submitDisabled={!name.trim()}
          onCancel={() => setOpen(false)}
          onSubmit={create}
          submitTestId="create-environment-submit"
        />
      </DialogContent>
    </Dialog>
  );
}
