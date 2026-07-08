import { colors } from '@/theme/colors';
import {
  POLL_RESULTS_SECTION_LABELS,
  formatPollVoteTimeLabel,
  type ParticipationPollTallyView,
  type PollResultsTab,
  type PollTallyPlayerRow,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getParticipationPollTally } from '../../lib/api';
import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Card } from '../ui/Card';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Text } from '../ui/Text';
import { UnderlineTabBar } from '../ui/UnderlineTabBar';
import { FIELD_ORANGE } from '../ui/fieldStyles';

type PollTabKey = PollResultsTab;

/** Matches Confirmed List / Registered Players row chrome. */
const POLL_PLAYER_CARD_CLASS =
  'flex-row items-center gap-3 rounded-control border border-outline-variant';

function playersForTab(tally: ParticipationPollTallyView, tab: PollTabKey): PollTallyPlayerRow[] {
  if (tab === 'in') return tally.in;
  if (tab === 'out') return tally.out;
  return tally.pending;
}

function countForTab(tally: ParticipationPollTallyView, tab: PollTabKey): number {
  if (tab === 'in') return tally.inCount;
  if (tab === 'out') return tally.outCount;
  return tally.pendingCount;
}

function statusIcon(tab: PollTabKey): React.ReactElement {
  if (tab === 'in') {
    return <MaterialIcons name="check-circle" size={24} color={FIELD_ORANGE} />;
  }
  if (tab === 'out') {
    return <MaterialIcons name="cancel" size={24} color={colors.textMuted} />;
  }
  return <MaterialIcons name="schedule" size={24} color={colors.textMuted} />;
}

function PollResultsTabBar({
  tally,
  activeTab,
  onChange,
}: {
  tally: ParticipationPollTallyView;
  activeTab: PollTabKey;
  onChange: (tab: PollTabKey) => void;
}): React.ReactElement {
  const showPending = tally.canViewPending && tally.pendingCount > 0;
  const tabs: { key: PollTabKey; label: string }[] = [
    { key: 'in', label: `IN (${tally.inCount})` },
    { key: 'out', label: `OUT (${tally.outCount})` },
  ];
  if (showPending) {
    tabs.push({ key: 'pending', label: `PENDING (${tally.pendingCount})` });
  }

  const options = tabs.map((tab) => ({ value: tab.key, label: tab.label }));

  return (
    <UnderlineTabBar layout="spread" options={options} value={activeTab} onChange={onChange} />
  );
}

function PollResultsPlayerCard({
  player,
  tab,
  timezone,
}: {
  player: PollTallyPlayerRow;
  tab: PollTabKey;
  timezone: string | null;
}): React.ReactElement {
  const voteTimeLabel =
    tab !== 'pending' && player.votedAt
      ? formatPollVoteTimeLabel(player.votedAt, timezone)
      : null;

  return (
    <Card className={POLL_PLAYER_CARD_CLASS}>
      <PlayerAvatar
        firstName={player.firstName}
        profilePhotoUrl={player.profilePhotoUrl}
        size="sm"
        shape="square"
      />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-base text-on-surface">
          {player.firstName} {player.lastName}
        </Text>
        {voteTimeLabel ? (
          <Text className="font-sans text-sm text-on-surface-variant">{voteTimeLabel}</Text>
        ) : null}
      </View>
      {statusIcon(tab)}
    </Card>
  );
}

export interface PollResultsScreenProps {
  pollId: string;
}

/** Tabbed IN / OUT / PENDING lists for a team participation poll (§9.7). */
export function PollResultsScreen({ pollId }: PollResultsScreenProps): React.ReactElement {
  const [tally, setTally] = useState<ParticipationPollTallyView | null>(null);
  const [activeTab, setActiveTab] = useState<PollTabKey>('in');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTally(await getParticipationPollTally(pollId));
    } catch {
      setError('Could not load poll results.');
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!tally) return;
    const showPending = tally.canViewPending && tally.pendingCount > 0;
    if (activeTab === 'pending' && !showPending) {
      setActiveTab('in');
    }
  }, [activeTab, tally]);

  const activePlayers = useMemo(
    () => (tally ? playersForTab(tally, activeTab) : []),
    [activeTab, tally],
  );
  const activeCount = tally ? countForTab(tally, activeTab) : 0;
  const sectionLabel = POLL_RESULTS_SECTION_LABELS[activeTab];
  const playerPillLabel = `${activeCount} ${activeCount === 1 ? 'PLAYER' : 'PLAYERS'}`;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScreenHeader title="Poll Results" accentTitle />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : null}

      {error ? (
        <View className="px-4">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      {tally ? (
        <View className="flex-1">
          <PollResultsTabBar tally={tally} activeTab={activeTab} onChange={setActiveTab} />

          <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
            <Text className="font-sans-bold text-xs tracking-wider text-on-surface-variant">
              {sectionLabel}
            </Text>
            <View className="rounded-full bg-primary-container px-3 py-1">
              <Text className="font-sans-bold text-xs text-primary">{playerPillLabel}</Text>
            </View>
          </View>

          <ScrollView className="flex-1 px-4" contentContainerClassName="gap-3 pb-8">
            {activePlayers.length === 0 ? (
              <Text className="py-6 font-sans text-sm text-on-surface-variant">No players</Text>
            ) : (
              activePlayers.map((player) => (
                <PollResultsPlayerCard
                  key={player.userId}
                  player={player}
                  tab={activeTab}
                  timezone={tally.timezone}
                />
              ))
            )}
          </ScrollView>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
