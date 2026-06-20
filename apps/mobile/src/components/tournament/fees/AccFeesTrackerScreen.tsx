import { Ionicons } from '@expo/vector-icons';
import {
  TournamentFeesTrackerLayout,
  formatFeeAmountCents,
  type TournamentFeeEntry,
  type TournamentFeeTeamGroup,
  type TournamentFeesTracker,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiRequestError, getTournamentFeesTracker, markTournamentFeePaid } from '../../../lib/api';
import { ProfileMenu } from '../../ui/ProfileMenu';
import { FIELD_ORANGE } from '../../ui/fieldStyles';
import { Text } from '../../ui/Text';
import { FeePaidPlayerCard, FeeUnpaidPlayerCard } from './FeePlayerCard';

type FeesTab = 'paid' | 'remaining';

export interface AccFeesTrackerScreenProps {
  tournamentId: string;
}

function FeeListSection({
  group,
  tab,
  showTeamHeaders,
  showTeamNameOnCards,
  busyId,
  onPay,
}: {
  group: TournamentFeeTeamGroup;
  tab: FeesTab;
  showTeamHeaders: boolean;
  showTeamNameOnCards: boolean;
  busyId: string | null;
  onPay: (entry: TournamentFeeEntry) => void;
}): React.ReactElement {
  return (
    <View className="gap-3">
      {showTeamHeaders ? (
        <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
          {group.teamName}
        </Text>
      ) : null}
      {group.entries.map((entry) =>
        tab === 'paid' ? (
          <FeePaidPlayerCard
            key={entry.id}
            entry={entry}
            showTeamName={showTeamNameOnCards}
          />
        ) : (
          <FeeUnpaidPlayerCard
            key={entry.id}
            entry={entry}
            busy={busyId === entry.id}
            showTeamName={showTeamNameOnCards}
            onPay={() => onPay(entry)}
          />
        ),
      )}
    </View>
  );
}

export function AccFeesTrackerScreen({ tournamentId }: AccFeesTrackerScreenProps): React.ReactElement {
  const router = useRouter();
  const [tab, setTab] = useState<FeesTab>('remaining');
  const [tracker, setTracker] = useState<TournamentFeesTracker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tournamentId) {
      return;
    }
    setLoading(true);
    try {
      const data = await getTournamentFeesTracker(tournamentId);
      setTracker(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load fees.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmPay(entry: TournamentFeeEntry): void {
    const playerName = `${entry.firstName} ${entry.lastName}`;
    Alert.alert(
      `Mark ${playerName}'s fee as paid?`,
      formatFeeAmountCents(entry.amountCents),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            setBusyId(entry.id);
            void markTournamentFeePaid(tournamentId, entry.id)
              .then(() => {
                setTab('paid');
                return load();
              })
              .catch((err: unknown) => {
                setError(err instanceof ApiRequestError ? err.message : 'Could not record payment.');
              })
              .finally(() => setBusyId(null));
          },
        },
      ],
    );
  }

  const groups = tab === 'paid' ? (tracker?.paid ?? []) : (tracker?.unpaid ?? []);
  const showTeamHeaders = tracker?.layout === TournamentFeesTrackerLayout.GroupedByTeam;
  const showTeamNameOnCards = true;
  const emptyLabel =
    tab === 'paid' ? 'No players have paid fees yet.' : 'All players have paid their fees.';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <ProfileMenu />
      </View>

      <View className="px-4 pb-2">
        <Text className="font-sans-bold text-2xl text-on-surface">ACC Fees Tracker</Text>
      </View>

      <View className="mx-4 mt-4 flex-row border-b border-outline-variant">
        {(
          [
            { key: 'paid' as const, label: 'Paid' },
            { key: 'remaining' as const, label: 'Remaining to Pay' },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              className="flex-1 pb-4"
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                className={`text-center font-sans-semibold text-sm ${
                  active ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                {item.label}
              </Text>
              {active ? <View className="mt-2 h-0.5 rounded-full bg-primary-container" /> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerClassName="gap-6 px-4 py-5 pb-28" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : groups.length === 0 || groups.every((group) => group.entries.length === 0) ? (
          <Text className="py-12 text-center font-sans text-sm text-on-surface-variant">{emptyLabel}</Text>
        ) : (
          groups.map((group) => (
            <FeeListSection
              key={group.teamId ?? (group.teamName || 'flat')}
              group={group}
              tab={tab}
              showTeamHeaders={showTeamHeaders}
              showTeamNameOnCards={showTeamNameOnCards}
              busyId={busyId}
              onPay={confirmPay}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
