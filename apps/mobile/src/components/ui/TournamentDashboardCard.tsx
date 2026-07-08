import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, View } from 'react-native';
import type { TournamentSummary } from '@acc/types';
import { colors } from '@/theme/colors';

import {
  formatTournamentDateRange,
  tournamentCardScopeLine,
  tournamentStatusPill,
} from '../../lib/tournament-display';
import { resolveMediaDisplayUrl } from '../../lib/media-url';
import { BallTypeIcon } from './BallTypeIcon';
import { INPUT_SHADOW_STYLE, STAT_LABEL_TEXT_CLASS } from './fieldStyles';
import { OverflowMenu, type OverflowMenuAction } from './OverflowMenu';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

export interface TournamentDashboardCardProps {
  tournament: TournamentSummary;
  onPress?: () => void;
  /** When true, shows a Cancelled badge instead of lifecycle state. */
  cancelled?: boolean;
  /** Permission-driven overflow actions; when set, replaces the default ellipsis handler. */
  menuActions?: OverflowMenuAction[];
  onOverflowPress?: () => void;
}

/**
 * Tournament list card with full-bleed banner. Shadow lives on the outer shell (no
 * overflow:hidden); an inner clip rounds the banner and bottom corners at 8px.
 */
export function TournamentDashboardCard({
  tournament,
  onPress,
  cancelled = false,
  menuActions,
  onOverflowPress,
}: TournamentDashboardCardProps): React.ReactElement {
  const pill = tournamentStatusPill(tournament, { cancelled });
  const displayPosterUrl = resolveMediaDisplayUrl(tournament.posterUrl);

  const shell = (
    <View className="rounded-control bg-surface" style={INPUT_SHADOW_STYLE}>
      <View className="overflow-hidden rounded-control">
        <View className="relative h-36 w-full bg-surface-container-high">
          {displayPosterUrl ? (
            <Image
              source={{ uri: displayPosterUrl }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-surface-container-high">
              <Text className="font-sans-bold text-4xl text-on-surface-variant">
                {tournament.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View className="absolute right-3 top-3">
            <StatusPill variant={pill.variant} label={pill.label} />
          </View>
        </View>

        <View className="gap-3 p-4">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 font-sans-bold text-lg text-on-surface" numberOfLines={2}>
              {tournament.name}
            </Text>
            {menuActions && menuActions.length > 0 ? (
              <OverflowMenu actions={menuActions} />
            ) : onOverflowPress ? (
              <Pressable
                onPress={onOverflowPress}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="More options"
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <View className="gap-[10px]">
            <View className="flex-row items-center gap-2">
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text className={`flex-1 ${STAT_LABEL_TEXT_CLASS}`} numberOfLines={1}>
                {tournamentCardScopeLine(tournament)}
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                <Text className={STAT_LABEL_TEXT_CLASS}>
                  {formatTournamentDateRange(tournament.startAt, tournament.endAt)}
                </Text>
              </View>
              <BallTypeIcon ballType={tournament.ballType} size={24} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className="active:opacity-90"
      >
        {shell}
      </Pressable>
    );
  }

  return shell;
}
