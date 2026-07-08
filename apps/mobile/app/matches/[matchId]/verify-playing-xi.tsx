import {
  MAX_IMPACT_CANDIDATES,
  MAX_SUBSTITUTES,
  PLAYING_XI_SIZE,
  REGISTRATION_PLAYER_TYPE_LABELS,
  type SquadCandidate,
  type SquadView,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayerAvatar } from '../../../src/components/tournament/PlayerAvatar';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import {
  ApiRequestError,
  finalizeBothPlayingXi,
  getMatch,
  getSquadCandidates,
  lockPlayingXi,
} from '../../../src/lib/api';

type Bucket = 'XI' | 'SUB' | 'IMP';

/** Shared tab chrome for team + bucket rows on Verify Playing 11 (single style source). */
function PlayingXiTabButton({
  active,
  label,
  onPress,
  className,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  className?: string;
}): React.ReactElement {
  return (
    <Button
      onPress={onPress}
      variant={active ? 'primary' : 'outline'}
      className={`px-4 py-2 ${active ? 'border-primary' : 'bg-surface-container-lowest'} ${className ?? ''}`}
      textClassName={`font-sans text-sm ${active ? 'text-on-primary' : 'text-on-surface'}`}
      label={label}
    />
  );
}

interface TeamDraft {
  xi: string[];
  subs: string[];
  impact: string[];
  activeImpact: string | null;
}

function emptyDraft(): TeamDraft {
  return { xi: [], subs: [], impact: [], activeImpact: null };
}

function draftFromSquad(squad: SquadView | undefined): TeamDraft {
  if (!squad) {
    return emptyDraft();
  }
  const impactPlayers = squad.players.filter((player) => player.role === 'IMPACT_CANDIDATE');
  return {
    xi: squad.players.filter((player) => player.role === 'PLAYING_XI').map((player) => player.userId),
    subs: squad.players
      .filter((player) => player.role === 'SUBSTITUTE')
      .map((player) => player.userId),
    impact: impactPlayers.map((player) => player.userId),
    activeImpact: impactPlayers.find((player) => player.isActiveImpact)?.userId ?? null,
  };
}

function playerTypeLabel(candidate: SquadCandidate): string | null {
  return candidate.playerType ? REGISTRATION_PLAYER_TYPE_LABELS[candidate.playerType] : null;
}

interface TeamPickerProps {
  teamName: string;
  /** False when team tabs above already identify the active team (both-teams flow). */
  showTeamHeading?: boolean;
  candidates: SquadCandidate[];
  draft: TeamDraft;
  onDraftChange: (draft: TeamDraft) => void;
  impactEnabled: boolean;
  finalized: boolean;
}

