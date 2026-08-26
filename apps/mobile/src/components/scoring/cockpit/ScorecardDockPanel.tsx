import {
  formatBatterStatus,
  formatBatterStrikeRateDisplay,
  formatDismissalShort,
  extrasBreakdownParts,
  groupTimelineByOver,
  partnershipRunRate,
  type CompletedPartnership,
  type InningsScorecard,
  type ScorecardResponse,
  type SquadPlayerView,
} from '@acc/types';
import { Pressable, ScrollView, View } from 'react-native';
import { useMemo, useState } from 'react';

import { Text } from '../../ui/Text';
import { CockpitPanel, CockpitStubSlot } from './CockpitPanel';

type ScorecardDockTab =
  | 'scorecard'
  | 'scorebook'
  | 'partnerships'
  | 'overs'
  | 'spells'
  | 'wizard';

const TABS: { id: ScorecardDockTab; label: string; stub?: boolean }[] = [
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'scorebook', label: 'Scorebook', stub: true },
  { id: 'partnerships', label: 'Partnerships' },
  { id: 'overs', label: 'Over by Over' },
  { id: 'spells', label: 'Spells', stub: true },
  { id: 'wizard', label: 'Stats Wizard', stub: true },
];

function partnershipRows(innings: InningsScorecard): CompletedPartnership[] {
  const rows: CompletedPartnership[] = [...innings.partnerships];
  if (innings.partnership) {
    rows.push({
      batterIds: innings.partnership.batterIds,
      batterRuns: innings.partnership.batterRuns,
      runs: innings.partnership.runs,
      balls: innings.partnership.balls,
    });
  }
  if (innings.closed && rows.length > 0) {
    return rows.slice(0, -1);
  }
  return rows;
}

