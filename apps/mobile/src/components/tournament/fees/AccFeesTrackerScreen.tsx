import { Ionicons } from '@expo/vector-icons';
import {
  TournamentFeesTrackerLayout,
  buildFeeTrackerCenterOptions,
  countFeeTrackerEntries,
  FEES_TRACKER_ALL_CENTERS,
  filterFeeTrackerGroupsByCenter,
  formatFeeAmountCents,
  type TournamentFeeEntry,
  type TournamentFeeTeamGroup,
  type TournamentFeesTracker,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiRequestError, getTournamentFeesTracker, markTournamentFeePaid } from '../../../lib/api';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { Select } from '../../ui/Select';
import { UnderlineTabBar } from '../../ui/UnderlineTabBar';
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
  showSectionHeaders,
  busyId,
  onPay,
}: {
  group: TournamentFeeTeamGroup;
  tab: FeesTab;
  showSectionHeaders: boolean;
  busyId: string | null;
  onPay: (entry: TournamentFeeEntry) => void;
}): React.ReactElement {
  return (
    <View className="gap-3">
      {showSectionHeaders ? (
        <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
          {group.teamName}
        </Text>
      ) : null}
      {group.entries.map((entry) =>
        tab === 'paid' ? (
          <FeePaidPlayerCard key={entry.id} entry={entry} />
        ) : (
          <FeeUnpaidPlayerCard
            key={entry.id}
            entry={entry}
            busy={busyId === entry.id}
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
  const [centerFilter, setCenterFilter] = useState<string>(FEES_TRACKER_ALL_CENTERS);
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

  useEffect(() => {
    setCenterFilter(FEES_TRACKER_ALL_CENTERS);
  }, [tournamentId]);

  const showCenterFilter = tracker?.layout === TournamentFeesTrackerLayout.GroupedByCenter;

  const centerOptions = useMemo(
    () => (tracker && showCenterFilter ? buildFeeTrackerCenterOptions(tracker) : []),
    [showCenterFilter, tracker],
  );

  const selectedCenterId = useMemo(
    () => (centerFilter === FEES_TRACKER_ALL_CENTERS ? null : centerFilter),
    [centerFilter],
  );

  const filteredPaidGroups = useMemo(
    () => filterFeeTrackerGroupsByCenter(tracker?.paid ?? [], selectedCenterId),
    [selectedCenterId, tracker?.paid],
  );

  const filteredUnpaidGroups = useMemo(
    () => filterFeeTrackerGroupsByCenter(tracker?.unpaid ?? [], selectedCenterId),
    [selectedCenterId, tracker?.unpaid],
  );

  const paidCount = countFeeTrackerEntries(filteredPaidGroups);
  const unpaidCount = countFeeTrackerEntries(filteredUnpaidGroups);

  const tabOptions = useMemo(
    () => [
      { value: 'paid' as const, label: 'Paid', count: paidCount },
      { value: 'remaining' as const, label: 'Remaining to Pay', count: unpaidCount },
    ],
    [paidCount, unpaidCount],
  );

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

  const groups = tab === 'paid' ? filteredPaidGroups : filteredUnpaidGroups;
  const showSectionHeaders =
    (tracker?.layout === TournamentFeesTrackerLayout.GroupedByTeam ||
      tracker?.layout === TournamentFeesTrackerLayout.GroupedByCenter) &&
    selectedCenterId == null;
  const emptyLabel =
    tab === 'paid' ? 'No players have paid fees yet.' : 'All players have paid their fees.';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Fees Tracker" onBack={() => router.back()} />

      <View className="mx-4 mt-4 gap-4">
        {showCenterFilter && centerOptions.length > 1 ? (
          <Select
            label="Center"
            value={centerFilter}
            options={centerOptions}
            onChange={setCenterFilter}
            placeholder="All Centers"
          />
        ) : null}

        <UnderlineTabBar layout="spread" options={tabOptions} value={tab} onChange={setTab} />
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
              showSectionHeaders={showSectionHeaders}
              busyId={busyId}
              onPay={confirmPay}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
