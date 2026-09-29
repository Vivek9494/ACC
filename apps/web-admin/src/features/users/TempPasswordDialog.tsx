import { formatAdminTempPasswordTimeRemaining, type CreateAdminUserResponse } from '@acc/types';
import { Check, Copy, KeyRound } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { userDisplayName } from './user-list';

/** Shows the one-time temporary password returned by POST /admin/users. */
export function TempPasswordDialog({
  result,
  onClose,
}: {
  result: CreateAdminUserResponse | null;
  onClose: () => void;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.temporaryPassword);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const remaining = result ? formatAdminTempPasswordTimeRemaining(result.expiresAt) : null;

  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <KeyRound className="size-5" />
          </span>
          <DialogTitle>{result ? `${userDisplayName(result.user)} was created` : 'User created'}</DialogTitle>
          <DialogDescription>
            Share this temporary password with the user. It is shown only once — they&apos;ll set their own
            password on first login.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <code className="flex-1 font-mono text-lg font-semibold tracking-wider select-all">
            {result?.temporaryPassword}
          </code>
          <Button variant="outline" size="sm" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        {remaining ? <p className="-mt-2 text-xs text-muted-foreground">Expires: {remaining}</p> : null}

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