export function ScorecardDockPanel({
  card,
  innings,
  battingXi,
  nameOf,
}: {
  card: ScorecardResponse;
  innings: InningsScorecard;
  battingXi: SquadPlayerView[];
  nameOf: (id: string | null) => string;
}): React.ReactElement {
  const [tab, setTab] = useState<ScorecardDockTab>('scorecard');
  const yetToBat = useMemo(() => {
    const seen = new Set(innings.batters.map((b) => b.playerId));
    return battingXi.filter((p) => !seen.has(p.userId));
  }, [battingXi, innings.batters]);
  const extrasParts = extrasBreakdownParts(innings.extras);
  const extrasDetail =
    extrasParts.length > 0
      ? extrasParts.join(' ').replace(/w /g, 'w').replace(/b /g, 'b')
      : 'b0 lb0 w0 nb0';

  return (
    <CockpitPanel title="Scorecard" live bodyNoPad>
      <View className="flex-1">
        <View className="flex-row border-b border-outline-variant bg-surface-container-low">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                className={`px-2.5 py-1.5 ${active ? 'border-b-2 border-secondary bg-surface' : ''}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  className={`font-sans text-[11px] ${
                    active ? 'font-sans-semibold text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {item.label}
                  {item.stub ? ' · stub' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView className="flex-1" contentContainerClassName="pb-3">
          {tab === 'scorecard' ? (
            <View>
              <View className="flex-row border-b border-outline-variant bg-surface-container-low px-2 py-1">
                <Text className="flex-[2] font-sans-semibold text-[10px] uppercase text-on-surface-variant">
                  Batter
                </Text>
                <Text className="flex-[2] font-sans-semibold text-[10px] uppercase text-on-surface-variant">
                  How Out
                </Text>
                {(['R', 'B', '4s', '6s', 'SR'] as const).map((h) => (
                  <Text
                    key={h}
                    className="w-8 text-right font-sans-semibold text-[10px] uppercase text-on-surface-variant"
                  >
                    {h}
                  </Text>
                ))}
              </View>
              {innings.batters.map((batter) => {
                const onStrike = batter.playerId === innings.currentStrikerId && !batter.isOut;
                return (
                  <View
                    key={batter.playerId}
                    className="flex-row items-center border-b border-outline-variant/40 px-2 py-1"
                  >
                    <Text
                      className={`flex-[2] font-sans-semibold text-[12px] ${
                        !batter.isOut ? 'text-primary' : 'text-on-surface'
                      }`}
                      numberOfLines={1}
                    >
                      {nameOf(batter.playerId)}
                      {onStrike ? ' *' : ''}
                    </Text>
                    <Text className="flex-[2] font-sans text-[11px] text-on-surface-variant" numberOfLines={1}>
                      {batter.isOut
                        ? formatDismissalShort(batter, nameOf)
                        : formatBatterStatus(batter, nameOf)}
                    </Text>
                    <Text className="w-8 text-right font-sans text-[12px] text-on-surface">
                      {batter.runs}
                    </Text>
                    <Text className="w-8 text-right font-sans text-[12px] text-on-surface">
                      {batter.balls}
                    </Text>
                    <Text className="w-8 text-right font-sans text-[12px] text-on-surface">
                      {batter.fours}
                    </Text>
                    <Text className="w-8 text-right font-sans text-[12px] text-on-surface">
                      {batter.sixes}
                    </Text>
                    <Text className="w-8 text-right font-sans text-[12px] text-on-surface">
                      {formatBatterStrikeRateDisplay(batter)}
                    </Text>
                  </View>
                );
              })}
              {yetToBat.map((player) => (
                <View
                  key={player.userId}
                  className="flex-row items-center border-b border-outline-variant/40 px-2 py-1"
                >
                  <Text className="flex-[2] font-sans text-[12px] text-on-surface-variant">
                    {nameOf(player.userId)}
                  </Text>
                  <Text className="flex-[2] font-sans italic text-[11px] text-on-surface-variant">
                    yet to bat
                  </Text>
                  <View className="w-40" />
                </View>
              ))}
              <View className="flex-row border-t border-outline-variant px-2 py-1.5">
                <Text className="flex-[2] font-sans-bold text-[12px] text-on-surface">Extras</Text>
                <Text className="flex-[2] font-sans text-[11px] text-on-surface-variant">
                  {innings.extras.total} ({extrasDetail})
                </Text>
              </View>
              <View className="flex-row bg-surface-container-low px-2 py-1.5">
                <Text className="flex-[2] font-sans-bold text-[12px] text-on-surface">Total</Text>
                <Text className="flex-[2] font-sans text-[11px] text-on-surface-variant">
                  {innings.wickets} wkts · {innings.oversText} ov
                </Text>
                <Text className="font-sans-bold text-[12px] text-on-surface">{innings.runs}</Text>
              </View>
              {card.result.note ? (
                <Text className="px-2 pt-2 font-sans text-[11px] text-on-surface-variant">
                  {card.result.note}
                </Text>
              ) : null}
            </View>
          ) : null}

          {tab === 'partnerships' ? (
            <View className="px-2 pt-2">
              {partnershipRows(innings).length === 0 ? (
                <Text className="py-6 text-center font-sans text-xs text-on-surface-variant">
                  No partnerships yet
                </Text>
              ) : (
                partnershipRows(innings).map((stand, index) => (
                  <View
                    key={`${stand.batterIds.join('-')}-${index}`}
                    className="border-b border-outline-variant/50 py-2"
                  >
                    <Text className="font-sans-semibold text-[12px] text-on-surface">
                      {stand.batterIds.map((id) => nameOf(id)).join(' & ')}
                    </Text>
                    <Text className="font-sans text-[11px] text-on-surface-variant">
                      {stand.runs} ({stand.balls}) · RR {partnershipRunRate(stand.runs, stand.balls).toFixed(1)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === 'overs' ? (
            <View className="px-2 pt-2">
              {groupTimelineByOver(innings.timeline).map((over) => (
                <View key={over.overNumber} className="flex-row py-1">
                  <Text className="w-16 font-sans-semibold text-[12px] text-on-surface">
                    Ov {over.overNumber}
                  </Text>
                  <Text className="flex-1 font-sans text-[12px] text-on-surface">
                    {over.balls.join('  ')}
                  </Text>
                  <Text className="font-sans text-[12px] text-on-surface-variant">
                    {over.runs}/{over.wickets}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'scorebook' ? (
            <View className="p-3">
              <CockpitStubSlot
                title="Scorebook"
                note="Named per-ball batter/bowler cells are not on the live timeline yet."
              />
            </View>
          ) : null}
          {tab === 'spells' ? (
            <View className="p-3">
              <CockpitStubSlot
                title="Spells"
                note="Bowling spells are not derived on the client. Innings totals are on the Scorecard tab."
              />
            </View>
          ) : null}
          {tab === 'wizard' ? (
            <View className="p-3">
              <CockpitStubSlot title="Stats Wizard" note="Analytics UI is deferred." />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </CockpitPanel>
  );
}
