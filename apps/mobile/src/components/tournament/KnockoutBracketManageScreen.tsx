import {
  buildKnockoutSeedingPreviewHint,
  buildTeamIdsFromManualPlacements,
  canManageKnockoutBracket,
  formatSignedNetRunRate,
  KNOCKOUT_BRACKET_MESSAGES,
  KnockoutBracketSlotKind,
  KnockoutManualSeedOrderError,
  MatchSchedulingFormat,
  QualificationReadinessStatus,
  QualificationType,
  type KnockoutBracketMatchSlot,
  type KnockoutBracketMatchSummary,
  type KnockoutBracketView,
  type KnockoutQualificationResponse,
  type QualifiedTeam,
  type TournamentDetail,
} from '@acc/types';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiRequestError,
  generateKnockoutBracket,
  getKnockoutBracket,
  getKnockoutQualification,
} from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { confirmActionAlert } from '../../lib/confirm-action-alert';
import { Button } from '../ui/Button';
import { KeyboardAwareFormScrollView } from '../ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../ui/ScreenHeader';
import { SegmentedControl } from '../ui/SegmentedControl';
import { TeamAvatar } from '../ui/TeamAvatar';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { KnockoutManualBracketFill } from './KnockoutManualBracketFill';
import { MatchCardDisplayBadge } from './MatchCardDisplayBadge';
import {
  KnockoutAwaitingConfirmationNotice,
  KnockoutFeederAwaitingConfirmationHint,
} from './KnockoutBracketConfirmationHints';

export interface KnockoutBracketManageScreenProps {
  tournamentId: string;
  tournamentName: string;
}

const SECONDARY_NAVY = '#294C74';

type SeedingMode = 'automatic' | 'manual';

const SEEDING_MODE_OPTIONS = [
  { value: 'automatic' as const, label: 'Automatic' },
  { value: 'manual' as const, label: 'Manual seeding' },
];

function qualificationTypeLabel(type: QualifiedTeam['qualificationType']): string {
  return type === QualificationType.GroupTopper ? 'Group topper' : 'Wildcard';
}

