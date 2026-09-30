import {
  GROUP_FORM_MESSAGES,
  GROUP_NAME_MAX_LENGTH,
  type GroupSummary,
  normalizeGroupName,
  type TeamSummary,
  validateGroupName,
} from '@acc/types';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { TeamLogo } from '@/components/TeamLogo';
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
import { ApiError, errorMessage } from '@/lib/api-client';

import { unassignedTeams } from './tournament-detail';

export interface GroupDialogValues {
  name: string;
  teamIds: string[];
}

export interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = Add New Group; otherwise the group being edited. */
  group: GroupSummary | null;
  groups: readonly GroupSummary[];
  teams: readonly TeamSummary[];
  /** Rejecting keeps the dialog open; a server `fields.name` error lands under the name. */
  onSubmit: (values: GroupDialogValues) => Promise<void>;
}

/** Add / edit group: name plus its teams, picked from this group's teams and unassigned ones. */
export function GroupDialog({
  open,
  onOpenChange,
  group,
  groups,
  teams,
  onSubmit,
}: GroupDialogProps): React.ReactElement {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setSelected(new Set(group?.teams.map((team) => team.id) ?? []));
    setNameError(null);
    setFormError(null);
  }, [open, group]);

  const options = [
    ...(group?.teams ?? []),
    ...unassignedTeams(teams),
  ].sort((left, right) => left.name.localeCompare(right.name));

  const toggle = (teamId: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(teamId);
      else next.delete(teamId);
      return next;
    });
  };

  const duplicateName = (value: string): boolean => {
    const normalized = normalizeGroupName(value);
    return groups.some((other) => other.id !== group?.id && normalizeGroupName(other.name) === normalized);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const invalid =
      validateGroupName(name) ?? (duplicateName(name) ? GROUP_FORM_MESSAGES.name.duplicate : null);
    setNameError(invalid);
    if (invalid) return;
    setPending(true);
    setFormError(null);
    try {
      await onSubmit({ name: name.trim(), teamIds: [...selected] });
      onOpenChange(false);
    } catch (err) {
      const fieldError = err instanceof ApiError ? err.fields.name : undefined;
      if (fieldError) setNameError(fieldError);
      else setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{group ? 'Edit Group' : 'Add New Group'}</DialogTitle>
            <DialogDescription>
              {group
                ? 'Rename the group, add unassigned teams, or remove teams.'
                : 'Name the group and choose its teams.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              value={name}
              maxLength={GROUP_NAME_MAX_LENGTH}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              aria-invalid={nameError !== null}
              autoFocus
            />
            {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
          </div>

          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium">Teams</legend>
            {options.length === 0 ? (
              <p className="rounded-md border px-3 py-4 text-center text-sm text-muted-foreground">
                No unassigned teams.
              </p>
            ) : (
              <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
                {options.map((team) => (
                  <li key={team.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-primary"
                        checked={selected.has(team.id)}
                        onChange={(e) => toggle(team.id, e.target.checked)}
                        disabled={pending}
                      />
                      <TeamLogo name={team.name} logoUrl={team.logoUrl} className="size-7 text-xs" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{team.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          {formError ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {group ? 'Save changes' : 'Add Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
