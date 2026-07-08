import {
  KnockoutBracketSlotKind,
  type KnockoutBracketMatchSlot,
  type KnockoutBracketMatchSummary,
  type KnockoutBracketView,
} from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiRequestError, getKnockoutBracket } from '../../lib/api';
import { Text } from '../ui/Text';
import { TeamAvatar } from '../ui/TeamAvatar';
import { ScreenHeader } from '../ui/ScreenHeader';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { MatchCardDisplayBadge } from './MatchCardDisplayBadge';
import {
  KnockoutAwaitingConfirmationPill,
  KnockoutFeederAwaitingConfirmationHint,
} from './KnockoutBracketConfirmationHints';

export interface KnockoutChartScreenProps {
  tournamentId: string;
  tournamentName: string;
}

const BOX_WIDTH = 176;
const BOX_HEIGHT = 92;
const MATCH_LABEL_H = 22;
const MATCH_LABEL_GAP = 4;
const COL_GAP = 48;
const COLUMN_WIDTH = BOX_WIDTH + COL_GAP;
const V_GAP = 28;
const BAND_HEIGHT = MATCH_LABEL_H + MATCH_LABEL_GAP + BOX_HEIGHT + V_GAP;
const CANVAS_PAD = 16;
const CONNECTOR_COLOR = '#C0B9AB';

interface PlacedMatch {
  match: KnockoutBracketMatchSummary;
  roundIndex: number;
  position: number;
  roundLabel: string;
  x: number;
  y: number;
  centerY: number;
}

interface Connector {
  key: string;
  childRightX: number;
  childCenterY: number;
  parentLeftX: number;
  parentCenterY: number;
}

interface ChartLayout {
  boxes: PlacedMatch[];
  connectors: Connector[];
  width: number;
  height: number;
}

function formatMatchRoundLabel(
  roundLabel: string,
  roundMatchCount: number,
  withinRoundNumber: number,
): string {
  if (roundMatchCount === 1) {
    return roundLabel;
  }
  return `${roundLabel} #${withinRoundNumber}`;
}

function buildChartLayout(bracket: KnockoutBracketView): ChartLayout {
  const matches = bracket.matches.filter((m) => m.bracketRoundIndex != null);
  if (matches.length === 0) {
    return { boxes: [], connectors: [], width: 0, height: 0 };
  }

  const maxRoundIndex = Math.max(...matches.map((m) => m.bracketRoundIndex ?? 0));
  const bandRegion = BAND_HEIGHT * 2 ** maxRoundIndex;
  const topReserve = CANVAS_PAD + MATCH_LABEL_H + MATCH_LABEL_GAP;

  const matchesPerRound = new Map<number, number>();
  for (const match of matches) {
    const roundIndex = match.bracketRoundIndex ?? 0;
    matchesPerRound.set(roundIndex, (matchesPerRound.get(roundIndex) ?? 0) + 1);
  }

  const columnX = (roundIndex: number): number =>
    CANVAS_PAD + (maxRoundIndex - roundIndex) * COLUMN_WIDTH;
  const centerYFor = (roundIndex: number, position: number): number =>
    topReserve + (position + 0.5) * (bandRegion / 2 ** roundIndex);

  const boxes: PlacedMatch[] = matches.map((match) => {
    const roundIndex = match.bracketRoundIndex ?? 0;
    const position = match.bracketPosition ?? 0;
    const roundLabel = match.bracketRoundLabel ?? `Round ${roundIndex + 1}`;
    const roundMatchCount = matchesPerRound.get(roundIndex) ?? 1;
    const withinRoundNumber = position + 1;
    const centerY = centerYFor(roundIndex, position);
    return {
      match,
      roundIndex,
      position,
      roundLabel: formatMatchRoundLabel(roundLabel, roundMatchCount, withinRoundNumber),
      x: columnX(roundIndex),
      y: centerY - BOX_HEIGHT / 2,
      centerY,
    };
  });

  const boxByKey = new Map<string, PlacedMatch>();
  for (const box of boxes) {
    boxByKey.set(`${box.roundIndex}:${box.position}`, box);
  }

  const connectors: Connector[] = [];
  for (const box of boxes) {
    if (box.roundIndex < 1) {
      continue;
    }
    const parentKey = `${box.roundIndex - 1}:${Math.floor(box.position / 2)}`;
    const parent = boxByKey.get(parentKey);
    if (!parent) {
      continue;
    }
    connectors.push({
      key: `conn-${box.roundIndex}:${box.position}`,
      childRightX: box.x + BOX_WIDTH,
      childCenterY: box.centerY,
      parentLeftX: parent.x,
      parentCenterY: parent.centerY,
    });
  }

  return {
    boxes,
    connectors,
    width: CANVAS_PAD * 2 + (maxRoundIndex + 1) * COLUMN_WIDTH,
    height: topReserve + CANVAS_PAD + bandRegion,
  };
}

function ConnectorLines({ connector }: { connector: Connector }): React.ReactElement {
  const midX = connector.childRightX + COL_GAP / 2;
  const top = Math.min(connector.childCenterY, connector.parentCenterY);
  const height = Math.abs(connector.parentCenterY - connector.childCenterY);

  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: connector.childRightX,
          top: connector.childCenterY,
          width: midX - connector.childRightX,
          height: 2,
          backgroundColor: CONNECTOR_COLOR,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: midX,
          top,
          width: 2,
          height: Math.max(height, 2),
          backgroundColor: CONNECTOR_COLOR,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: midX,
          top: connector.parentCenterY,
          width: connector.parentLeftX - midX,
          height: 2,
          backgroundColor: CONNECTOR_COLOR,
        }}
      />
    </>
  );
}

