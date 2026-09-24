import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import {
  BallType,
  RegistrationStatus,
  RegistrationVerificationPhase,
  type RegistrationDetail,
  type RegistrationSummary,
  type RegistrationVerificationQueue,
  type TournamentDetail,
} from '@acc/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiRequestError,
  approveRegistration,
  declineRegistration,
  getRegistrationVerificationQueue,
  getTournament,
  revertRegistrationToWaitlist,
} from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { tournamentSubpathHref } from '../../../lib/tournament-detail-route';
import { PillTabBar } from '../../ui/PillTabBar';
import { ScreenHeader } from '../../ui/ScreenHeader';
import { SuccessDialog } from '../../ui/SuccessDialog';
import { FIELD_ORANGE } from '../../ui/fieldStyles';
import { Text } from '../../ui/Text';
import { VerifyNotRegisteredCard } from './VerifyNotRegisteredCard';
import { VerifyPlayerCard } from './VerifyPlayerCard';
import { VerifyPlayerRatingSheet } from './VerifyPlayerRatingSheet';

type VerifyStatusTab = 'pending' | 'verified' | 'declined';

const STATUS_BY_TAB: Record<VerifyStatusTab, typeof RegistrationStatus[keyof typeof RegistrationStatus]> = {
  pending: RegistrationStatus.InWaitlist,
  verified: RegistrationStatus.Confirmed,
  declined: RegistrationStatus.Declined,
};

export interface VerifyPlayersScreenProps {
  tournamentId: string;
}