function QualificationReadinessPanel({
  qualification,
}: {
  qualification: KnockoutQualificationResponse;
}): React.ReactElement {
  if (qualification.status === QualificationReadinessStatus.NotApplicable) {
    return (
      <Text className="font-sans text-base text-on-surface-variant">
        Knockout brackets apply to APL tournaments with a group stage.
      </Text>
    );
  }

  if (qualification.status === QualificationReadinessStatus.NotConfigured) {
    return (
      <Text className="font-sans text-base text-on-surface-variant">
        Set the knockout team count on the tournament before generating a bracket.
      </Text>
    );
  }

  if (qualification.status === QualificationReadinessStatus.NotReady) {
    return (
      <View className="gap-2">
        <Text className="font-sans text-base text-on-surface">
          Group-stage matches are not complete yet.
        </Text>
        <Text className="font-sans text-sm text-on-surface-variant">
          {qualification.incompleteGroupMatchCount} incomplete ·{' '}
          {qualification.scheduledGroupMatchCount} scheduled
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-1">
      <Text className="font-sans text-base text-on-surface">
        {qualification.knockoutTeamCount} teams qualify from {qualification.groupCount} groups.
      </Text>
      {qualification.ties.length > 0 ? (
        <Text className="font-sans text-sm text-amber-700">
          {qualification.ties.length} tie
          {qualification.ties.length === 1 ? '' : 's'} resolved by standings rules.
        </Text>
      ) : null}
    </View>
  );
}

function QualifiedTeamRow({
  team,
  seed,
}: {
  team: QualifiedTeam;
  seed: number;
}): React.ReactElement {
  return (
    <View className="flex-row items-center gap-2 py-2">
      <Text className="w-6 text-center font-sans-semibold text-sm text-on-surface-variant">
        {seed}
      </Text>
      <TeamAvatar name={team.teamName} logoUrl={null} size="sm" />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans-semibold text-base text-on-surface" numberOfLines={1}>
          {team.teamName}
        </Text>
        <Text className="font-sans text-sm text-on-surface-variant">
          {qualificationTypeLabel(team.qualificationType)} · {team.points} pts · NRR{' '}
          {formatSignedNetRunRate(team.netRunRate)}
        </Text>
      </View>
    </View>
  );
}

function SeedingPreviewHintPanel({
  orderedTeams,
}: {
  orderedTeams: QualifiedTeam[];
}): React.ReactElement {
  const hint = useMemo(
    () => buildKnockoutSeedingPreviewHint(orderedTeams),
    [orderedTeams],
  );

  return (
    <View className="gap-1 rounded-control bg-surface-container-low px-3 py-2">
      <Text className="font-sans-semibold text-sm text-on-surface">{hint.byeSummary}</Text>
      <Text className="font-sans text-sm text-on-surface-variant">
        {hint.playInMatchCount}{' '}
        {hint.playInMatchCount === 1 ? 'first-round match' : 'first-round matches'} in this bracket.
      </Text>
      {hint.sameGroupRound1Warnings.map((warning) => (
        <Text key={warning} className="font-sans text-sm text-amber-700">
          {warning}
        </Text>
      ))}
    </View>
  );
}

function BracketSlotLine({ slot }: { slot: KnockoutBracketMatchSlot }): React.ReactElement {
  if (slot.kind === KnockoutBracketSlotKind.WinnerOf) {
    return (
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans text-sm italic text-on-surface-variant" numberOfLines={2}>
          {slot.feederLabel ?? 'Winner TBD'}
        </Text>
        {slot.feederAwaitingConfirmation ? <KnockoutFeederAwaitingConfirmationHint /> : null}
      </View>
    );
  }

  if (slot.kind === KnockoutBracketSlotKind.Tbd) {
    return (
      <Text className="flex-1 font-sans text-sm text-on-surface-variant">TBD</Text>
    );
  }

  return (
    <View className="min-w-0 flex-1 flex-row items-center gap-2">
      <TeamAvatar
        name={slot.teamName ?? 'Team'}
        logoUrl={slot.logoUrl}
        size="sm"
      />
      <Text className="min-w-0 flex-1 font-sans-semibold text-sm text-on-surface" numberOfLines={2}>
        {slot.teamName ?? 'Team'}
      </Text>
      {slot.kind === KnockoutBracketSlotKind.Bye ? (
        <View className="rounded-full bg-surface-container-high px-2 py-0.5">
          <Text className="font-sans-semibold text-[10px] text-on-surface-variant">BYE</Text>
        </View>
      ) : null}
    </View>
  );
}

function KnockoutMatchCard({
  match,
  onPress,
}: {
  match: KnockoutBracketMatchSummary;
  onPress: () => void;
}): React.ReactElement {
  const tappable = !match.awaitingTeams;

  const content = (
    <View
      className="gap-4 rounded-control border border-outline-variant bg-surface p-4"
      style={INPUT_SHADOW_STYLE}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-sans-semibold text-sm text-on-surface-variant">
          Match {(match.bracketPosition ?? 0) + 1}
        </Text>
        <MatchCardDisplayBadge state={match.state} variant="tournamentPrimary" />
      </View>

      <View className="gap-3">
        <BracketSlotLine slot={match.homeSlot} />
        <View className="h-px bg-outline-variant" />
        <BracketSlotLine slot={match.awaySlot} />
      </View>

      {match.requiresResolution ? (
        <Text className="font-sans text-sm text-amber-700">
          {KNOCKOUT_BRACKET_MESSAGES.requiresResolution}
        </Text>
      ) : match.awaitingScorecardConfirmation ? (
        <KnockoutAwaitingConfirmationNotice />
      ) : match.awaitingTeams ? (
        <Text className="font-sans text-sm text-on-surface-variant">Awaiting teams</Text>
      ) : null}
    </View>
  );

  if (!tappable) {
    return content;
  }

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  );
}

function BracketRoundSection({
  roundLabel,
  matches,
  onMatchPress,
}: {
  roundLabel: string;
  matches: KnockoutBracketMatchSummary[];
  onMatchPress: (matchId: string) => void;
}): React.ReactElement {
  return (
    <View className="gap-3">
      <Text className="font-sans-bold text-lg text-on-surface">{roundLabel}</Text>
      {matches.map((match) => (
        <KnockoutMatchCard
          key={match.id}
          match={match}
          onPress={() => onMatchPress(match.id)}
        />
      ))}
    </View>
  );
}