function ChartSlot({
  slot,
  isWinner,
}: {
  slot: KnockoutBracketMatchSlot;
  isWinner: boolean;
}): React.ReactElement {
  if (
    slot.kind === KnockoutBracketSlotKind.WinnerOf ||
    slot.kind === KnockoutBracketSlotKind.Tbd
  ) {
    return (
      <View className="min-h-[28px] gap-0.5">
        <View className="flex-row items-center">
          <Text
            className="flex-1 font-sans text-xs italic text-on-surface-variant"
            numberOfLines={1}
          >
            {slot.kind === KnockoutBracketSlotKind.WinnerOf
              ? slot.feederLabel ?? 'Winner TBD'
              : 'TBD'}
          </Text>
        </View>
        {slot.kind === KnockoutBracketSlotKind.WinnerOf && slot.feederAwaitingConfirmation ? (
          <KnockoutFeederAwaitingConfirmationHint />
        ) : null}
      </View>
    );
  }

  return (
    <View className="min-h-[28px] flex-row items-center gap-1.5">
      <TeamAvatar name={slot.teamName ?? 'Team'} logoUrl={slot.logoUrl} size="sm" />
      <Text
        className={`min-w-0 flex-1 text-xs ${
          isWinner ? 'font-sans-bold text-on-surface' : 'font-sans-medium text-on-surface'
        }`}
        numberOfLines={1}
      >
        {slot.teamName ?? 'Team'}
      </Text>
      {slot.kind === KnockoutBracketSlotKind.Bye ? (
        <View className="rounded-full bg-surface-container-high px-1.5 py-0.5">
          <Text className="font-sans-semibold text-[9px] text-on-surface-variant">BYE</Text>
        </View>
      ) : isWinner ? (
        <Text className="font-sans-bold text-[10px] text-secondary">W</Text>
      ) : null}
    </View>
  );
}

function ChartMatchBox({
  placed,
  onPress,
}: {
  placed: PlacedMatch;
  onPress: (matchId: string) => void;
}): React.ReactElement {
  const { match } = placed;
  const tappable = !match.awaitingTeams;
  const homeWinner = match.winningTeamId != null && match.homeSlot.teamId === match.winningTeamId;
  const awayWinner = match.winningTeamId != null && match.awaySlot.teamId === match.winningTeamId;

  const content = (
    <View
      className="gap-1.5 rounded-control border border-outline-variant bg-surface p-2.5"
      style={{ width: BOX_WIDTH, minHeight: BOX_HEIGHT }}
    >
      <View className="flex-row items-center justify-between gap-1">
        <Text className="font-sans-semibold text-[10px] text-on-surface-variant" numberOfLines={1}>
          M{(match.bracketPosition ?? 0) + 1}
        </Text>
        <View className="flex-row items-center gap-1">
          {match.awaitingScorecardConfirmation ? <KnockoutAwaitingConfirmationPill /> : null}
          <MatchCardDisplayBadge state={match.state} />
        </View>
      </View>
      <ChartSlot slot={match.homeSlot} isWinner={homeWinner} />
      <View className="h-px bg-outline-variant" />
      <ChartSlot slot={match.awaySlot} isWinner={awayWinner} />
    </View>
  );

  return (
    <View
      style={{
        position: 'absolute',
        left: placed.x,
        top: placed.y - MATCH_LABEL_H - MATCH_LABEL_GAP,
        width: BOX_WIDTH,
      }}
    >
      <Text
        className="font-sans-semibold text-xs text-secondary"
        style={{ height: MATCH_LABEL_H, marginBottom: MATCH_LABEL_GAP }}
        numberOfLines={1}
      >
        {placed.roundLabel}
      </Text>
      {tappable ? (
        <Pressable accessibilityRole="button" onPress={() => onPress(match.id)}>
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}

export function KnockoutChartScreen({
  tournamentId,
  tournamentName,
}: KnockoutChartScreenProps): React.ReactElement {
  const router = useRouter();
  const [bracket, setBracket] = useState<KnockoutBracketView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBracket(await getKnockoutBracket(tournamentId));
    } catch (err) {
      setBracket(null);
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not load the knockout chart.',
      );
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const layout = useMemo(() => (bracket ? buildChartLayout(bracket) : null), [bracket]);

  function handleMatchPress(matchId: string): void {
    router.push(`/matches/${matchId}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScreenHeader title="Knockout Chart" subtitle={tournamentName} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-on-surface-variant">{error}</Text>
        </View>
      ) : layout && layout.boxes.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{ minWidth: layout.width }}
        >
          <ScrollView
            showsVerticalScrollIndicator
            contentContainerStyle={{ height: layout.height, width: layout.width }}
          >
            <View style={{ width: layout.width, height: layout.height }}>
              {layout.connectors.map((connector) => (
                <ConnectorLines key={connector.key} connector={connector} />
              ))}
              {layout.boxes.map((placed) => (
                <ChartMatchBox
                  key={placed.match.id}
                  placed={placed}
                  onPress={handleMatchPress}
                />
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-on-surface-variant">
            No knockout bracket has been generated yet.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
