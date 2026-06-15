import { Ionicons } from '@expo/vector-icons';
import {
  RegistrationVerificationPhase,
  type RegistrationDetail,
  type RegistrationSummary,
  type RegistrationVerificationQueue,
  type TournamentDetail,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiRequestError,
  approveRegistration,
  declineRegistration,
  getRegistrationVerificationQueue,
  getTournament,
} from '../../../lib/api';
import { ProfileMenu } from '../../ui/ProfileMenu';
import { SuccessDialog } from '../../ui/SuccessDialog';
import { FIELD_ORANGE } from '../../ui/fieldStyles';
import { Text } from '../../ui/Text';
import { VerifyNotRegisteredCard } from './VerifyNotRegisteredCard';
import { VerifyPlayerCard } from './VerifyPlayerCard';
import { VerifyPlayerRatingSheet } from './VerifyPlayerRatingSheet';

export interface VerifyPlayersScreenProps {
  tournamentId: string;
}

export function VerifyPlayersScreen({ tournamentId }: VerifyPlayersScreenProps): React.ReactElement {
  const router = useRouter();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [queue, setQueue] = useState<RegistrationVerificationQueue | null>(null);
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

  useEffect(() => {
    void load();
  }, [load]);

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

  function onLateRegisterPress(): void {
    router.push(`/registrations/${tournamentId}/late-register`);
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

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
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
        <Text className="font-sans-bold text-2xl text-on-surface">
          {tournament?.name ?? 'Verify Players'}
        </Text>
        <Text className="mt-1 font-sans text-sm text-on-surface-variant">
          Total Registered Players - {registeredCount}
        </Text>
        {isViewOnly ? (
          <Text className="mt-3 font-sans text-sm text-on-surface-variant">
            Registration is open — review who has signed up and follow up with players who have
            not registered yet.
          </Text>
        ) : null}
      </View>

      <ScrollView contentContainerClassName="gap-3 px-4 pb-28 pt-3" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : error ? (
          <View className="rounded-lg bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
          </View>
        ) : queue ? (
          <>
            {queue.registered.map((row) => (
              <VerifyPlayerCard
                key={row.id}
                row={row}
                canManage={queue.canManage}
                busy={busyId === row.id}
                onApprove={() => void approve(row.id)}
                onDecline={() => void decline(row)}
                onEdit={() => setEditingRow(row)}
              />
            ))}

            {queue.registered.length === 0 ? (
              <Text className="py-8 text-center font-sans text-sm text-on-surface-variant">
                No players from your center have registered yet.
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

      {queue?.canLateRegister ? (
        <Pressable
          onPress={onLateRegisterPress}
          accessibilityRole="button"
          accessibilityLabel="Late register a player"
          className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg active:scale-95"
          style={{
            shadowColor: '#ff6b00',
            shadowOpacity: 0.25,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <Ionicons name="person-add" size={28} color="#ffffff" />
        </Pressable>
      ) : null}

      <VerifyPlayerRatingSheet
        visible={editingRow !== null}
        row={editingRow}
        tournamentId={tournamentId}
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
