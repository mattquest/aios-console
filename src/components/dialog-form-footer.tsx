import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface Props {
  submitting: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  onCancel: () => void;
  onSubmit: () => void;
  submitTestId?: string;
}

/** Create-dialog footer: cancel + primary submit with busy state. */
export function DialogFormFooter({
  submitting,
  submitDisabled,
  submitLabel = "create",
  pendingLabel = "creating…",
  onCancel,
  onSubmit,
  submitTestId,
}: Props) {
  return (
    <DialogFooter>
      <Button
        variant="outline"
        size="sm"
        onClick={onCancel}
        disabled={submitting}
      >
        cancel
      </Button>
      <Button
        size="sm"
        onClick={onSubmit}
        disabled={submitDisabled || submitting}
        data-testid={submitTestId}
      >
        {submitting ? pendingLabel : submitLabel}
      </Button>
    </DialogFooter>
  );
}
