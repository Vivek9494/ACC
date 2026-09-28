import {
  BROADCAST_ENTRY_NOT_ASSIGNED_MESSAGE,
  BroadcastEntryAccess,
  formatBroadcastEntryMatchLabel,
  type BroadcastEntryMatch,
  type BroadcastEntryTournamentsResponse,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ObsConnectionSettingsModal } from '../src/components/scoring/cockpit/ObsConnectionSettingsModal';
import { Button } from '../src/components/ui/Button';
import { DashboardHeader } from '../src/components/ui/DashboardHeader';
import { KeyboardAwareFormScrollView } from '../src/components/ui/KeyboardAwareFormScrollView';
import { Select } from '../src/components/ui/Select';
import { Text } from '../src/components/ui/Text';
import { TextInput } from '../src/components/ui/TextInput';
import { ApiRequestError, getBroadcastEntryMatches, getBroadcastEntryTournaments } from '../src/lib/api';
import { hasAscObsBridge } from '../src/lib/asc-broadcast-bridge';
import { useAuth } from '../src/lib/auth-context';
import { confirmActionAlert } from '../src/lib/confirm-action-alert';
import { colors } from '@/theme/colors';

const NO_LIVE_TOURNAMENTS_MESSAGE = 'There are no Live tournaments right now.';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}

/**
 * ASC Broadcast (Electron) home: scoped tournament → match picker; picking a
 * match opens the scoring cockpit. Admin / Club Manager see every Live
 * tournament; scorers only the ones they're assigned to (server-scoped).
 */
export default function BroadcastHomeScreen(): React.ReactElement {
  const router = useRouter();
  const { signOut } = useAuth();
  const isElectron = hasAscObsBridge();
  const obsBridge = isElectron ? window.ascBroadcast?.obs : undefined;

  const [entry, setEntry] = useState<BroadcastEntryTournamentsResponse | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [matches, setMatches] = useState<BroadcastEntryMatch[] | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!isElectron) {
      router.replace('/');
    }
  }, [isElectron, router]);

  const loadTournaments = useCallback(async () => {
    setEntryError(null);
    try {
      const next = await getBroadcastEntryTournaments();
      setEntry(next);
      setTournamentId((current) => {
        if (current && next.tournaments.some((t) => t.id === current)) {
          return current;
        }
        return next.tournaments.length === 1 ? next.tournaments[0].id : null;
      });
    } catch (err) {
      setEntryError(errorMessage(err, 'Could not load tournaments.'));
    }
  }, []);

  const loadMatches = useCallback(async (id: string) => {
    setMatchesLoading(true);
    setMatchesError(null);
    setMatches(null);
    try {
      setMatches(await getBroadcastEntryMatches(id));
    } catch (err) {
      setMatchesError(errorMessage(err, 'Could not load matches.'));
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isElectron) {
      void loadTournaments();
    }
  }, [isElectron, loadTournaments]);

  useEffect(() => {
    if (tournamentId) {
      void loadMatches(tournamentId);
    } else {
      setMatches(null);
    }
  }, [tournamentId, loadMatches]);

  useEffect(() => {
    if (!obsBridge) {
      return;
    }
    return obsBridge.onOpenSettings(() => setSettingsOpen(true));
  }, [obsBridge]);

  const tournamentOptions = useMemo(
    () => (entry?.tournaments ?? []).map((t) => ({ value: t.id, label: t.name })),
    [entry],
  );
  const matchOptions = useMemo(
    () => (matches ?? []).map((m) => ({ value: m.id, label: formatBroadcastEntryMatchLabel(m) })),
    [matches],
  );

  const openMatch = useCallback((matchId: string) => {
    window.ascBroadcast?.openMatch?.(matchId);
  }, []);

  const onLogout = useCallback(() => {
    confirmActionAlert({
      title: 'Log out?',
      message: 'The next scorer will need to sign in.',
      confirmLabel: 'Log Out',
      onConfirm: async () => {
        await signOut();
        router.replace('/login');
      },
    });
  }, [router, signOut]);

  const tournaments = entry?.tournaments ?? [];

  let tournamentStep: React.ReactNode;
  if (entryError) {
    tournamentStep = (
      <View className="gap-2">
        <Text className="font-sans text-sm text-error">{entryError}</Text>
        <Pressable onPress={() => void loadTournaments()} className="self-start py-1">
          <Text className="font-sans-semibold text-sm text-primary">Retry</Text>
        </Pressable>
      </View>
    );
  } else if (!entry) {
    tournamentStep = <ActivityIndicator color={colors.primary} />;
  } else if (tournaments.length === 0) {
    tournamentStep = (
      <Text className="font-sans text-base text-on-surface-variant">
        {entry.access === BroadcastEntryAccess.All
          ? NO_LIVE_TOURNAMENTS_MESSAGE
          : BROADCAST_ENTRY_NOT_ASSIGNED_MESSAGE}
      </Text>
    );
  } else if (tournaments.length === 1) {
    tournamentStep = <TextInput label="Tournament" value={tournaments[0].name} editable={false} />;
  } else {
    tournamentStep = (
      <Select
        label="Tournament"
        placeholder="Select a tournament"
        value={tournamentId}
        options={tournamentOptions}
        onChange={setTournamentId}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAwareFormScrollView
        contentContainerClassName="gap-6 px-4 py-4"
        footer={
          <View className="flex-row justify-between gap-3 px-4 py-4">
            <Button variant="outline" label="Log out" onPress={onLogout} />
            {obsBridge ? (
              <Button variant="outline" label="OBS Settings" onPress={() => setSettingsOpen(true)} />
            ) : null}
          </View>
        }
      >
        <DashboardHeader fallbackName="Scorer" />
        <View className="gap-1">
          <Text className="font-sans-bold text-xl text-on-surface">ASC Broadcast</Text>
          <Text className="font-sans text-sm text-on-surface-variant">
            Choose a tournament and match to open the scoring cockpit.
          </Text>
        </View>

        {tournamentStep}

        {tournamentId ? (
          <Select
            label="Match"
            placeholder="Select a match"
            value={null}
            options={matchOptions}
            onChange={openMatch}
            loading={matchesLoading}
            error={matchesError}
            onRetry={() => void loadMatches(tournamentId)}
            emptyMessage="No Live or upcoming matches in this tournament."
          />
        ) : null}
      </KeyboardAwareFormScrollView>

      {obsBridge ? (
        <ObsConnectionSettingsModal
          visible={settingsOpen}
          bridge={obsBridge}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
