import {
  BALLS_PER_OVER,
  type InningsScorecard,
  type ScorecardResponse,
} from '@acc/types';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from './ui/Button';
import { Text } from './ui/Text';

export type NameResolver = (id: string | null | undefined) => string;

interface Props {
  state: ScorecardResponse;
  nameOf: NameResolver;
  teamNameOf: NameResolver;
}

function oversFromBalls(balls: number): number {
  return balls / BALLS_PER_OVER;
}

function fmt(n: number): string {
  return n.toFixed(2);
}

/** The innings currently being played is the last one in the list. */
function liveInnings(state: ScorecardResponse): InningsScorecard | null {
  return state.innings.at(-1) ?? null;
}

/**
 * Read-only live display following the CricHeroes pattern (spec §28): score
 * header with CRR/target/RRR, current batters (R/B/4s/6s/SR), current bowler
 * (O/R/W/econ), recent overs strip, fall of wickets, partnership, and an
 * expandable ball-by-ball timeline.
 */
export function LiveScorecard({ state, nameOf, teamNameOf }: Props): React.ReactElement {
  const [showTimeline, setShowTimeline] = useState(false);
  const inn = liveInnings(state);

  if (!inn) {
    return (
      <View className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <Text className="font-sans text-sm text-on-surface-variant">
          The innings has not started yet.
        </Text>
      </View>
    );
  }

  const crr = inn.legalBalls > 0 ? inn.runs / oversFromBalls(inn.legalBalls) : 0;
  const target = inn.target;
  const ballsLeft =
    inn.oversAllotted !== null ? inn.oversAllotted * BALLS_PER_OVER - inn.legalBalls : null;
  const runsNeeded = target !== null ? Math.max(0, target - inn.runs) : null;
  const rrr =
    runsNeeded !== null && ballsLeft !== null && ballsLeft > 0
      ? runsNeeded / oversFromBalls(ballsLeft)
      : null;

  const striker = inn.batters.find((b) => b.playerId === inn.currentStrikerId);
  const nonStriker = inn.batters.find((b) => b.playerId === inn.currentNonStrikerId);
  const bowler = inn.bowlers.find((b) => b.playerId === inn.currentBowlerId);
  const currentBatters = [
    { card: striker, onStrike: true },
    { card: nonStriker, onStrike: false },
  ].filter((x) => x.card);

  return (
    <View className="gap-4">
      {/* Score header */}
      <View className="gap-2 rounded-xl bg-primary-container p-4">
        <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
          {teamNameOf(inn.battingTeamId)} batting
        </Text>
        <View className="flex-row items-end justify-between">
          <Text className="font-sans-bold text-4xl text-on-surface">
            {inn.runs}/{inn.wickets}
          </Text>
          <Text className="font-sans-semibold text-base text-primary">{inn.oversText} Ovs</Text>
        </View>
        <View className="flex-row flex-wrap gap-x-4">
          <Text className="font-sans text-xs text-on-surface-variant">CRR {fmt(crr)}</Text>
          {target !== null ? (
            <Text className="font-sans text-xs text-on-surface-variant">Target {target}</Text>
          ) : null}
          {rrr !== null ? (
            <Text className="font-sans text-xs text-on-surface-variant">RRR {fmt(rrr)}</Text>
          ) : null}
          {runsNeeded !== null && ballsLeft !== null ? (
            <Text className="font-sans text-xs text-primary">
              Need {runsNeeded} off {ballsLeft}
            </Text>
          ) : null}
        </View>
        {inn.closeReason ? (
          <Text className="font-sans-semibold text-xs text-primary">
            Innings closed · {inn.closeReason.replace('_', ' ').toLowerCase()}
          </Text>
        ) : null}
        {state.result.decided ? (
          <Text className="font-sans-bold text-sm text-primary">
            {teamNameOf(state.result.winningTeamId)} won
            {state.result.note ? ` · ${state.result.note}` : ''}
          </Text>
        ) : null}
        {state.result.superOverRequired ? (
          <Text className="font-sans-bold text-sm text-primary">
            Scores level — Super Over required
          </Text>
        ) : null}
      </View>

      {/* Current batters */}
      <View className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <View className="flex-row pb-2">
          <Text className="flex-1 font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
            Batter
          </Text>
          {['R', 'B', '4s', '6s', 'SR'].map((h) => (
            <Text
              key={h}
              className="w-10 text-right font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant"
            >
              {h}
            </Text>
          ))}
        </View>
        {currentBatters.length === 0 ? (
          <Text className="font-sans text-sm text-on-surface-variant">Yet to bat.</Text>
        ) : (
          currentBatters.map(({ card, onStrike }) =>
            card ? (
              <View key={card.playerId} className="flex-row items-center py-1">
                <Text className="flex-1 font-sans-semibold text-sm text-on-surface">
                  {nameOf(card.playerId)}
                  {onStrike ? ' *' : ''}
                </Text>
                <Text className="w-10 text-right font-sans text-sm text-on-surface">{card.runs}</Text>
                <Text className="w-10 text-right font-sans text-sm text-on-surface-variant">
                  {card.balls}
                </Text>
                <Text className="w-10 text-right font-sans text-sm text-on-surface-variant">
                  {card.fours}
                </Text>
                <Text className="w-10 text-right font-sans text-sm text-on-surface-variant">
                  {card.sixes}
                </Text>
                <Text className="w-10 text-right font-sans text-sm text-on-surface-variant">
                  {fmt(card.strikeRate)}
                </Text>
              </View>
            ) : null,
          )
        )}
      </View>

      {/* Current bowler */}
      {bowler ? (
        <View className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-sans-semibold text-sm text-on-surface">
              {nameOf(bowler.playerId)}
            </Text>
            <Text className="font-sans-medium text-xs text-on-surface-variant">
              {bowler.oversText}-{bowler.maidens}-{bowler.runsConceded}-{bowler.wickets} · Econ{' '}
              {fmt(bowler.economy)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Partnership */}
      {inn.partnership ? (
        <View className="flex-row items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3">
          <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
            Partnership
          </Text>
          <Text className="font-sans-semibold text-sm text-on-surface">
            {inn.partnership.runs} ({inn.partnership.balls})
          </Text>
        </View>
      ) : null}

      {/* Recent overs strip */}
      {inn.recentOvers.length > 0 ? (
        <View className="gap-2">
          <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
            Recent Overs
          </Text>
          <View className="gap-2">
            {inn.recentOvers.map((over) => (
              <View key={over.overNumber} className="flex-row items-center gap-2">
                <Text className="w-10 font-sans-medium text-xs text-on-surface-variant">
                  Ov {over.overNumber}
                </Text>
                <View className="flex-1 flex-row flex-wrap gap-1">
                  {over.balls.map((code, i) => (
                    <View
                      key={`${over.overNumber}-${i}`}
                      className={`h-7 min-w-7 items-center justify-center rounded-full px-2 ${
                        code === 'W'
                          ? 'bg-[#c1121f]'
                          : code === '4' || code === '6'
                            ? 'bg-primary'
                            : 'bg-surface-container-lowest border border-outline-variant'
                      }`}
                    >
                      <Text
                        className={`font-sans-medium text-[11px] ${
                          code === 'W' || code === '4' || code === '6'
                            ? 'text-on-primary'
                            : 'text-on-surface'
                        }`}
                      >
                        {code}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text className="w-8 text-right font-sans-semibold text-xs text-on-surface">
                  {over.runs}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Fall of wickets */}
      {inn.fallOfWickets.length > 0 ? (
        <View className="gap-1">
          <Text className="font-sans-medium text-[10px] uppercase tracking-wider text-on-surface-variant">
            Fall of Wickets
          </Text>
          <Text className="font-sans text-xs text-on-surface-variant">
            {inn.fallOfWickets
              .map((f) => `${f.teamRuns}-${f.wicketNumber} (${nameOf(f.playerId)}, ${f.oversText})`)
              .join('   ')}
          </Text>
        </View>
      ) : null}

      {/* Expandable ball-by-ball timeline */}
      <Button
        onPress={() => setShowTimeline((s) => !s)}
        variant="outline"
        className="h-11 flex-row justify-between px-4"
      >
        <Text className="font-sans-semibold text-sm text-primary">Ball-by-ball</Text>
        <Text className="font-sans text-xs text-on-surface-variant">{showTimeline ? '▲' : '▼'}</Text>
      </Button>
      {showTimeline ? (
        <View className="gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          {[...inn.timeline].reverse().map((t) => (
            <View key={t.sequence} className="flex-row items-center gap-3 py-1">
              <Text className="w-12 font-sans-medium text-[11px] text-on-surface-variant">
                {t.label || '—'}
              </Text>
              <Text className="w-12 font-sans-medium text-xs text-on-surface">{t.code}</Text>
              <Text className="flex-1 font-sans text-xs text-on-surface-variant">
                {t.description}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
