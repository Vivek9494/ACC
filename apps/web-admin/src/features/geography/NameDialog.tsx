import { Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api-client';

import { GEOGRAPHY_NAME_MAX, validateGeographyName } from './geography';

export interface NameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** "Province" / "Center" — used in the field label and validation. */
  entityLabel: string;
  initialName: string;
  submitLabel: string;
  /** Extra fields rendered under the name (e.g. the center's province). */
  children?: ReactNode;
  /** Rejecting keeps the dialog open and shows the server message inline. */
  onSubmit: (name: string) => Promise<void>;
}

/** Create / rename dialog for provinces and centers. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  entityLabel,
  initialName,
  submitLabel,
  children,
  onSubmit,
}: NameDialogProps): React.ReactElement {
  const [name, setName] = useState(initialName);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setFieldError(null);
      setFormError(null);
    }
  }, [open, initialName]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = validateGeographyName(name, entityLabel);
    setFieldError(invalid);
    if (invalid) return;
    setPending(true);
    setFormError(null);
    try {
      await onSubmit(name.trim());
      onOpenChange(false);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="geography-name">{entityLabel} name</Label>
            <Input
              id="geography-name"
              value={name}
              maxLength={GEOGRAPHY_NAME_MAX}
              onChange={(e) => {
                setName(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError !== null}
              autoFocus
            />
            {fieldError ? <p className="text-sm text-destructive">{fieldError}</p> : null}
          </div>
          {children}
          {formError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
