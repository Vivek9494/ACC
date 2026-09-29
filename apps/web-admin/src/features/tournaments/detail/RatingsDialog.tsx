import { REGISTRATION_RATING_OPTIONS, type RegistrationSummary, type UpdateRatingsRequest } from '@acc/types';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage } from '@/lib/api-client';

const NOT_RATED = 'none';

type RatingKey = 'battingRating' | 'bowlingRating' | 'fieldingRating';

const RATING_FIELDS: readonly { key: RatingKey; label: string }[] = [
  { key: 'battingRating', label: 'Batting' },
  { key: 'bowlingRating', label: 'Bowling' },
  { key: 'fieldingRating', label: 'Fielding' },
];

type RatingValues = Record<RatingKey, number | null>;

const valuesFrom = (row: RegistrationSummary | null): RatingValues => ({
  battingRating: row?.battingRating ?? null,
  bowlingRating: row?.bowlingRating ?? null,
  fieldingRating: row?.fieldingRating ?? null,
});

export interface RatingsDialogProps {
  row: RegistrationSummary | null;
  onOpenChange: (open: boolean) => void;
  /** Rejecting keeps the dialog open and shows the error inline. */
  onSave: (row: RegistrationSummary, body: UpdateRatingsRequest) => Promise<void>;
}

/** Edit a registrant's bat / bowl / field ratings (0–10), like the mobile Verify Players sheet. */
export function RatingsDialog({ row, onOpenChange, onSave }: RatingsDialogProps): React.ReactElement {
  const [values, setValues] = useState<RatingValues>(() => valuesFrom(row));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(valuesFrom(row));
    setError(null);
  }, [row]);

  const handleOpenChange = (next: boolean) => {
    if (!pending) onOpenChange(next);
  };

  const save = async () => {
    if (!row) return;
    setPending(true);
    setError(null);
    try {
      await onSave(row, values);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not save ratings.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={row !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit ratings</DialogTitle>
          <DialogDescription>
            {row ? `${row.firstName} ${row.lastName} · ${row.centerName}` : null}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          {RATING_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`rating-${field.key}`}>{field.label}</Label>
              <Select
                value={values[field.key] === null ? NOT_RATED : String(values[field.key])}
                onValueChange={(v) =>
                  setValues((current) => ({ ...current, [field.key]: v === NOT_RATED ? null : Number(v) }))
                }
              >
                <SelectTrigger id={`rating-${field.key}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NOT_RATED}>Not rated</SelectItem>
                  {REGISTRATION_RATING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        {error ? (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={pending || !row}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save ratings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
