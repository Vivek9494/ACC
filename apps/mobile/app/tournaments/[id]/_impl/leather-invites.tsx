import {
  type CreateLeatherInvitesRequest,
  type CreateLeatherInvitesResponse,
  type LeatherInviteCandidatesResponse,
  type LeatherTournamentInvitesResponse,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../../src/components/ui/Button';
import { Checkbox } from '../../../../src/components/ui/Checkbox';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { KeyboardAwareFormScrollView } from '../../../../src/components/ui/KeyboardAwareFormScrollView';
import { FIELD_ORANGE } from '../../../../src/components/ui/fieldStyles';
import { Text } from '../../../../src/components/ui/Text';
import { TextInput } from '../../../../src/components/ui/TextInput';
import {
  ApiRequestError,
  createLeatherInvites,
  listLeatherInviteCandidates,
  listLeatherInvites,
  revokeLeatherInvite,
} from '../../../../src/lib/api';

export default function LeatherInvitesScreen(): React.ReactElement {
  const { id: tournamentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [candidates, setCandidates] = useState<
    LeatherInviteCandidatesResponse['candidates']
  >([]);
  const [invites, setInvites] = useState<LeatherTournamentInvitesResponse['invites']>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    if (!tournamentId) {
      setError('Tournament not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [candidateResponse, inviteResponse] = await Promise.all([
        listLeatherInviteCandidates(tournamentId, debouncedSearch || undefined),
        listLeatherInvites(tournamentId),
      ]);
      setCandidates(candidateResponse.candidates);
      setInvites(inviteResponse.invites);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load invite data.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedCount = selectedIds.size;

  const toggleSelection = useCallback((userId: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  async function handleInvite(): Promise<void> {
    if (!tournamentId || selectedCount === 0) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body: CreateLeatherInvitesRequest = {
        userIds: [...selectedIds],
      };
      await createLeatherInvites(tournamentId, body);
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not send invites.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(userId: string): Promise<void> {
    if (!tournamentId) {
      return;
    }

    setRevokingId(userId);
    setError(null);
    try {
      await revokeLeatherInvite(tournamentId, userId);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not revoke invite.');
    } finally {
      setRevokingId(null);
    }
  }

  const emptyMessage = useMemo(() => {
    if (debouncedSearch) {
      return 'No matching players found.';
    }
    return 'No players available to invite.';
  }, [debouncedSearch]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="New Invite" onBack={() => router.back()} />

      <KeyboardAwareFormScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-4 pt-2"
        footer={
          <SafeAreaView
            edges={['bottom']}
            className="border-t border-outline-variant/20 bg-background px-4 pt-3"
          >
            <Button
              disabled={submitting || selectedCount === 0}
              onPress={() => void handleInvite()}
              className="h-14 w-full"
              label={submitting ? 'Inviting…' : `Invite selected (${selectedCount})`}
            />
          </SafeAreaView>
        }
      >
        <TextInput
          label="Search by name"
          value={search}
          onChangeText={setSearch}
          placeholder="Player name"
        />

        {error ? (
          <Text className="font-sans text-sm text-primary">{error}</Text>
        ) : null}

        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={FIELD_ORANGE} />
          </View>
        ) : (
          <>
            <View className="gap-2">
              <Text className="font-sans-bold text-lg text-on-surface">Invite players</Text>
              {candidates.length === 0 ? (
                <Text className="font-sans text-sm text-on-surface-variant">{emptyMessage}</Text>
              ) : (
                candidates.map((candidate) => {
                  const label = `${candidate.firstName} ${candidate.lastName}`;
                  const checked = selectedIds.has(candidate.userId);
                  return (
                    <Pressable
                      key={candidate.userId}
                      onPress={() => toggleSelection(candidate.userId)}
                      className="rounded-control border border-outline-variant bg-surface px-4 py-3"
                    >
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleSelection(candidate.userId)}
                      >
                        <Text className="font-sans-semibold text-base text-on-surface">{label}</Text>
                        <Text className="font-sans text-sm text-on-surface-variant">
                          {candidate.centerName}
                        </Text>
                      </Checkbox>
                    </Pressable>
                  );
                })
              )}
            </View>

            {invites.length > 0 ? (
              <View className="gap-2">
                <Text className="font-sans-bold text-lg text-on-surface">Pending invites</Text>
                {invites.map((invite) => (
                  <View
                    key={invite.userId}
                    className="flex-row items-center justify-between gap-3 rounded-control border border-outline-variant bg-surface px-4 py-3"
                  >
                    <View className="flex-1">
                      <Text className="font-sans-semibold text-base text-on-surface">
                        {invite.firstName} {invite.lastName}
                      </Text>
                      <Text className="font-sans text-sm text-on-surface-variant">
                        {invite.centerName}
                      </Text>
                    </View>
                    {invite.canRevoke ? (
                      <Pressable
                        onPress={() => void handleRevoke(invite.userId)}
                        disabled={revokingId === invite.userId}
                        accessibilityRole="button"
                        accessibilityLabel={`Revoke invite for ${invite.firstName}`}
                      >
                        <Text className="font-sans-semibold text-sm text-primary">
                          {revokingId === invite.userId ? 'Removing…' : 'Remove'}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text className="font-sans text-sm text-on-surface-variant">Registered</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
