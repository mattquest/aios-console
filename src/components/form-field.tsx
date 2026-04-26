import { Label } from "@/components/ui/label";

interface FormFieldProps {
  id: string;
  label: string;
  children: React.ReactNode;
}

/** Label + input grouping used by all the create-dialogs. */
export function FormField({ id, label, children }: FormFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="font-mono text-xs uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
