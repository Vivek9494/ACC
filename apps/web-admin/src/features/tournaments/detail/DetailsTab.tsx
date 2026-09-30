import { ImageOff } from 'lucide-react';
import { useParams } from 'react-router';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { buildTournamentDetailSections, type DetailSection } from './tournament-details';
import { useTournamentDetail } from './tournament-detail-api';

function SectionCard({ section }: { section: DetailSection }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-4 @lg:grid-cols-2">
          {section.rows.map((row) => (
            <div key={row.label} className="space-y-1">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-medium">
                {Array.isArray(row.value) ? (
                  <ul className="space-y-0.5">
                    {row.value.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** /tournaments/:id/details — read-only view of what the organizer entered on Add / Edit Tournament. */
export function DetailsTab(): React.ReactElement {
  const { tournamentId = '' } = useParams();
  const tournament = useTournamentDetail(tournamentId).data;

  if (!tournament) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="grid gap-6 @3xl:grid-cols-[240px_1fr]">
      <Card className="h-fit overflow-hidden py-0">
        {tournament.posterUrl ? (
          <img
            src={tournament.posterUrl}
            alt={`${tournament.name} poster`}
            className="aspect-[3/4] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
            <ImageOff className="size-6" />
            No poster
          </div>
        )}
      </Card>
      <div className="space-y-6">
        {buildTournamentDetailSections(tournament).map((section) => (
          <SectionCard key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}
