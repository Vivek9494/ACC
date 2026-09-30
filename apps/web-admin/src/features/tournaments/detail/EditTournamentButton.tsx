import type { TournamentDetail } from '@acc/types';
import { Pencil } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';

/** Details-tab header "Edit" for viewers the API allows to edit this tournament. */
export function EditTournamentButton({
  tournament,
}: {
  tournament: TournamentDetail;
}): React.ReactElement | null {
  if (!tournament.canEdit) return null;
  return (
    <Button asChild>
      <Link to={`/tournaments/${encodeURIComponent(tournament.id)}/edit`}>
        <Pencil />
        Edit
      </Link>
    </Button>
  );
}
