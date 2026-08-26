import {
  formatBatterHeaderFigures,
  formatBowlerOmRw,
  formatMatchTossSummaryLine,
  MATCH_STATE_LABELS,
  type BatterCard,
  type BowlerCard,
  type InningsScorecard,
  type MatchDetail,
} from '@acc/types';
import { Pressable, View } from 'react-native';

import { Text } from '../../ui/Text';
import { CockpitPanel } from './CockpitPanel';
import {
  currentRunRate,
  lastFiveOversLine,
  lastWicketLine,
  oversRemainingText,
  thisOverBallsText,
} from './cockpit-stats';

export interface ScoreSummaryPanelProps {
  match: MatchDetail;
  innings: InningsScorecard;
  battingTeamName: string;
  bowlingTeamName: string;
  nameOf: (id: string | null) => string;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  strikerCard: BatterCard | undefined;
  nonStrikerCard: BatterCard | undefined;
  bowlerCard: BowlerCard | undefined;
  onPickStriker: () => void;
  onPickNonStriker: () => void;
  onPickBowler: () => void;
}

function StatRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between py-px">
      <Text className="font-sans text-[11px] text-on-surface-variant">{label}</Text>
      <Text className="font-sans-semibold text-[11px] text-on-surface">{value}</Text>
    </View>
  );
}

function PlayRow({
  label,
  name,
  figures,
  onPress,
}: {
  label: string;
  name: string;
  figures: string;
  onPress?: () => void;
}): React.ReactElement {
  const body = (
    <View className="min-h-[26px] flex-1 flex-row items-center justify-between rounded border border-outline-variant bg-surface-container-lowest px-2">
      <Text className="font-sans-medium text-[12px] text-on-surface" numberOfLines={1}>
        {name}
      </Text>
      <Text className="ml-2 font-sans text-[10px] text-on-surface-variant">{figures}</Text>
    </View>
  );
  return (
    <View className="flex-row items-center gap-2">
      <Text className="w-[72px] font-sans text-[10px] uppercase tracking-wide text-on-surface-variant">
        {label}
      </Text>
      {onPress ? (
        <Pressable
          onPress={onPress}
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel={`Select ${label}`}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}

export function ScoreSummaryPanel({
  match,
  innings,
  battingTeamName,
  bowlingTeamName,
  nameOf,
  strikerId,
  nonStrikerId,
  bowlerId,
  strikerCard,
  nonStrikerCard,
  bowlerCard,
  onPickStriker,
  onPickNonStriker,
  onPickBowler,
}: ScoreSummaryPanelProps): React.ReactElement {
  const toss = formatMatchTossSummaryLine(match);
  const playState = MATCH_STATE_LABELS[match.state] ?? match.state;
  const strikerName = strikerId ? nameOf(strikerId) : 'Select striker';
  const nonStrikerName = nonStrikerId ? nameOf(nonStrikerId) : 'Select non-striker';
  const bowlerName = bowlerId ? nameOf(bowlerId) : 'Select bowler';

  return (
    <CockpitPanel title="Score Summary & Play Control" live>
      <View className="flex-row gap-5">
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-baseline gap-2">
            <Text className="font-sans-bold text-lg text-on-surface">{battingTeamName}</Text>
            <Text className="font-sans-bold text-lg text-primary">
              {innings.runs}/{innings.wickets}
            </Text>
            <Text className="font-sans text-xs text-on-surface-variant">({innings.oversText})</Text>
          </View>
          <Text className="mt-0.5 font-sans text-[11px] text-on-surface-variant">
            {innings.sequence > 1 && innings.target != null
              ? `Target ${innings.target}`
              : `${bowlingTeamName} to bat`}
          </Text>
          {toss ? (
            <Text className="mt-1 font-sans text-[11px] text-on-surface-variant">Toss: {toss}</Text>
          ) : null}
        </View>
        <View className="w-[168px] shrink-0">
          <StatRow label="Run Rate" value={currentRunRate(innings)} />
          <StatRow label="Last 5 Overs" value={lastFiveOversLine(innings)} />
          <StatRow
            label="Last Wicket"
            value={lastWicketLine(innings.fallOfWickets.at(-1), nameOf)}
          />
          <StatRow label="Overs Rem." value={oversRemainingText(innings)} />
          <StatRow label="Session" value="—" />
        </View>
      </View>

      <View className="mt-2.5 gap-1.5 border-t border-outline-variant pt-2">
        <PlayRow
          label="Striker"
          name={`${strikerName}${strikerId ? ' *' : ''}`}
          figures={
            strikerCard ? formatBatterHeaderFigures(strikerCard, true).replace('*', '') : '—'
          }
          onPress={onPickStriker}
        />
        <PlayRow
          label="Non-striker"
          name={nonStrikerName}
          figures={
            nonStrikerCard ? formatBatterHeaderFigures(nonStrikerCard, false) : '—'
          }
          onPress={onPickNonStriker}
        />
        <PlayRow
          label="Bowler"
          name={bowlerName}
          figures={bowlerCard ? formatBowlerOmRw(bowlerCard) : '—'}
          onPress={onPickBowler}
        />
        <PlayRow
          label="This over"
          name={thisOverBallsText(innings)}
          figures={playState}
        />
      </View>
    </CockpitPanel>
  );
}