function TeamPicker({
  teamName,
  showTeamHeading = true,
  candidates,
  draft,
  onDraftChange,
  impactEnabled,
  finalized,
}: TeamPickerProps): React.ReactElement {
  const [bucket, setBucket] = useState<Bucket>('XI');
  const [error, setError] = useState<string | null>(null);

  function roleOf(userId: string): Bucket | null {
    if (draft.xi.includes(userId)) return 'XI';
    if (draft.subs.includes(userId)) return 'SUB';
    if (draft.impact.includes(userId)) return 'IMP';
    return null;
  }

  function toggle(candidate: SquadCandidate): void {
    setError(null);
    const current = roleOf(candidate.userId);
    if (current === bucket) {
      if (bucket === 'XI') {
        onDraftChange({ ...draft, xi: draft.xi.filter((id) => id !== candidate.userId) });
      }
      if (bucket === 'SUB') {
        onDraftChange({ ...draft, subs: draft.subs.filter((id) => id !== candidate.userId) });
      }
      if (bucket === 'IMP') {
        onDraftChange({
          ...draft,
          impact: draft.impact.filter((id) => id !== candidate.userId),
          activeImpact: draft.activeImpact === candidate.userId ? null : draft.activeImpact,
        });
      }
      return;
    }
    if (bucket === 'SUB' && candidate.isSuspended) {
      setError('Suspended players cannot be named as substitutes.');
      return;
    }
    if (bucket === 'XI' && draft.xi.length >= PLAYING_XI_SIZE) {
      setError(`Playing 11 is full (${PLAYING_XI_SIZE}).`);
      return;
    }
    if (bucket === 'SUB' && draft.subs.length >= MAX_SUBSTITUTES) {
      setError(`Only ${MAX_SUBSTITUTES} substitutes allowed.`);
      return;
    }
    if (bucket === 'IMP' && draft.impact.length >= MAX_IMPACT_CANDIDATES) {
      setError(`Only ${MAX_IMPACT_CANDIDATES} impact candidates allowed.`);
      return;
    }

    const next: TeamDraft = {
      xi: draft.xi.filter((id) => id !== candidate.userId),
      subs: draft.subs.filter((id) => id !== candidate.userId),
      impact: draft.impact.filter((id) => id !== candidate.userId),
      activeImpact: draft.activeImpact === candidate.userId ? null : draft.activeImpact,
    };
    if (bucket === 'XI') next.xi = [...next.xi, candidate.userId];
    if (bucket === 'SUB') next.subs = [...next.subs, candidate.userId];
    if (bucket === 'IMP') next.impact = [...next.impact, candidate.userId];
    onDraftChange(next);
  }

  const buckets: { key: Bucket; label: string; count: number; max: number }[] = [
    { key: 'XI', label: 'Playing 11', count: draft.xi.length, max: PLAYING_XI_SIZE },
    { key: 'SUB', label: 'Substitutes', count: draft.subs.length, max: MAX_SUBSTITUTES },
    ...(impactEnabled
      ? [{ key: 'IMP' as Bucket, label: 'Impact', count: draft.impact.length, max: MAX_IMPACT_CANDIDATES }]
      : []),
  ];

  return (
    <View className="flex-1">
      <View className="px-6 pt-2">
        {showTeamHeading ? (
          <Text className="font-sans-medium text-xs uppercase tracking-wider text-on-surface-variant">
            {teamName}
          </Text>
        ) : null}
        {finalized ? (
          <Text
            className={`font-sans text-sm text-primary${showTeamHeading ? ' mt-1' : ''}`}
          >
            Finalized — edits require re-confirm
          </Text>
        ) : null}
        <View
          className={`flex-row flex-wrap gap-2${showTeamHeading || finalized ? ' mt-4' : ' mt-0'}`}
        >
          {buckets.map((item) => {
            const active = bucket === item.key;
            return (
              <PlayingXiTabButton
                key={item.key}
                active={active}
                onPress={() => setBucket(item.key)}
                label={`${item.label} ${item.count}/${item.max}`}
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
          candidates.map((candidate) => {
            const role = roleOf(candidate.userId);
            const typeLabel = playerTypeLabel(candidate);
            return (
              <Card
                key={candidate.userId}
                onPress={() => toggle(candidate)}
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-control border border-outline-variant"
              >
                <PlayerAvatar
                  firstName={candidate.firstName}
                  profilePhotoUrl={null}
                  size="sm"
                  shape="square"
                />
                <View className="min-w-0 flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-sans-bold text-base text-on-surface">
                      {candidate.firstName} {candidate.lastName}
                    </Text>
                    {candidate.isSuspended ? (
                      <View className="rounded-full bg-secondary-100 px-2 py-0.5">
                        <Text className="font-sans-medium text-[9px] uppercase tracking-wider text-secondary-900">
                          Suspended
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {typeLabel ? (
                    <Text className="font-sans text-sm text-on-surface-variant">{typeLabel}</Text>
                  ) : null}
                </View>

                {role === 'IMP' ? (
                  <Pressable
                    onPress={() =>
                      onDraftChange({
                        ...draft,
                        activeImpact:
                          draft.activeImpact === candidate.userId ? null : candidate.userId,
                      })
                    }
                    hitSlop={8}
                    className="px-1"
                  >
                    <Text className="text-lg text-primary">
                      {draft.activeImpact === candidate.userId ? '★' : '☆'}
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
    </View>
  );
}

export default function VerifyPlayingXiScreen(): React.ReactElement {
  const { matchId, teamId, teamName } = useLocalSearchParams<{
    matchId: string;
    teamId?: string;
    teamName?: string;
  }>();
  const router = useRouter();
  const singleTeamMode = Boolean(teamId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impactEnabled, setImpactEnabled] = useState(false);

  const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<string | null>(null);
  const [homeTeamName, setHomeTeamName] = useState('Home');
  const [awayTeamName, setAwayTeamName] = useState('Away');
  const [homeFinalized, setHomeFinalized] = useState(false);
  const [awayFinalized, setAwayFinalized] = useState(false);

  const [activeTab, setActiveTab] = useState<'home' | 'away'>('home');
  const [homeCandidates, setHomeCandidates] = useState<SquadCandidate[]>([]);
  const [awayCandidates, setAwayCandidates] = useState<SquadCandidate[]>([]);
  const [homeDraft, setHomeDraft] = useState<TeamDraft>(emptyDraft());
  const [awayDraft, setAwayDraft] = useState<TeamDraft>(emptyDraft());
  const [singleCandidates, setSingleCandidates] = useState<SquadCandidate[]>([]);
  const [singleDraft, setSingleDraft] = useState<TeamDraft>(emptyDraft());
  const [singleFinalized, setSingleFinalized] = useState(false);

  const load = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    try {
      const match = await getMatch(matchId);
      setImpactEnabled(match.impactPlayerEnabled);

      if (singleTeamMode && teamId) {
        const [candidates] = await Promise.all([getSquadCandidates(matchId, teamId)]);
        setSingleCandidates(candidates);
        const squad = match.squads.find((row) => row.teamId === teamId);
        setSingleDraft(draftFromSquad(squad));
        setSingleFinalized(Boolean(squad?.isFinalized));
        setError(null);
        return;
      }

      const homeId = match.homeTeamId;
      const awayId = match.awayTeamId;
      if (!homeId || !awayId) {
        setError('Both teams must be set before verifying Playing 11.');
        return;
      }

      setHomeTeamId(homeId);
      setAwayTeamId(awayId);
      setHomeTeamName(match.homeTeamName ?? 'Home');
      setAwayTeamName(match.awayTeamName ?? match.externalOpponentName ?? 'Away');

      const homeSquad = match.squads.find((row) => row.teamId === homeId);
      const awaySquad = match.squads.find((row) => row.teamId === awayId);
      setHomeFinalized(Boolean(homeSquad?.isFinalized));
      setAwayFinalized(Boolean(awaySquad?.isFinalized));
      setHomeDraft(draftFromSquad(homeSquad));
      setAwayDraft(draftFromSquad(awaySquad));

      const [homeList, awayList] = await Promise.all([
        getSquadCandidates(matchId, homeId),
        getSquadCandidates(matchId, awayId),
      ]);
      setHomeCandidates(homeList);
      setAwayCandidates(awayList);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load match.');
    } finally {
      setLoading(false);
    }
  }, [matchId, singleTeamMode, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDisabled = useMemo(() => {
    if (saving) {
      return true;
    }
    if (singleTeamMode) {
      return singleDraft.xi.length !== PLAYING_XI_SIZE;
    }
    return false;
  }, [saving, singleDraft.xi.length, singleTeamMode]);

  function showIncompleteAlert(missingTeamName: string): void {
    Alert.alert('Incomplete Playing 11', `Please select ${missingTeamName}'s Playing 11`, [
      { text: 'OK' },
    ]);
  }

  async function confirm(): Promise<void> {
    if (!matchId) return;

    if (singleTeamMode && teamId) {
      if (singleDraft.xi.length !== PLAYING_XI_SIZE) {
        setError(`Select exactly ${PLAYING_XI_SIZE} players for the Playing 11.`);
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await lockPlayingXi(matchId, {
          teamId,
          playingXi: singleDraft.xi,
          substitutes: singleDraft.subs,
          impactCandidates: impactEnabled ? singleDraft.impact : undefined,
          activeImpactUserId: impactEnabled ? singleDraft.activeImpact : undefined,
        });
        router.back();
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : 'Could not confirm the Playing 11.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!homeTeamId || !awayTeamId) return;

    const homeValid = homeDraft.xi.length === PLAYING_XI_SIZE;
    const awayValid = awayDraft.xi.length === PLAYING_XI_SIZE;
    if (!homeValid || !awayValid) {
      if (homeValid && !awayValid) {
        showIncompleteAlert(awayTeamName);
        setActiveTab('away');
        return;
      }
      if (!homeValid && awayValid) {
        showIncompleteAlert(homeTeamName);
        setActiveTab('home');
        return;
      }
      setError(`Select exactly ${PLAYING_XI_SIZE} players for each team's Playing 11.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await finalizeBothPlayingXi(matchId, {
        teams: [
          {
            teamId: homeTeamId,
            playingXi: homeDraft.xi,
            substitutes: homeDraft.subs,
            impactCandidates: impactEnabled ? homeDraft.impact : undefined,
            activeImpactUserId: impactEnabled ? homeDraft.activeImpact : undefined,
          },
          {
            teamId: awayTeamId,
            playingXi: awayDraft.xi,
            substitutes: awayDraft.subs,
            impactCandidates: impactEnabled ? awayDraft.impact : undefined,
            activeImpactUserId: impactEnabled ? awayDraft.activeImpact : undefined,
          },
        ],
      });
      router.back();
    } catch (err) {
      if (err instanceof ApiRequestError && err.message.includes('Please select')) {
        Alert.alert('Incomplete Playing 11', err.message, [{ text: 'OK' }]);
      } else {
        setError(err instanceof ApiRequestError ? err.message : 'Could not confirm the Playing 11.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  const headerTitle = singleTeamMode
    ? (teamName ?? 'Team')
    : 'Verify Playing 11';
  const headerSubtitle = singleTeamMode ? 'Playing 11' : 'Both teams';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title={headerTitle} subtitle={headerSubtitle} onBack={() => router.back()} />

      {!singleTeamMode ? (
        <View className="flex-row gap-2 px-6 pt-2">
          <PlayingXiTabButton
            active={activeTab === 'home'}
            onPress={() => setActiveTab('home')}
            className="min-w-0 flex-1"
            label={`${homeTeamName}${homeFinalized ? ' ✓' : ''}`}
          />
          <PlayingXiTabButton
            active={activeTab === 'away'}
            onPress={() => setActiveTab('away')}
            className="min-w-0 flex-1"
            label={`${awayTeamName}${awayFinalized ? ' ✓' : ''}`}
          />
        </View>
      ) : null}

      {error ? (
        <View className="mx-6 mt-2 rounded-lg bg-primary-50 px-4 py-3">
          <Text className="font-sans text-sm text-primary">{error}</Text>
        </View>
      ) : null}

      <View className="flex-1">
        {singleTeamMode ? (
          <TeamPicker
            teamName={teamName ?? 'Team'}
            candidates={singleCandidates}
            draft={singleDraft}
            onDraftChange={setSingleDraft}
            impactEnabled={impactEnabled}
            finalized={singleFinalized}
          />
        ) : activeTab === 'home' ? (
          <TeamPicker
            teamName={homeTeamName}
            showTeamHeading={false}
            candidates={homeCandidates}
            draft={homeDraft}
            onDraftChange={setHomeDraft}
            impactEnabled={impactEnabled}
            finalized={homeFinalized}
          />
        ) : (
          <TeamPicker
            teamName={awayTeamName}
            showTeamHeading={false}
            candidates={awayCandidates}
            draft={awayDraft}
            onDraftChange={setAwayDraft}
            impactEnabled={impactEnabled}
            finalized={awayFinalized}
          />
        )}
      </View>

      <View className="border-t border-outline-variant px-6 py-4">
        <Button
          disabled={confirmDisabled}
          onPress={() => void confirm()}
          variant="secondary"
          className="h-12"
          textClassName="text-base"
          label={saving ? 'Confirming…' : 'Confirm Playing 11'}
        />
      </View>
    </SafeAreaView>
  );
}
