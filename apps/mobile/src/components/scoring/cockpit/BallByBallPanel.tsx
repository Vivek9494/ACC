import { groupTimelineByOver, type InningsScorecard, type TimelineEntry } from '@acc/types';
import { ScrollView, View } from 'react-native';

import { Text } from '../../ui/Text';
import { CockpitPanel } from './CockpitPanel';
import { extrasTypeFromCode, isExtraCode } from './cockpit-stats';

/**
 * Same naming authority as scorecard tables (`nameOf` from display.players + squads).
 * Null or unresolvable ids render "—" — never invent a label.
 */
function ballParticipantLabel(
  id: string | null,
  nameOf: (id: string | null) => string,
): string {
  if (!id) return '—';
  const label = nameOf(id);
  return label === 'Player' ? '—' : label;
}

function groupEntriesByOver(timeline: TimelineEntry[]): {
  overNumber: number;
  runs: number;
  wickets: number;
  entries: TimelineEntry[];
}[] {
  const summaries = groupTimelineByOver(timeline);
  const map = new Map<number, TimelineEntry[]>();
  for (const entry of timeline) {
    if (entry.overNumber === null) continue;
    const list = map.get(entry.overNumber) ?? [];
    list.push(entry);
    map.set(entry.overNumber, list);
  }
  return summaries
    .slice()
    .reverse()
    .map((over) => ({
      overNumber: over.overNumber,
      runs: over.runs,
      wickets: over.wickets,
      entries: (map.get(over.overNumber) ?? []).slice().reverse(),
    }));
}

export function BallByBallPanel({
  innings,
  nameOf,
}: {
  innings: InningsScorecard;
  nameOf: (id: string | null) => string;
}): React.ReactElement {
  const overs = groupEntriesByOver(innings.timeline);

  return (
    <CockpitPanel title="Ball by Ball" live bodyNoPad>
      <View className="flex-1">
        <View className="flex-row border-b border-outline-variant bg-surface-container-low px-2 py-1">
          <Text className="w-10 font-sans-semibold text-[10px] uppercase text-on-surface-variant">
            #
          </Text>
          <Text className="flex-1 font-sans-semibold text-[10px] uppercase text-on-surface-variant">
            Batter
          </Text>
          <Text className="flex-1 font-sans-semibold text-[10px] uppercase text-on-surface-variant">
            Bowler
          </Text>
          <Text className="w-8 text-right font-sans-semibold text-[10px] uppercase text-on-surface-variant">
            R
          </Text>
          <Text className="w-12 text-right font-sans-semibold text-[10px] uppercase text-on-surface-variant">
            Extra
          </Text>
          <Text className="w-16 font-sans-semibold text-[10px] uppercase text-on-surface-variant">
            Wkt
          </Text>
        </View>
        <ScrollView className="flex-1" contentContainerClassName="pb-2">
          {overs.length === 0 ? (
            <Text className="px-2 py-6 text-center font-sans text-xs text-on-surface-variant">
              No deliveries yet
            </Text>
          ) : (
            overs.map((over) => (
              <View key={over.overNumber}>
                <View className="bg-surface-container-low px-2 py-1">
                  <Text className="font-sans-bold text-[11px] text-on-surface-variant">
                    Over {over.overNumber} · {over.runs} runs
                    {over.wickets > 0 ? ` · ${over.wickets} wkt` : ''}
                  </Text>
                </View>
                {over.entries.map((entry) => (
                  <View
                    key={entry.sequence}
                    className="flex-row items-center border-b border-outline-variant/50 px-2 py-1"
                  >
                    <View className="w-10">
                      <Text className="font-sans text-[11px] text-on-surface">
                        {entry.label || '—'}
                      </Text>
                    </View>
                    <View className="flex-1 pr-1">
                      <Text
                        className="font-sans text-[11px] text-on-surface"
                        numberOfLines={1}
                      >
                        {ballParticipantLabel(entry.strikerId, nameOf)}
                      </Text>
                    </View>
                    <View className="flex-1 pr-1">
                      <Text
                        className="font-sans text-[11px] text-on-surface"
                        numberOfLines={1}
                      >
                        {ballParticipantLabel(entry.bowlerId, nameOf)}
                      </Text>
                    </View>
                    <View className="w-8">
                      <Text className="text-right font-sans text-[11px] text-on-surface">
                        {isExtraCode(entry.code) ? '—' : String(entry.runs)}
                      </Text>
                    </View>
                    <View className="w-12">
                      <Text className="text-right font-sans text-[11px] text-on-surface">
                        {extrasTypeFromCode(entry.code)}
                      </Text>
                    </View>
                    <View className="w-16">
                      <Text className="font-sans text-[11px] text-on-surface" numberOfLines={1}>
                        {entry.isWicket ? entry.description.replace(/^WICKET — /, '') : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </CockpitPanel>
  );
}
