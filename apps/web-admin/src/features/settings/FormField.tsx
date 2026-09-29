import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface FormFieldProps extends Omit<
  React.ComponentProps<typeof Input>,
  'id' | 'value' | 'onChange' | 'aria-invalid'
> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: React.ReactNode;
}

/** Label + input + error/hint line, the one form row shape used across Settings. */
export function FormField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  ...inputProps
}: FormFieldProps): React.ReactElement {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
