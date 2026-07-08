import {
  buildPlayerMomMatchFigures,
  formatPlayerMomBattingLine,
  formatPlayerMomBowlingLine,
  type MatchDetail,
  type ScorecardResponse,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '@/theme/colors';

import { resolveManOfMatchPlayer, shouldShowManOfMatchCard } from '../lib/match-completion';
import { PlayerAvatar } from './tournament/PlayerAvatar';
import { Text } from './ui/Text';
import { INPUT_SHADOW_STYLE } from './ui/fieldStyles';

export interface ManOfMatchCardProps {
  match: MatchDetail;
  card: ScorecardResponse;
  momUserId: string;
  nameOf: (id: string) => string;
}

function FigureRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View className="gap-0.5">
      <Text className="font-sans-semibold text-xs uppercase tracking-wider text-text-inverse/80">
        {label}
      </Text>
      <Text className="font-sans text-sm text-text-inverse">{value}</Text>
    </View>
  );
}

/** MoM card on the winning team's scorecard tab (§13.3) — read-only, conditional figures. */
export function ManOfMatchCard({
  match,
  card,
  momUserId,
  nameOf,
}: ManOfMatchCardProps): React.ReactElement | null {
  if (!shouldShowManOfMatchCard(match, momUserId)) {
    return null;
  }

  const player = resolveManOfMatchPlayer(match, momUserId, nameOf);
  const figures = buildPlayerMomMatchFigures(card, momUserId);

  return (
    <View
      className="relative overflow-hidden rounded-control bg-secondary p-4"
      style={INPUT_SHADOW_STYLE}
    >
      <View
        className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2"
        accessibilityElementsHidden
      >
        <Ionicons name="star" size={112} color={colors.textMuted} style={{ opacity: 0.12 }} />
      </View>

      <View className="flex-row items-center gap-2">
        <Text className="font-sans-semibold text-xs uppercase tracking-widest text-text-inverse/80">
          Man of the Match
        </Text>
        <View className="rounded-md bg-primary px-2 py-0.5">
          <Text className="font-sans-bold text-[10px] uppercase tracking-wider text-text-inverse">
            MoM
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-start gap-3">
        <PlayerAvatar
          firstName={player.firstName}
          profilePhotoUrl={player.profilePhotoUrl}
          size="md"
          highlighted
        />
        <View className="min-w-0 flex-1 gap-3">
          <Text className="font-sans-bold text-lg text-text-inverse" numberOfLines={2}>
            {player.displayName}
          </Text>
          {figures.batting ? (
            <FigureRow label="Batting" value={formatPlayerMomBattingLine(figures.batting)} />
          ) : null}
          {figures.bowling ? (
            <FigureRow label="Bowling" value={formatPlayerMomBowlingLine(figures.bowling)} />
          ) : null}
        </View>
      </View>
    </View>
  );
}