export function VerifyPlayersScreen({ tournamentId }: VerifyPlayersScreenProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [queue, setQueue] = useState<RegistrationVerificationQueue | null>(null);
  const [statusTab, setStatusTab] = useState<VerifyStatusTab>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<RegistrationSummary | null>(null);
  const [showRatingsSaved, setShowRatingsSaved] = useState(false);

  const load = useCallback(async () => {
    if (!tournamentId) {
      return;
    }
    setLoading(true);
    try {
      const [tournamentDetail, verificationQueue] = await Promise.all([
        getTournament(tournamentId),
        getRegistrationVerificationQueue(tournamentId),
      ]);
      setTournament(tournamentDetail);
      setQueue(verificationQueue);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load players.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pending = useMemo(
    () =>
      queue?.registered.filter((row) => row.status === RegistrationStatus.InWaitlist) ?? [],
    [queue],
  );
  const verified = useMemo(
    () =>
      queue?.registered.filter((row) => row.status === RegistrationStatus.Confirmed) ?? [],
    [queue],
  );
  const declined = useMemo(
    () =>
      queue?.registered.filter((row) => row.status === RegistrationStatus.Declined) ?? [],
    [queue],
  );

  const tabOptions = useMemo(
    () => [
      { value: 'pending' as const, label: `Pending (${pending.length})` },
      { value: 'verified' as const, label: `Verified (${verified.length})` },
      { value: 'declined' as const, label: `Declined (${declined.length})` },
    ],
    [pending.length, verified.length, declined.length],
  );

  const filteredRows = useMemo(() => {
    if (!queue) {
      return [];
    }
    const status = STATUS_BY_TAB[statusTab];
    return queue.registered.filter((row) => row.status === status);
  }, [queue, statusTab]);

  async function approve(id: string): Promise<void> {
    if (!tournamentId || queue?.canManage !== true) {
      return;
    }
    setBusyId(id);
    try {
      await approveRegistration(tournamentId, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not approve player.');
    } finally {
      setBusyId(null);
    }
  }

  async function decline(row: RegistrationSummary): Promise<void> {
    if (!tournamentId || queue?.canManage !== true) {
      return;
    }
    Alert.alert(
      'Decline registration?',
      `Mark ${row.firstName} ${row.lastName} as declined for this tournament?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            setBusyId(row.id);
            void declineRegistration(tournamentId, row.id)
              .then(() => load())
              .catch((err: unknown) => {
                setError(err instanceof ApiRequestError ? err.message : 'Could not decline player.');
              })
              .finally(() => setBusyId(null));
          },
        },
      ],
    );
  }

  async function revert(row: RegistrationSummary): Promise<void> {
    if (!tournamentId || queue?.canManage !== true) {
      return;
    }
    Alert.alert(
      'Move back to pending?',
      `Move ${row.firstName} ${row.lastName} back to the pending list so you can verify them again?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to pending',
          onPress: () => {
            setBusyId(row.id);
            void revertRegistrationToWaitlist(tournamentId, row.id)
              .then(() => load())
              .catch((err: unknown) => {
                setError(
                  err instanceof ApiRequestError
                    ? err.message
                    : 'Could not move player back to pending.',
                );
              })
              .finally(() => setBusyId(null));
          },
        },
      ],
    );
  }

  function onLateRegisterPress(): void {
    router.push(tournamentSubpathHref(user, tournamentId, 'registrations/late-register'));
  }

  function onRatingsSaved(updated: RegistrationDetail): void {
    setQueue((current) =>
      current
        ? {
            ...current,
            registered: current.registered.map((row) =>
              row.id === updated.id
                ? {
                    ...row,
                    battingRating: updated.battingRating,
                    bowlingRating: updated.bowlingRating,
                    fieldingRating: updated.fieldingRating,
                  }
                : row,
            ),
          }
        : current,
    );
    setEditingRow(null);
    setShowRatingsSaved(true);
  }

  const isViewOnly = queue?.phase === RegistrationVerificationPhase.ViewOnly;
  const registeredCount = queue?.registeredCount ?? 0;
  const lateRegisterTrailing =
    queue?.canLateRegister === true ? (
      <Pressable
        onPress={onLateRegisterPress}
        accessibilityRole="button"
        accessibilityLabel="Late register a player"
        className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary active:opacity-90"
      >
        <Ionicons name="add" size={22} color={colors.textInverse} />
      </Pressable>
    ) : undefined;

  const emptyMessage =
    registeredCount === 0
      ? 'No players from your center have registered yet.'
      : statusTab === 'pending'
        ? 'No pending players.'
        : statusTab === 'verified'
          ? 'No verified players.'
          : 'No declined players.';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader
        title={tournament?.name ?? 'Verify Players'}
        subtitle={`Total Registered Players - ${registeredCount}`}
        onBack={() => router.back()}
        titleTrailing={lateRegisterTrailing}
      />

      <View className="gap-3 px-4 pb-2">
        {isViewOnly ? (
          <Text className="mt-3 font-sans text-sm text-on-surface-variant">
            Registration is open — review who has signed up and follow up with players who have
            not registered yet.
          </Text>
        ) : null}
        {!loading && !error && queue ? (
          <PillTabBar
            options={tabOptions}
            value={statusTab}
            onChange={setStatusTab}
            layout="equal"
            accessibilityLabel="Verification status"
          />
        ) : null}
      </View>

      <ScrollView contentContainerClassName="gap-3 px-4 pb-8 pt-3" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : queue ? (
          <>
            {filteredRows.map((row) => (
              <VerifyPlayerCard
                key={row.id}
                row={row}
                canManage={queue.canManage}
                busy={busyId === row.id}
                onApprove={() => void approve(row.id)}
                onDecline={() => void decline(row)}
                onEdit={() => setEditingRow(row)}
                onRevert={() => void revert(row)}
              />
            ))}

            {filteredRows.length === 0 ? (
              <Text className="py-8 text-center font-sans text-sm text-on-surface-variant">
                {emptyMessage}
              </Text>
            ) : null}

            {isViewOnly && queue.notRegistered.length > 0 ? (
              <View className="mt-4 gap-3">
                <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
                  Not registered ({queue.notRegistered.length})
                </Text>
                {queue.notRegistered.map((player) => (
                  <VerifyNotRegisteredCard key={player.userId} player={player} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <VerifyPlayerRatingSheet
        visible={editingRow !== null}
        row={editingRow}
        tournamentId={tournamentId}
        isLeatherBall={tournament?.ballType === BallType.Leather}
        onClose={() => setEditingRow(null)}
        onSaved={onRatingsSaved}
      />

      <SuccessDialog
        visible={showRatingsSaved}
        title="Ratings updated"
        message="Player ratings have been saved."
        autoDismissMs={2500}
        onDismiss={() => setShowRatingsSaved(false)}
        continueLabel="OK"
      />
    </SafeAreaView>
  );
}
