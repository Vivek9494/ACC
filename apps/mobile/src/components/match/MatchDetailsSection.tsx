import { colors } from '@/theme/colors';
import {
  formatMatchDetailReportingLabel,
  formatMatchDetailScheduleWithDelay,
  formatMatchGroundSetupLabel,
  resolveOversAllotment,
  type MatchDetail,
} from '@acc/types';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import {
  openableVenueFromMatch,
  promptOpenVenueInMaps,
  venueLocationIsOpenable,
} from '../../lib/open-tournament-venue';
import { resolveVenueDisplayTimezone } from '../../lib/venue-time';
import {
  TournamentDetailInfoRow,
  TournamentDetailSectionCard,
} from '../ui/TournamentDetailSectionCard';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';

function formatOversLabel(overs: number): string {
  return `${overs} overs`;
}

function VenueDetailRow({
  venue,
  location,
}: {
  venue: string;
  location: ReturnType<typeof openableVenueFromMatch>;
}): React.ReactElement {
  const openable = venueLocationIsOpenable(location);

  const content = (
    <View className="flex-row items-start gap-2">
      <MaterialIcons name="location-on" size={20} color={colors.textMuted} style={{ marginTop: 2 }} />
      <Text
        className={`flex-1 font-sans-semibold text-base ${
          openable ? 'text-primary underline' : 'text-on-surface'
        }`}
      >
        {venue}
      </Text>
    </View>
  );

  return (
    <View className="gap-1">
      <Text className="font-sans text-sm text-on-surface-variant">Venue</Text>
      {openable ? (
        <Pressable
          onPress={() => promptOpenVenueInMaps(location)}
          accessibilityRole="link"
          accessibilityLabel={`Open venue in maps: ${venue}`}
          className="active:opacity-80"
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}

export interface MatchDetailsSectionProps {
  match: MatchDetail;
}

export function MatchDetailsSection({ match }: MatchDetailsSectionProps): React.ReactElement {
  const { timezone } = resolveVenueDisplayTimezone(match.tournamentTimezone);
  const scheduleLabel = formatMatchDetailScheduleWithDelay(
    {
      matchDate: match.matchDate,
      startTime: match.startTime,
      delayMinutes: match.delayMinutes,
    },
    timezone,
    match.state,
  );
  const reportingLabel = match.reportingTime
    ? formatMatchDetailReportingLabel(match.reportingTime, timezone)
    : null;
  const overs = resolveOversAllotment(match.oversPerInnings, match.tournamentOversPerInnings);
  const venue = match.groundLocation?.trim() ?? null;
  const venueLocation = openableVenueFromMatch(match);

  return (
    <TournamentDetailSectionCard
      title="Match Details"
      icon={<Ionicons name="information-circle-outline" size={20} color={FIELD_ORANGE} />}
    >
      {reportingLabel ? (
        <View className="flex-row items-start gap-3">
          <View className="min-w-0 flex-1">
            <TournamentDetailInfoRow label="Date & Time" value={scheduleLabel} />
          </View>
          <View className="min-w-0 flex-1">
            <TournamentDetailInfoRow label="Reporting Time" value={reportingLabel} />
          </View>
        </View>
      ) : (
        <TournamentDetailInfoRow label="Date & Time" value={scheduleLabel} />
      )}
      {overs != null ? <TournamentDetailInfoRow label="Overs" value={formatOversLabel(overs)} /> : null}
      {match.homeAway ? (
        <TournamentDetailInfoRow
          label="Home / Away"
          value={formatMatchGroundSetupLabel(match.homeAway)}
        />
      ) : null}
      {venue ? <VenueDetailRow venue={venue} location={venueLocation} /> : null}
    </TournamentDetailSectionCard>
  );
}
