import {
  MAX_IMPACT_CANDIDATES,
  MAX_SUBSTITUTES,
  PLAYING_XI_SIZE,
  REGISTRATION_PLAYER_TYPE_LABELS,
  RegistrationPlayerType,
  type SquadCandidate,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { PlayerAvatar } from '../../../src/components/tournament/PlayerAvatar';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiRequestError, getMatch, getSquadCandidates, lockPlayingXi } from '../../../src/lib/api';

type Bucket = 'XI' | 'SUB' | 'IMP';

function playerTypeLabel(candidate: SquadCandidate): string | null {
  return candidate.playerType ? REGISTRATION_PLAYER_TYPE_LABELS[candidate.playerType] : null;
}

export default function PlayingXiScreen(): React.ReactElement {
  const { matchId, teamId, teamName } = useLocalSearchParams<{
    matchId: string;
    teamId: string;
    teamName?: string;
  }>();
  const router = useRouter();

  const [candidates, setCandidates] = useState<SquadCandidate[]>([]);
  const [impactEnabled, setImpactEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

  const [bucket, setBucket] = useState<Bucket>('XI');
  const [xi, setXi] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [impact, setImpact] = useState<string[]>([]);
  const [activeImpact, setActiveImpact] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!matchId || !teamId) return;
    setLoading(true);
    try {
      const [list, match] = await Promise.all([getSquadCandidates(matchId, teamId), getMatch(matchId)]);
      setCandidates(list);
      setImpactEnabled(match.impactPlayerEnabled);
      // Pre-fill from any existing locked squad for this team.
      const existing = match.squads.find((s) => s.teamId === teamId);
      if (existing) {
        setXi(existing.players.filter((p) => p.role === 'PLAYING_XI').map((p) => p.userId));
        setSubs(existing.players.filter((p) => p.role === 'SUBSTITUTE').map((p) => p.userId));
        const imp = existing.players.filter((p) => p.role === 'IMPACT_CANDIDATE');
        setImpact(imp.map((p) => p.userId));
        setActiveImpact(imp.find((p) => p.isActiveImpact)?.userId ?? null);
        setIsFinalized(existing.isFinalized);
      } else {
        setIsFinalized(false);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load players.');
    } finally {
      setLoading(false);
    }
  }, [matchId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  function roleOf(userId: string): Bucket | null {
    if (xi.includes(userId)) return 'XI';
    if (subs.includes(userId)) return 'SUB';
    if (impact.includes(userId)) return 'IMP';
    return null;
  }

  function toggle(c: SquadCandidate): void {
    setError(null);
    const current = roleOf(c.userId);
    // Tapping a player already in the active bucket removes them.
    if (current === bucket) {
      if (bucket === 'XI') setXi((v) => v.filter((id) => id !== c.userId));
      if (bucket === 'SUB') setSubs((v) => v.filter((id) => id !== c.userId));
      if (bucket === 'IMP') {
        setImpact((v) => v.filter((id) => id !== c.userId));
        setActiveImpact((a) => (a === c.userId ? null : a));
      }
      return;
    }
    // §9.7: suspended players cannot be substitutes.
    if (bucket === 'SUB' && c.isSuspended) {
      setError('Suspended players cannot be named as substitutes.');
      return;
    }
    if (bucket === 'XI' && xi.length >= PLAYING_XI_SIZE) {
      setError(`Playing 11 is full (${PLAYING_XI_SIZE}).`);
      return;
    }
    if (bucket === 'SUB' && subs.length >= MAX_SUBSTITUTES) {
      setError(`Only ${MAX_SUBSTITUTES} substitutes allowed.`);
      return;
    }
    if (bucket === 'IMP' && impact.length >= MAX_IMPACT_CANDIDATES) {
      setError(`Only ${MAX_IMPACT_CANDIDATES} impact candidates allowed.`);
      return;
    }
    // Remove from any other bucket first (a player holds one role).
    setXi((v) => v.filter((id) => id !== c.userId));
    setSubs((v) => v.filter((id) => id !== c.userId));
    setImpact((v) => v.filter((id) => id !== c.userId));
    if (bucket === 'XI') setXi((v) => [...v, c.userId]);
    if (bucket === 'SUB') setSubs((v) => [...v, c.userId]);
    if (bucket === 'IMP') setImpact((v) => [...v, c.userId]);
  }

  async function submit(): Promise<void> {
    if (!matchId || !teamId) return;
    if (xi.length !== PLAYING_XI_SIZE) {
      setError(`Select exactly ${PLAYING_XI_SIZE} players for the Playing 11.`);
      return;
    }
    setSaving(true);
    try {
      await lockPlayingXi(matchId, {
        teamId,
        playingXi: xi,
        substitutes: subs,
        impactCandidates: impactEnabled ? impact : undefined,
        activeImpactUserId: impactEnabled ? activeImpact : undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not lock the Playing 11.');
    } finally {
      setSaving(false);
    }
  }

  const buckets: { key: Bucket; label: string; count: number; max: number }[] = [
    { key: 'XI', label: 'Playing 11', count: xi.length, max: PLAYING_XI_SIZE },
    { key: 'SUB', label: 'Substitutes', count: subs.length, max: MAX_SUBSTITUTES },
    ...(impactEnabled
      ? [{ key: 'IMP' as Bucket, label: 'Impact', count: impact.length, max: MAX_IMPACT_CANDIDATES }]
      : []),
  ];

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader
        title={teamName ?? 'Team'}
        subtitle={isFinalized ? 'Edit Playing 11' : 'Playing 11'}
        onBack={() => router.back()}
      />
      <View className="px-6 pt-2">
        {isFinalized ? (
          <Text className="font-sans text-sm text-primary">
            Finalized — you can still edit before the match goes live.
          </Text>
        ) : null}
        <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
          Selecting Team
        </Text>

        {/* Bucket selector with live counts */}
        <View className="mt-4 flex-row flex-wrap gap-2">
          {buckets.map((b) => {
            const active = bucket === b.key;
            return (
              <Button
                key={b.key}
                onPress={() => setBucket(b.key)}
                variant={active ? 'primary' : 'outline'}
                className={`px-4 py-2 ${active ? 'border-primary' : 'bg-surface-container-lowest'}`}
                textClassName={`font-sans text-sm ${active ? 'text-on-primary' : 'text-on-surface'}`}
                label={`${b.label} ${b.count}/${b.max}`}
              />
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerClassName="px-6 py-4 gap-3">
        {error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : null}

        {candidates.length === 0 ? (
          <Text className="py-16 text-center font-sans text-base text-on-surface-variant">
            No players are assigned to this team yet.
          </Text>
        ) : (
          candidates.map((c) => {
            const role = roleOf(c.userId);
            return (
              <Card
                key={c.userId}
                onPress={() => toggle(c)}
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-control border border-outline-variant"
              >
                <PlayerAvatar
                  firstName={c.firstName}
                  profilePhotoUrl={null}
                  size="sm"
                  shape="square"
                />
                <View className="min-w-0 flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-sans-bold text-base text-on-surface">
                      {c.firstName} {c.lastName}
                    </Text>
                    {c.isSuspended ? (
                      <View className="rounded-full bg-secondary-100 px-2 py-0.5">
                        <Text className="font-sans-medium text-[9px] uppercase tracking-wider text-secondary-900">
                          Suspended
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="font-sans text-sm text-on-surface-variant">
                    {playerTypeLabel(c) ?? ''}
                  </Text>
                </View>

                {/* Active-impact star toggle (only for impact candidates). */}
                {role === 'IMP' ? (
                  <Pressable
                    onPress={() => setActiveImpact((a) => (a === c.userId ? null : c.userId))}
                    hitSlop={8}
                    className="px-1"
                  >
                    <Text className="text-lg text-primary">
                      {activeImpact === c.userId ? '★' : '☆'}
                    </Text>
                  </Pressable>
                ) : null}

                <View
                  className={`h-6 w-6 items-center justify-center rounded-full border ${
                    role
                      ? 'border-primary bg-primary'
                      : 'border-outline-variant bg-surface-container-lowest'
                  }`}
                >
                  {role ? (
                    <Text className="font-sans-medium text-[9px] text-on-primary">
                      {role === 'XI' ? '11' : role === 'SUB' ? 'S' : 'I'}
                    </Text>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <View className="border-t border-outline-variant px-6 py-4">
        <Button
          disabled={saving || xi.length !== PLAYING_XI_SIZE}
          onPress={() => void submit()}
          variant="secondary"
          className="h-12"
          textClassName="text-base"
          label={saving ? 'Confirming…' : `Confirm Playing 11 (${xi.length}/${PLAYING_XI_SIZE})`}
        />
      </View>
    </SafeAreaView>
  );
}
