import { type CenterPlayerRosterEntry, formatCanadianMobileForDisplay } from '@acc/types';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/api-client';

import { useLateRegisterCandidates } from './tournament-detail-api';

const fullName = (p: { firstName: string; lastName: string }): string =>
  `${p.firstName} ${p.lastName}`;

/** Step 1 of "Register User": active Players from participating centers who haven't registered. */
export function RegisterUserPickerDialog({
  tournamentId,
  open,
  onOpenChange,
  onPick,
}: {
  tournamentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (player: CenterPlayerRosterEntry) => void;
}): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        {open ? <PickerBody tournamentId={tournamentId} onPick={onPick} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  tournamentId,
  onPick,
}: {
  tournamentId: string;
  onPick: (player: CenterPlayerRosterEntry) => void;
}): React.ReactElement {
  const candidates = useLateRegisterCandidates(tournamentId, true);
  const [search, setSearch] = useState('');

  const rows = useMemo((): CenterPlayerRosterEntry[] => {
    const players = candidates.data?.players ?? [];
    const query = search.trim().toLowerCase();
    const digits = query.replace(/\D/g, '');
    return players
      .filter(
        (p) =>
          !query ||
          fullName(p).toLowerCase().includes(query) ||
          (digits !== '' && p.mobileNumber.replace(/\D/g, '').includes(digits)),
      )
      .sort(
        (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
      );
  }, [candidates.data, search]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Register User</DialogTitle>
        <DialogDescription>
          Active players from this tournament&apos;s centers who haven&apos;t registered yet. They
          are confirmed as soon as you submit their registration.
        </DialogDescription>
      </DialogHeader>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or mobile"
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
        {candidates.isPending ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : candidates.isError ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            {errorMessage(candidates.error)}
            <Button variant="outline" size="sm" onClick={() => void candidates.refetch()}>
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {search
              ? 'No users match your search.'
              : 'Every eligible player is already registered.'}
          </p>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Center</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((player) => {
                const name = fullName(player);
                return (
                  <TableRow key={player.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar person={player} className="size-8" />
                        <span className="truncate font-medium">{name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatCanadianMobileForDisplay(player.mobileNumber)}
                    </TableCell>
                    <TableCell>{player.centerName || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => onPick(player)} aria-label={`Add ${name}`}>
                        <UserPlus />
                        Add
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
