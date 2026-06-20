import { Ionicons } from '@expo/vector-icons';
import type { MatchDetail, ScorecardResponse } from '@acc/types';
import { View } from 'react-native';
import { colors } from '@/theme/colors';

import {
  buildManOfMatchStatBlocks,
  resolveManOfMatchPlayer,
  shouldShowManOfMatchCard,
  type ManOfMatchStatBlock,
} from '../lib/match-completion';
import { PlayerAvatar } from './tournament/PlayerAvatar';
import { Text } from './ui/Text';
import { INPUT_SHADOW_STYLE } from './ui/fieldStyles';

export interface ManOfMatchCardProps {
  match: MatchDetail;
  card: ScorecardResponse;
  momUserId: string;
  nameOf: (id: string) => string;
}

function StatBlock({ block }: { block: ManOfMatchStatBlock }): React.ReactElement {
  return (
    <View className="min-w-[88px] rounded-md bg-surface/20 px-3 py-2">
      <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-text-inverse/80">
        {block.label}
      </Text>
      <Text className="font-sans-bold text-sm text-text-inverse">{block.value}</Text>
    </View>
  );
}

/** Gold finalized MoM card on the completed-match scorecard (§13.3) — all viewers. */
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
  const statBlocks = buildManOfMatchStatBlocks(card, momUserId);

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

      <Text className="font-sans-semibold text-[10px] uppercase tracking-widest text-text-inverse/80">
        Man of the Match
      </Text>

      <View className="mt-3 flex-row items-center gap-3">
        <PlayerAvatar
          firstName={player.firstName}
          profilePhotoUrl={player.profilePhotoUrl}
          size="md"
          highlighted
        />
        <View className="min-w-0 flex-1 gap-2">
          <View className="self-start rounded-md bg-primary px-2.5 py-1">
            <Text className="font-sans-bold text-lg text-text-inverse" numberOfLines={2}>
              {player.displayName}
            </Text>
          </View>
          {statBlocks.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {statBlocks.map((block) => (
                <StatBlock key={block.label} block={block} />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