export function KnockoutBracketManageScreen({
  tournamentId,
  tournamentName,
}: KnockoutBracketManageScreenProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const canManage = canManageKnockoutBracket(user);

  const [bracket, setBracket] = useState<KnockoutBracketView | null>(null);
  const [qualification, setQualification] = useState<KnockoutQualificationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [seedingMode, setSeedingMode] = useState<SeedingMode>('automatic');
  const [placementsBySeed, setPlacementsBySeed] = useState<Map<number, string>>(new Map());

  const readyQualification =
    qualification?.status === QualificationReadinessStatus.Ready ? qualification : null;

  useEffect(() => {
    setPlacementsBySeed(new Map());
  }, [readyQualification]);

  function handleSeedingModeChange(mode: SeedingMode): void {
    setSeedingMode(mode);
    if (mode === 'automatic') {
      setPlacementsBySeed(new Map());
    }
  }

  function handlePlaceTeam(seed: number, teamId: string): void {
    setPlacementsBySeed((current) => {
      const next = new Map(current);
      for (const [existingSeed, existingTeamId] of next.entries()) {
        if (existingTeamId === teamId && existingSeed !== seed) {
          next.delete(existingSeed);
        }
      }
      next.set(seed, teamId);
      return next;
    });
  }

  function handleClearSeed(seed: number): void {
    setPlacementsBySeed((current) => {
      if (!current.has(seed)) {
        return current;
      }
      const next = new Map(current);
      next.delete(seed);
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [qualResult, bracketResult] = await Promise.allSettled([
        getKnockoutQualification(tournamentId),
        getKnockoutBracket(tournamentId),
      ]);

      if (qualResult.status === 'rejected') {
        throw qualResult.reason;
      }
      setQualification(qualResult.value);

      if (bracketResult.status === 'fulfilled') {
        setBracket(bracketResult.value);
      } else if (
        bracketResult.reason instanceof ApiRequestError &&
        bracketResult.reason.status === 404
      ) {
        setBracket(null);
      } else if (bracketResult.status === 'rejected') {
        throw bracketResult.reason;
      }
    } catch (err) {
      setBracket(null);
      setQualification(null);
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Could not load knockout bracket details.',
      );
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const rounds = useMemo(() => {
    if (!bracket) {
      return [];
    }
    const grouped = new Map<number, { label: string; matches: KnockoutBracketMatchSummary[] }>();
    for (const match of bracket.matches) {
      const roundIndex = match.bracketRoundIndex ?? 0;
      const label = match.bracketRoundLabel ?? `Round ${roundIndex + 1}`;
      const entry = grouped.get(roundIndex) ?? { label, matches: [] };
      entry.matches.push(match);
      grouped.set(roundIndex, entry);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, value]) => ({
        ...value,
        matches: [...value.matches].sort(
          (a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0),
        ),
      }));
  }, [bracket]);

  function handleGeneratePress(): void {
    if (
      qualification?.status !== QualificationReadinessStatus.Ready ||
      generating
    ) {
      return;
    }

    let manualTeamIds: string[] | undefined;
    if (seedingMode === 'manual') {
      try {
        manualTeamIds = buildTeamIdsFromManualPlacements(
          qualification.qualifiedTeams,
          placementsBySeed,
        );
      } catch (err) {
        Alert.alert(
          'Bracket not ready',
          err instanceof KnockoutManualSeedOrderError
            ? err.message
            : 'Fill every bracket slot before generating.',
        );
        return;
      }
    }

    confirmActionAlert({
      title: KNOCKOUT_BRACKET_MESSAGES.generateConfirmTitle,
      message: KNOCKOUT_BRACKET_MESSAGES.generateConfirmMessage(
        qualification.knockoutTeamCount,
        qualification.knockoutTeamCount - 1,
      ),
      confirmLabel: 'Generate',
      onConfirm: async () => {
        setGenerating(true);
        try {
          const created = await generateKnockoutBracket(
            tournamentId,
            manualTeamIds ? { teamIds: manualTeamIds } : undefined,
          );
          setBracket(created);
        } catch (err) {
          Alert.alert(
            'Could not generate bracket',
            err instanceof ApiRequestError ? err.message : 'Please try again.',
          );
        } finally {
          setGenerating(false);
        }
      },
    });
  }

  function handleMatchPress(matchId: string): void {
    router.push(`/matches/${matchId}`);
  }

  function handleOpenChart(): void {
    router.push(
      `/tournaments/${tournamentId}/knockout-chart?name=${encodeURIComponent(tournamentName)}`,
    );
  }

  const isManualMode = seedingMode === 'manual' && canManage;
  const automaticTeams = readyQualification?.qualifiedTeams ?? [];
  const manualComplete = readyQualification
    ? placementsBySeed.size === readyQualification.knockoutTeamCount
    : false;
  const canGenerate = !!readyQualification && (!isManualMode || manualComplete);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScreenHeader title="Knockout Bracket" subtitle={tournamentName} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-on-surface-variant">{error}</Text>
        </View>
      ) : bracket ? (
        <KeyboardAwareFormScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-6 pt-4"
        >
          <View className="gap-6">
            <Button
              variant="outline"
              onPress={handleOpenChart}
              className="h-12 w-full flex-row items-center justify-center gap-2"
            >
              <MaterialIcons name="account-tree" size={18} color={SECONDARY_NAVY} />
              <Text className="font-sans-semibold text-sm text-secondary">Knockout Chart</Text>
            </Button>

            <View className="rounded-control bg-white p-4 shadow-sm">
              <Text className="font-sans text-base text-on-surface">
                {bracket.knockoutTeamCount} teams · {bracket.matches.length} matches
              </Text>
              {bracket.byeCount > 0 ? (
                <Text className="mt-1 font-sans text-sm text-on-surface-variant">
                  {bracket.byeCount} byes
                </Text>
              ) : null}
            </View>

            {rounds.map((round) => (
              <BracketRoundSection
                key={round.label}
                roundLabel={round.label}
                matches={round.matches}
                onMatchPress={handleMatchPress}
              />
            ))}
          </View>
        </KeyboardAwareFormScrollView>
      ) : qualification ? (
        <KeyboardAwareFormScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-6 pt-4"
          extraBottomPadding={32}
          footer={
            canManage && readyQualification ? (
              <SafeAreaView
                edges={['bottom']}
                className="border-t border-outline-variant/20 bg-background px-4 pt-3"
              >
                <Button
                  label={generating ? 'Generating…' : 'Confirm & Generate'}
                  onPress={handleGeneratePress}
                  disabled={generating || !canGenerate}
                  className="h-14 w-full"
                />
              </SafeAreaView>
            ) : undefined
          }
        >
          <View className="gap-4">
            {canManage && readyQualification ? (
              <SegmentedControl
                options={SEEDING_MODE_OPTIONS}
                value={seedingMode}
                onChange={handleSeedingModeChange}
                accessibilityLabel="Knockout seeding mode"
                size="md"
              />
            ) : null}

            <View className="rounded-control bg-white p-4 shadow-sm">
              <QualificationReadinessPanel qualification={qualification} />
            </View>

            {readyQualification ? (
              isManualMode ? (
                <KnockoutManualBracketFill
                  qualifiedTeams={readyQualification.qualifiedTeams}
                  placementsBySeed={placementsBySeed}
                  onPlace={handlePlaceTeam}
                  onClear={handleClearSeed}
                />
              ) : (
                <View className="gap-3 rounded-control bg-white p-4 shadow-sm">
                  <Text className="font-sans-bold text-base text-on-surface">
                    Qualified teams
                  </Text>
                  {canManage ? (
                    <SeedingPreviewHintPanel orderedTeams={automaticTeams} />
                  ) : null}
                  {automaticTeams.map((team, index) => (
                    <QualifiedTeamRow key={team.teamId} team={team} seed={index + 1} />
                  ))}
                </View>
              )
            ) : null}
          </View>
        </KeyboardAwareFormScrollView>
      ) : null}
    </SafeAreaView>
  );
}

/** Gating helper for Matches tab entry button (Admin / Club Manager, APL group+knockout). */
export function shouldShowKnockoutBracketEntry(
  tournament: Pick<TournamentDetail, 'matchSchedulingFormat'>,
  user: ReturnType<typeof useAuth>['user'],
): boolean {
  return (
    canManageKnockoutBracket(user) &&
    tournament.matchSchedulingFormat === MatchSchedulingFormat.GroupStageKnockout
  );
}

/** @deprecated Use shouldShowKnockoutBracketEntry */
export function shouldShowKnockoutBracketManage(
  tournament: Pick<TournamentDetail, 'hasKnockoutBracket' | 'matchSchedulingFormat'>,
  user: ReturnType<typeof useAuth>['user'],
): boolean {
  return shouldShowKnockoutBracketEntry(tournament, user);
}
