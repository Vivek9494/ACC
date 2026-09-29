import {
  TEAM_FORM_MESSAGES,
  TEAM_NAME_MAX_LENGTH,
  type TeamSummary,
  normalizeTeamName,
  validateTeamName,
} from '@acc/types';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
import { cn } from '@/lib/utils';

import { uploadTeamLogo } from './tournament-detail-api';

export interface TeamDialogValues {
  name: string;
  /** Storage key of a newly uploaded logo; undefined keeps the current one. */
  logoStorageKey?: string;
}

export interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = Add Team; otherwise the team being edited. */
  team: TeamSummary | null;
  /** Other teams in the tournament, for the duplicate-name check. */
  teams: readonly TeamSummary[];
  /** Rejecting keeps the dialog open; a server `fields.name` error lands under the name. */
  onSubmit: (values: TeamDialogValues) => Promise<void>;
}

/** Add / edit team: logo + name, same rules as the mobile Add Team and Edit Team screens. */
export function TeamDialog({
  open,
  onOpenChange,
  team,
  teams,
  onSubmit,
}: TeamDialogProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoStorageKey, setLogoStorageKey] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(team?.name ?? '');
    setLogoPreview(team?.logoUrl ?? null);
    setLogoStorageKey(undefined);
    setNameError(null);
    setLogoError(null);
    setFormError(null);
  }, [open, team]);

  const pickLogo = async (file: File) => {
    setUploading(true);
    setLogoError(null);
    try {
      const uploaded = await uploadTeamLogo(file);
      setLogoPreview(uploaded.logoUrl);
      setLogoStorageKey(uploaded.storageKey);
    } catch (err) {
      setLogoError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const duplicateName = (value: string): boolean => {
    const normalized = normalizeTeamName(value);
    return teams.some(
      (other) => other.id !== team?.id && normalizeTeamName(other.name) === normalized,
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const invalid =
      validateTeamName(name) ?? (duplicateName(name) ? TEAM_FORM_MESSAGES.name.duplicate : null);
    setNameError(invalid);
    if (invalid || uploading) return;
    setPending(true);
    setFormError(null);
    try {
      await onSubmit({ name: name.trim(), logoStorageKey });
      onOpenChange(false);
    } catch (err) {
      const fieldError = err instanceof ApiError ? err.fields.name : undefined;
      if (fieldError) setNameError(fieldError);
      else setFormError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const busy = pending || uploading;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{team ? 'Edit Team' : 'Add Team'}</DialogTitle>
            <DialogDescription>
              {team ? 'Update the team logo or name.' : 'Upload a logo and name your team.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              aria-label={logoPreview ? 'Change team logo' : 'Upload team logo'}
              className={cn(
                'relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary',
                logoError && 'border-destructive',
              )}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Team logo" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-6" />
              )}
              {uploading ? (
                <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="size-5 animate-spin" />
                </span>
              ) : null}
            </button>
            <div className="space-y-1">
              <p className="text-sm font-medium">Team logo (optional)</p>
              <p className="text-xs text-muted-foreground">
                {uploading ? 'Uploading logo…' : 'JPEG up to 5MB (other images are converted).'}
              </p>
              {logoError ? <p className="text-sm text-destructive">{logoError}</p> : null}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              data-testid="team-logo-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void pickLogo(file);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={name}
              maxLength={TEAM_NAME_MAX_LENGTH}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              aria-invalid={nameError !== null}
              autoFocus
            />
            {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
          </div>

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
            <Button type="submit" disabled={busy}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {team ? 'Save changes' : 'Add Team'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
