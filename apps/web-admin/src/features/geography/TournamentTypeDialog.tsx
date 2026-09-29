import { BallType, type CreateTournamentTypeDefinitionRequest } from '@acc/types';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

import {
  BALL_TYPE_OPTIONS,
  TOURNAMENT_TYPE_NAME_MAX,
  toggleId,
  validateTournamentTypeForm,
  type TournamentTypeFormErrors,
  type TournamentTypeFormValues,
} from './geography';
import { useAdminCenters, useAdminProvinces, useTournamentType } from './geography-admin-api';

const EMPTY: TournamentTypeFormValues = {
  ballType: BallType.Tennis,
  name: '',
  provinceId: null,
  centerIds: [],
};

export interface TournamentTypeDialogProps {
  /** `null` closed, `'new'` create, otherwise the type id to edit. */
  target: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string | null, body: CreateTournamentTypeDefinitionRequest) => Promise<void>;
}

function FieldError({ message }: { message?: string }): React.ReactElement | null {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

/** Create / edit a tournament type: ball type → name → province → participating centers (mobile order). */
export function TournamentTypeDialog({
  target,
  onOpenChange,
  onSubmit,
}: TournamentTypeDialogProps): React.ReactElement {
  const editId = target && target !== 'new' ? target : null;
  const detail = useTournamentType(editId);
  const provinces = useAdminProvinces();

  const [values, setValues] = useState<TournamentTypeFormValues>(EMPTY);
  const [errors, setErrors] = useState<TournamentTypeFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const centers = useAdminCenters(values.provinceId);

  useEffect(() => {
    if (target === null) return;
    setErrors({});
    setFormError(null);
    if (!editId) {
      setValues(EMPTY);
    } else if (detail.data) {
      setValues({
        ballType: detail.data.ballType,
        name: detail.data.name,
        provinceId: detail.data.provinceId,
        centerIds: detail.data.centerIds,
      });
    }
  }, [target, editId, detail.data]);

  const provinceOptions = useMemo(
    () =>
      (provinces.data ?? []).filter((p) => p.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [provinces.data],
  );
  const centerOptions = useMemo(
    () =>
      (centers.data ?? []).filter((c) => c.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [centers.data],
  );
  const selectable = new Set(centerOptions.map((c) => c.id));
  const selectedCount = values.centerIds.filter((id) => selectable.has(id)).length;
  const allSelected = centerOptions.length > 0 && selectedCount === centerOptions.length;

  const loadingDetail = Boolean(editId) && detail.isPending;

  const update = (patch: Partial<TournamentTypeFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([key]) => !(key in patch))));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Archived / moved centers can't be linked; keep only centers still offered for this province.
    const centerIds = values.centerIds.filter((id) => selectable.has(id));
    const next = validateTournamentTypeForm({ ...values, centerIds });
    setErrors(next);
    if (Object.keys(next).length > 0 || !values.provinceId) return;
    setPending(true);
    setFormError(null);
    try {
      await onSubmit(editId, {
        ballType: values.ballType,
        name: values.name.trim(),
        provinceId: values.provinceId,
        centerIds,
      });
      onOpenChange(false);
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the tournament type.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit tournament type' : 'Add tournament type'}</DialogTitle>
            <DialogDescription>
              Tournaments created with this type use its participating centers.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : detail.isError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {errorMessage(detail.error, 'Could not load this tournament type.')}
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Ball type</Label>
                <div>
                  <SegmentedControl
                    ariaLabel="Ball type"
                    value={values.ballType}
                    options={BALL_TYPE_OPTIONS}
                    onChange={(ballType) => update({ ballType })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="type-name">Name</Label>
                <Input
                  id="type-name"
                  value={values.name}
                  maxLength={TOURNAMENT_TYPE_NAME_MAX}
                  placeholder="e.g. APL"
                  onChange={(e) => update({ name: e.target.value })}
                  aria-invalid={Boolean(errors.name)}
                />
                <FieldError message={errors.name} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="type-province">Province</Label>
                <Select
                  value={values.provinceId ?? undefined}
                  onValueChange={(provinceId) => update({ provinceId, centerIds: [] })}
                  disabled={provinces.isPending}
                >
                  <SelectTrigger id="type-province" aria-invalid={Boolean(errors.provinceId)}>
                    <SelectValue
                      placeholder={provinces.isPending ? 'Loading provinces…' : 'Select province'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {provinceOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.provinceId} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Participating centers</Label>
                  {centerOptions.length > 0 ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() =>
                        update({ centerIds: allSelected ? [] : centerOptions.map((c) => c.id) })
                      }
                    >
                      {allSelected ? 'Clear all' : 'Select all'}
                    </button>
                  ) : null}
                </div>
                <div
                  className={cn(
                    'max-h-56 overflow-y-auto rounded-md border bg-card p-1',
                    errors.centerIds && 'border-destructive',
                  )}
                >
                  {!values.provinceId ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      Select a province first.
                    </p>
                  ) : centers.isPending ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">Loading centers…</p>
                  ) : centerOptions.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      This province has no active centers.
                    </p>
                  ) : (
                    centerOptions.map((center) => (
                      <label
                        key={center.id}
                        className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={values.centerIds.includes(center.id)}
                          onChange={() =>
                            update({ centerIds: toggleId(values.centerIds, center.id) })
                          }
                        />
                        {center.name}
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedCount} of {centerOptions.length} selected
                </p>
                <FieldError message={errors.centerIds} />
              </div>
            </>
          )}

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
            <Button type="submit" disabled={pending || loadingDetail || detail.isError}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {editId ? 'Save changes' : 'Save tournament type'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
