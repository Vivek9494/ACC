import { type CenterPlayerRosterEntry, type TournamentDetail, UserRole } from '@acc/types';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';

import { LateRegisterFormDialog } from './LateRegisterFormDialog';
import { RegisterUserPickerDialog } from './RegisterUserPickerDialog';
import { resolveVerificationState } from './registrations';
import { useRegisteredPlayers, useVerificationQueue } from './tournament-detail-api';

const LISTABLE_STATES = new Set(['open', 'closed', 'complete']);

/** Registrations-tab header "Register User": pick a player, then register + confirm them (§7.6). */
export function RegisterUserButton({
  tournament,
}: {
  tournament: TournamentDetail;
}): React.ReactElement | null {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.Admin;
  const listable = LISTABLE_STATES.has(resolveVerificationState(tournament, 1).kind);
  // Same queries (and cache) as the Registrations list — the server decides `canLateRegister`.
  const queue = useVerificationQueue(tournament.id, listable && isAdmin);
  const registered = useRegisteredPlayers(tournament.id, listable && !isAdmin);
  const [picking, setPicking] = useState(false);
  const [registering, setRegistering] = useState<CenterPlayerRosterEntry | null>(null);

  const canLateRegister =
    listable && (isAdmin ? queue.data?.canLateRegister : registered.data?.canLateRegister) === true;
  if (!canLateRegister) return null;

  return (
    <>
      <Button onClick={() => setPicking(true)}>
        <UserPlus />
        Register User
      </Button>
      <RegisterUserPickerDialog
        tournamentId={tournament.id}
        open={picking}
        onOpenChange={setPicking}
        onPick={(player) => {
          setPicking(false);
          setRegistering(player);
        }}
      />
      <LateRegisterFormDialog
        tournamentId={tournament.id}
        player={registering}
        onBack={() => {
          setRegistering(null);
          setPicking(true);
        }}
        onRegistered={() => setRegistering(null)}
      />
    </>
  );
}
