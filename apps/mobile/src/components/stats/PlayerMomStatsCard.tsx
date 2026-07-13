import {
  formatPlayerMomBattingLine,
  formatPlayerMomBowlingLine,
  formatPlayerProfileInteger,
  type OwnPlayerMomStatsSummary,
  type PlayerMomMatchSummary,
} from '@acc/types';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

import { Text } from '../ui/Text';
import { INPUT_SHADOW_STYLE } from '../ui/fieldStyles';

export interface PlayerMomStatsCardProps {
  summary: OwnPlayerMomStatsSummary;
  onPress: () => void;
}

function formatMatchContextLine(match: PlayerMomMatchSummary): string {
  const parts = [
    `${match.homeTeamName} vs ${match.awayTeamName}`,
    match.matchDate ?? null,
    match.resultNote,
  ].filter(Boolean);
  return parts.join(' · ');
}

function RecentFigures({ match }: { match: PlayerMomMatchSummary }): React.ReactElement {
  const lines = [
    match.figures.batting ? `Batting: ${formatPlayerMomBattingLine(match.figures.batting)}` : null,
    match.figures.bowling ? `Bowling: ${formatPlayerMomBowlingLine(match.figures.bowling)}` : null,
  ].filter(Boolean);

  return (
    <View className="mt-3 gap-1 border-t border-text-inverse/20 pt-3">
      <Text className="font-sans-semibold text-xs uppercase tracking-wider text-text-inverse/80">
        Most recent
      </Text>
      <Text className="font-sans text-xs text-text-inverse/80" numberOfLines={2}>
        {formatMatchContextLine(match)}
      </Text>
      {lines.map((line) => (
        <Text key={line} className="font-sans text-sm text-text-inverse">
          {line}
        </Text>
      ))}
    </View>
  );
}

/** Tappable MoM summary card on the logged-in player's Stats tab. */
export function PlayerMomStatsCard({ summary, onPress }: PlayerMomStatsCardProps): React.ReactElement {
  const hasAwards = summary.count > 0;

  const content = (
    <>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-sans-semibold text-xs uppercase tracking-wider text-text-inverse/80">
            Man of the Match
          </Text>
          <Text className="font-sans-bold text-3xl text-text-inverse">
            {formatPlayerProfileInteger(summary.count)}
          </Text>
          {hasAwards ? (
            <Text className="font-sans text-sm text-text-inverse/80">
              {summary.count === 1 ? 'award' : 'awards'}
            </Text>
          ) : (
            <Text className="font-sans text-sm text-text-inverse/80">
              No Man of the Match awards yet
            </Text>
          )}
        </View>
        <View className="items-center gap-1">
          <Ionicons name="star" size={28} color={colors.primary} />
          {hasAwards ? (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textInverse}
              style={{ opacity: 0.7 }}
            />
          ) : null}
        </View>
      </View>

      {hasAwards && summary.mostRecent ? <RecentFigures match={summary.mostRecent} /> : null}
    </>
  );

  const cardClassName =
    'overflow-hidden rounded-xl border border-outline-variant/30 bg-secondary p-4';

  if (!hasAwards) {
    return (
      <View className={cardClassName} style={INPUT_SHADOW_STYLE}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`${cardClassName} active:opacity-90`}
      style={INPUT_SHADOW_STYLE}
    >
      {content}
    </Pressable>
  );
}
