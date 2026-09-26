import {
  DISMISSAL_TYPE_LABELS,
  DismissalType,
  InningsCloseReason,
  MatchSide,
  MatchState,
  ScoringMode,
  TossDecision,
  UserRole,
  formatDismissalShort,
  type MatchDetail,
  type ScorecardSummaryBatterInput,
  type ScorecardSummaryBowlerInput,
  type ScorecardSummaryInningsWriteInput,
  type ScorecardSummaryValidationIssue,
  type UpsertScorecardSummaryRequest,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../../../src/components/ui/KeyboardAwareFormScrollView';
import { OverflowMenu, type OverflowMenuAction } from '../../../src/components/ui/OverflowMenu';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Select, type SelectOption } from '../../../src/components/ui/Select';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { InningsTabs } from '../../../src/components/InningsTabs';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import {
  ApiRequestError,
  getMatch,
  upsertScorecardSummary,
} from '../../../src/lib/api';
import { confirmDestructiveDeleteAlert } from '../../../src/lib/confirm-destructive-delete';
import { useAuth } from '../../../src/lib/auth-context';
import { tournamentDetailHref } from '../../../src/lib/tournament-detail-route';
import { TOURNAMENT_DETAIL_TAB } from '../../../src/lib/tournament-detail-tabs';

const EXTERNAL_WINNER = '__EXTERNAL__';

type BatterDraft = ScorecardSummaryBatterInput & { key: string };
type BowlerDraft = ScorecardSummaryBowlerInput & { key: string };

interface InningsDraft {
  sequence: number;
  battingTeamId: string | null;
  bowlingTeamId: string | null;
  battingIsExternal: boolean;
  bowlingIsExternal: boolean;
  label: string;
  runs: string;
  wickets: string;
  oversText: string;
  extrasByes: string;
  extrasLegByes: string;
  extrasWides: string;
  extrasNoBalls: string;
  closeReason: InningsCloseReason;
  batters: BatterDraft[];
  bowlers: BowlerDraft[];
}

function emptyBatter(): BatterDraft {
  return {
    key: `b-${Math.random().toString(36).slice(2, 9)}`,
    playerId: '',
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    isOut: false,
    dismissalType: null,
    bowlerId: null,
    fielderId: null,
  };
}

function emptyBowler(): BowlerDraft {
  return {
    key: `o-${Math.random().toString(36).slice(2, 9)}`,
    playerId: '',
    oversText: '0',
    maidens: 0,
    runsConceded: 0,
    wickets: 0,
  };
}

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isValidOversText(oversText: string): boolean {
  return /^(\d+)(?:\.([0-5]))?$/.test(oversText.trim());
}

/** Fielder is only meaningful for Caught, Run out, and Stumped. */
function dismissalNeedsFielder(type: DismissalType | null | undefined): boolean {
  return (
    type === DismissalType.Caught ||
    type === DismissalType.RunOut ||
    type === DismissalType.Stumped
  );
}

function buildInitialInnings(match: MatchDetail): InningsDraft[] {
  const homeId = match.homeTeamId;
  const homeName = match.homeTeamName ?? 'ACC';
  const awayId = match.awayTeamId;
  const awayName = match.awayTeamName ?? match.externalOpponentName ?? 'Opponent';
  const homeExternal = false;
  const awayExternal = awayId == null;

  // Default: home bats first (Admin can swap via batting side when we add toss — sides derived here).
  const firstBattingHome =
    match.tossWinner == null ||
    (match.tossWinner === MatchSide.TeamA && match.tossDecision === TossDecision.Bat) ||
    (match.tossWinner === MatchSide.TeamB && match.tossDecision === TossDecision.Bowl);

  const inn1BattingId = firstBattingHome ? homeId : awayId;
  const inn1BowlingId = firstBattingHome ? awayId : homeId;
  const inn1BattingExt = firstBattingHome ? homeExternal : awayExternal;
  const inn1BowlingExt = firstBattingHome ? awayExternal : homeExternal;
  const inn1Label = firstBattingHome ? homeName : awayName;

  return [
    {
      sequence: 1,
      battingTeamId: inn1BattingId,
      bowlingTeamId: inn1BowlingId,
      battingIsExternal: inn1BattingExt,
      bowlingIsExternal: inn1BowlingExt,
      label: inn1Label,
      runs: '',
      wickets: '',
      oversText: '',
      extrasByes: '0',
      extrasLegByes: '0',
      extrasWides: '0',
      extrasNoBalls: '0',
      closeReason: InningsCloseReason.ManuallyEnded,
      batters: [],
      bowlers: [],
    },
    {
      sequence: 2,
      battingTeamId: inn1BowlingId,
      bowlingTeamId: inn1BattingId,
      battingIsExternal: inn1BowlingExt,
      bowlingIsExternal: inn1BattingExt,
      label: firstBattingHome ? awayName : homeName,
      runs: '',
      wickets: '',
      oversText: '',
      extrasByes: '0',
      extrasLegByes: '0',
      extrasWides: '0',
      extrasNoBalls: '0',
      closeReason: InningsCloseReason.TargetReached,
      batters: [],
      bowlers: [],
    },
  ];
}

function playerOptions(match: MatchDetail, battingExternal: boolean): SelectOption[] {
  if (battingExternal) {
    return match.externalPlayers.map((p) => ({ value: p.id, label: p.name }));
  }
  const squad = match.squads.find((s) => s.teamId === match.homeTeamId);
  const fromSquad =
    squad?.players.map((p) => ({
      value: p.userId,
      label: `${p.firstName} ${p.lastName}`.trim(),
    })) ?? [];
  return fromSquad;
}

function bowlingOptions(match: MatchDetail, bowlingExternal: boolean): SelectOption[] {
  return playerOptions(match, bowlingExternal);
}

/**
 * Admin SCORECARD_ONLY entry: enter both innings from a paper scorecard,
 * validate, and persist Phase 1 summary rows.
 */
export default function ScorecardOnlyEntryScreen(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const { matchId, tournamentId } = useLocalSearchParams<{
    matchId: string;
    tournamentId?: string;
  }>();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeInnings, setActiveInnings] = useState(0);
  const [innings, setInnings] = useState<InningsDraft[]>([]);
  const [tossWinner, setTossWinner] = useState<string | null>(null);
  const [tossDecision, setTossDecision] = useState<string | null>(TossDecision.Bat);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [isNoResult, setIsNoResult] = useState(false);
  const [clientWarnings, setClientWarnings] = useState<ScorecardSummaryValidationIssue[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [batterDraft, setBatterDraft] = useState<BatterDraft>(() => emptyBatter());
  const [editingBatterKey, setEditingBatterKey] = useState<string | null>(null);
  const [batterDraftError, setBatterDraftError] = useState<string | null>(null);
  const [bowlerDraft, setBowlerDraft] = useState<BowlerDraft>(() => emptyBowler());
  const [editingBowlerKey, setEditingBowlerKey] = useState<string | null>(null);
  const [bowlerDraftError, setBowlerDraftError] = useState<string | null>(null);

  const isAdmin = user?.role === UserRole.Admin;

  const load = useCallback(async () => {
    if (!matchId) {
      setLoadError('Match not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const detail = await getMatch(matchId);
      if (detail.scoringMode !== ScoringMode.ScorecardOnly) {
        setLoadError('This match is not a scorecard-only backfill.');
        setMatch(detail);
        return;
      }
      if (detail.state === MatchState.ScorecardLocked) {
        setLoadError('This scorecard is already locked.');
        setMatch(detail);
        return;
      }
      setMatch(detail);
      setInnings(buildInitialInnings(detail));
      setTossWinner(detail.tossWinner);
      setTossDecision(detail.tossDecision ?? TossDecision.Bat);
      setWinnerId(detail.winningTeamId);
      setIsNoResult(detail.isNoResult);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Could not load match.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Rebuild innings batting order from toss while the form is still empty.
  useEffect(() => {
    if (!match || !tossWinner || !tossDecision) {
      return;
    }
    setInnings((prev) => {
      const hasData = prev.some(
        (inn) =>
          inn.runs.trim() !== '' ||
          inn.batters.some((b) => b.playerId) ||
          inn.bowlers.some((b) => b.playerId),
      );
      if (hasData) {
        return prev;
      }
      return buildInitialInnings({
        ...match,
        tossWinner: tossWinner as MatchSide,
        tossDecision: tossDecision as TossDecision,
      });
    });
  }, [match, tossWinner, tossDecision]);

  const tossOptions: SelectOption[] = useMemo(() => {
    if (!match) return [];
    const opts: SelectOption[] = [
      { value: MatchSide.TeamA, label: match.homeTeamName ?? 'ACC' },
    ];
    opts.push({
      value: MatchSide.TeamB,
      label: match.awayTeamName ?? match.externalOpponentName ?? 'Opponent',
    });
    return opts;
  }, [match]);

  const winnerOptions: SelectOption[] = useMemo(() => {
    if (!match) return [];
    const opts: SelectOption[] = [];
    if (match.homeTeamId) {
      opts.push({ value: match.homeTeamId, label: match.homeTeamName ?? 'ACC' });
    }
    if (match.awayTeamId) {
      opts.push({ value: match.awayTeamId, label: match.awayTeamName ?? 'Away' });
    } else {
      opts.push({
        value: EXTERNAL_WINNER,
        label: match.externalOpponentName ?? 'Opponent',
      });
    }
    return opts;
  }, [match]);

  const closeReasonOptions: SelectOption[] = [
    { value: InningsCloseReason.AllOut, label: 'All out' },
    { value: InningsCloseReason.OversComplete, label: 'Overs complete' },
    { value: InningsCloseReason.TargetReached, label: 'Target reached' },
    { value: InningsCloseReason.ManuallyEnded, label: 'Ended / declared' },
  ];

  const dismissalOptions: SelectOption[] = [
    { value: '', label: 'Not out' },
    ...Object.values(DismissalType).map((d) => ({
      value: d,
      label: DISMISSAL_TYPE_LABELS[d],
    })),
  ];

  function handleBack(): void {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (tournamentId) {
      router.replace(
        tournamentDetailHref(user, tournamentId, TOURNAMENT_DETAIL_TAB.TournamentMatches),
      );
    }
  }

  function updateInnings(index: number, patch: Partial<InningsDraft>): void {
    setInnings((prev) =>
      prev.map((inn, i) => (i === index ? { ...inn, ...patch } : inn)),
    );
  }

  function resetBatterDraft(): void {
    setBatterDraft(emptyBatter());
    setEditingBatterKey(null);
    setBatterDraftError(null);
  }

  function resetBowlerDraft(): void {
    setBowlerDraft(emptyBowler());
    setEditingBowlerKey(null);
    setBowlerDraftError(null);
  }

  function selectInningsTab(index: number): void {
    setActiveInnings(index);
    resetBatterDraft();
    resetBowlerDraft();
  }

  function patchBatterDraft(patch: Partial<BatterDraft>): void {
    setBatterDraftError(null);
    setBatterDraft((prev) => ({ ...prev, ...patch }));
  }

  function patchBowlerDraft(patch: Partial<BowlerDraft>): void {
    setBowlerDraftError(null);
    setBowlerDraft((prev) => ({ ...prev, ...patch }));
  }

  function commitBatterDraft(): void {
    if (!batterDraft.playerId) {
      setBatterDraftError('Select a batter.');
      return;
    }
    if (batterDraft.runs < 0 || batterDraft.balls < 0) {
      setBatterDraftError('Runs and balls must be 0 or more.');
      return;
    }
    const row: BatterDraft = {
      ...batterDraft,
      key: editingBatterKey ?? emptyBatter().key,
      runs: Number(batterDraft.runs) || 0,
      balls: Number(batterDraft.balls) || 0,
      fours: Number(batterDraft.fours) || 0,
      sixes: Number(batterDraft.sixes) || 0,
      dismissalType: batterDraft.isOut ? batterDraft.dismissalType : null,
      bowlerId: batterDraft.isOut ? batterDraft.bowlerId : null,
      fielderId:
        batterDraft.isOut && dismissalNeedsFielder(batterDraft.dismissalType)
          ? batterDraft.fielderId
          : null,
    };
    setInnings((prev) =>
      prev.map((inn, i) => {
        if (i !== activeInnings) return inn;
        if (editingBatterKey) {
          return {
            ...inn,
            batters: inn.batters.map((b) => (b.key === editingBatterKey ? row : b)),
          };
        }
        return { ...inn, batters: [...inn.batters, row] };
      }),
    );
    resetBatterDraft();
  }

  function commitBowlerDraft(): void {
    if (!bowlerDraft.playerId) {
      setBowlerDraftError('Select a bowler.');
      return;
    }
    if (!isValidOversText(bowlerDraft.oversText)) {
      setBowlerDraftError('Overs must look like 4.2 (balls 0–5).');
      return;
    }
    if (
      (bowlerDraft.maidens ?? 0) < 0 ||
      bowlerDraft.runsConceded < 0 ||
      bowlerDraft.wickets < 0
    ) {
      setBowlerDraftError('Maidens, runs, and wickets must be 0 or more.');
      return;
    }
    const row: BowlerDraft = {
      ...bowlerDraft,
      key: editingBowlerKey ?? emptyBowler().key,
      oversText: bowlerDraft.oversText.trim(),
      maidens: Number(bowlerDraft.maidens) || 0,
      runsConceded: Number(bowlerDraft.runsConceded) || 0,
      wickets: Number(bowlerDraft.wickets) || 0,
    };
    setInnings((prev) =>
      prev.map((inn, i) => {
        if (i !== activeInnings) return inn;
        if (editingBowlerKey) {
          return {
            ...inn,
            bowlers: inn.bowlers.map((b) => (b.key === editingBowlerKey ? row : b)),
          };
        }
        return { ...inn, bowlers: [...inn.bowlers, row] };
      }),
    );
    resetBowlerDraft();
  }

  function editBatter(batter: BatterDraft): void {
    setBatterDraft({ ...batter });
    setEditingBatterKey(batter.key);
    setBatterDraftError(null);
  }

  function editBowler(bowler: BowlerDraft): void {
    setBowlerDraft({ ...bowler });
    setEditingBowlerKey(bowler.key);
    setBowlerDraftError(null);
  }

  function deleteBatter(batter: BatterDraft): void {
    confirmDestructiveDeleteAlert({
      title: 'Remove batter?',
      message: 'This batting row will be removed from the scorecard entry.',
      onConfirm: () => {
        setInnings((prev) =>
          prev.map((inn, i) =>
            i === activeInnings
              ? { ...inn, batters: inn.batters.filter((b) => b.key !== batter.key) }
              : inn,
          ),
        );
        if (editingBatterKey === batter.key) {
          resetBatterDraft();
        }
      },
    });
  }

  function deleteBowler(bowler: BowlerDraft): void {
    confirmDestructiveDeleteAlert({
      title: 'Remove bowler?',
      message: 'This bowling row will be removed from the scorecard entry.',
      onConfirm: () => {
        setInnings((prev) =>
          prev.map((inn, i) =>
            i === activeInnings
              ? { ...inn, bowlers: inn.bowlers.filter((b) => b.key !== bowler.key) }
              : inn,
          ),
        );
        if (editingBowlerKey === bowler.key) {
          resetBowlerDraft();
        }
      },
    });
  }

  function suggestWinner(): void {
    if (!match || innings.length < 2) return;
    const a = num(innings[0]!.runs);
    const b = num(innings[1]!.runs);
    if (a === b) {
      setIsNoResult(false);
      setWinnerId(null);
      return;
    }
    const firstWins = a > b;
    const winnerTeamId = firstWins ? innings[0]!.battingTeamId : innings[1]!.battingTeamId;
    const winnerExternal = firstWins
      ? innings[0]!.battingIsExternal
      : innings[1]!.battingIsExternal;
    if (winnerExternal) {
      setWinnerId(EXTERNAL_WINNER);
    } else if (winnerTeamId) {
      setWinnerId(winnerTeamId);
    }
    setIsNoResult(false);
  }

  function collectClientWarnings(): ScorecardSummaryValidationIssue[] {
    const issues: ScorecardSummaryValidationIssue[] = [];
    for (const inn of innings) {
      if (!isValidOversText(inn.oversText)) {
        issues.push({
          code: 'INVALID_OVERS_TEXT',
          severity: 'hard',
          message: `Innings ${inn.sequence}: overs must look like 21.2`,
          inningsSequence: inn.sequence,
        });
      }
      const wickets = num(inn.wickets);
      if (wickets > 10) {
        issues.push({
          code: 'WICKETS_OVER_LIMIT',
          severity: 'hard',
          message: `Innings ${inn.sequence}: wickets cannot exceed 10`,
          inningsSequence: inn.sequence,
        });
      }
      for (const bowler of inn.bowlers) {
        if (bowler.playerId && !isValidOversText(bowler.oversText)) {
          issues.push({
            code: 'INVALID_OVERS_TEXT',
            severity: 'hard',
            message: `Innings ${inn.sequence}: invalid bowler overs`,
            inningsSequence: inn.sequence,
          });
        }
      }
      const extras =
        num(inn.extrasByes) +
        num(inn.extrasLegByes) +
        num(inn.extrasWides) +
        num(inn.extrasNoBalls);
      const battingRuns = inn.batters.reduce((s, b) => s + Number(b.runs || 0), 0);
      const total = num(inn.runs);
      if (battingRuns + extras !== total) {
        issues.push({
          code: 'RUNS_EXTRAS_MISMATCH',
          severity: 'soft',
          message: `Innings ${inn.sequence}: batting (${battingRuns}) + extras (${extras}) ≠ total (${total})`,
          inningsSequence: inn.sequence,
        });
      }
    }

    return issues;
  }

  function buildPayload(): UpsertScorecardSummaryRequest {
    const resolvedWinner =
      isNoResult || winnerId === EXTERNAL_WINNER || winnerId == null ? null : winnerId;

    return {
      tossWinner: (tossWinner as MatchSide | null) ?? null,
      tossDecision: (tossDecision as TossDecision | null) ?? null,
      winningTeamId: resolvedWinner,
      isNoResult,
      innings: innings.map((inn): ScorecardSummaryInningsWriteInput => {
        const target =
          inn.sequence === 2 ? num(innings[0]!.runs) + 1 : null;
        return {
          sequence: inn.sequence,
          battingTeamId: inn.battingTeamId,
          bowlingTeamId: inn.bowlingTeamId,
          battingIsExternal: inn.battingIsExternal,
          bowlingIsExternal: inn.bowlingIsExternal,
          runs: num(inn.runs),
          wickets: num(inn.wickets),
          oversText: inn.oversText.trim(),
          oversAllotted: match?.oversPerInnings ?? null,
          closed: true,
          closeReason: inn.closeReason,
          target,
          extrasByes: num(inn.extrasByes),
          extrasLegByes: num(inn.extrasLegByes),
          extrasWides: num(inn.extrasWides),
          extrasNoBalls: num(inn.extrasNoBalls),
          batters: inn.batters
            .filter((b) => b.playerId)
            .map(({ key: _k, ...rest }) => ({
              ...rest,
              runs: Number(rest.runs) || 0,
              balls: Number(rest.balls) || 0,
              fours: Number(rest.fours) || 0,
              sixes: Number(rest.sixes) || 0,
              isOut: Boolean(rest.isOut),
              dismissalType: rest.isOut ? rest.dismissalType : null,
            })),
          bowlers: inn.bowlers
            .filter((b) => b.playerId)
            .map(({ key: _k, ...rest }) => ({
              ...rest,
              maidens: Number(rest.maidens) || 0,
              runsConceded: Number(rest.runsConceded) || 0,
              wickets: Number(rest.wickets) || 0,
            })),
          fallOfWickets: [],
          squadPlayerIds: !inn.battingIsExternal
            ? [
                ...inn.batters.filter((b) => b.playerId).map((b) => b.playerId),
                ...(match?.squads.find((s) => s.teamId === inn.battingTeamId)?.players.map(
                  (p) => p.userId,
                ) ?? []),
              ]
            : undefined,
        };
      }),
    };
  }

  async function handleSave(forceAfterWarnings: boolean): Promise<void> {
    if (!matchId || !match) return;
    const warnings = collectClientWarnings();
    setClientWarnings(warnings);
    const hard = warnings.filter((w) => w.severity === 'hard');
    if (hard.length > 0) {
      setSubmitError(hard[0]!.message);
      return;
    }
    const soft = warnings.filter((w) => w.severity === 'soft');
    if (soft.length > 0 && !forceAfterWarnings) {
      Alert.alert(
        'Validation warnings',
        soft.map((w) => w.message).join('\n\n') + '\n\nSave anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', style: 'destructive', onPress: () => void handleSave(true) },
        ],
      );
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const result = await upsertScorecardSummary(matchId, buildPayload());
      const serverSoft = result.warnings.filter((w) => w.severity === 'soft');
      const goScorecard = () => {
        router.replace(`/matches/${matchId}/scorecard`);
      };
      if (serverSoft.length > 0) {
        Alert.alert(
          'Saved with warnings',
          serverSoft.map((w) => w.message).join('\n\n'),
          [{ text: 'OK', onPress: goScorecard }],
        );
      } else {
        goScorecard();
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiRequestError ? err.message : 'Could not save the scorecard.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title="Enter scorecard" showBack onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-on-surface-variant">
            Only an Admin can enter a scorecard-only backfill.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title="Enter scorecard" showBack onBack={handleBack} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !match) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title="Enter scorecard" showBack onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-on-surface-variant">
            {loadError ?? 'Match not found.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const inn = innings[activeInnings];
  if (!inn) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title="Enter scorecard" showBack onBack={handleBack} />
      </SafeAreaView>
    );
  }

  const allBatterOpts = playerOptions(match, inn.battingIsExternal);
  const allBowlerOpts = bowlingOptions(match, inn.bowlingIsExternal);
  // Bowler/fielder pickers for dismissals come from the bowling side (full list).
  const dismissalBowlerOpts = allBowlerOpts;
  const fielderOpts = allBowlerOpts;

  const usedBatterIds = new Set(
    inn.batters
      .filter((b) => b.key !== editingBatterKey && b.playerId)
      .map((b) => b.playerId),
  );
  const batterOpts = allBatterOpts.filter((o) => !usedBatterIds.has(o.value));

  const usedBowlerIds = new Set(
    inn.bowlers
      .filter((b) => b.key !== editingBowlerKey && b.playerId)
      .map((b) => b.playerId),
  );
  const bowlerOpts = allBowlerOpts.filter((o) => !usedBowlerIds.has(o.value));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Enter scorecard" showBack onBack={handleBack} />
      <KeyboardAwareFormScrollView
        contentContainerClassName="px-4 pt-2"
        extraBottomPadding={32}
        footer={
          <SafeAreaView edges={['bottom']} className="border-t border-outline-variant px-4 py-3">
            {submitError ? (
              <Text className="mb-2 font-sans text-sm text-error">{submitError}</Text>
            ) : null}
            {clientWarnings.filter((w) => w.severity === 'soft').length > 0 ? (
              <Text className="mb-2 font-sans text-sm text-amber-700">
                {clientWarnings
                  .filter((w) => w.severity === 'soft')
                  .map((w) => w.message)
                  .join(' · ')}
              </Text>
            ) : null}
            <Button
              disabled={saving}
              onPress={() => void handleSave(false)}
              className="h-14 w-full"
              label={saving ? 'Saving…' : 'Save & lock scorecard'}
            />
          </SafeAreaView>
        }
      >
        <View className="gap-5">
        <Text className="font-sans-bold text-xl text-on-surface">
          {match.homeTeamName ?? 'ACC'} vs{' '}
          {match.awayTeamName ?? match.externalOpponentName ?? 'Opponent'}
        </Text>

        <Select
          label="Toss won by"
          placeholder="Select side"
          value={tossWinner}
          options={tossOptions}
          onChange={setTossWinner}
        />
        <Select
          label="Toss decision"
          placeholder="Bat or bowl"
          value={tossDecision}
          options={[
            { value: TossDecision.Bat, label: 'Bat' },
            { value: TossDecision.Bowl, label: 'Bowl' },
          ]}
          onChange={setTossDecision}
        />

        <InningsTabs
          tabLabels={innings.map((item) => `Inn ${item.sequence}`)}
          selectedIndex={activeInnings}
          onSelect={selectInningsTab}
        />

        <View className="gap-5 rounded-control border border-outline-variant bg-surface-container-lowest p-4">
          <Text className="font-sans-semibold text-base text-on-surface">
            {inn.label} — Totals
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextInput
                label="Runs"
                value={inn.runs}
                onChangeText={(t) => updateInnings(activeInnings, { runs: t })}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="Wickets"
                value={inn.wickets}
                onChangeText={(t) => updateInnings(activeInnings, { wickets: t })}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="Overs"
                value={inn.oversText}
                onChangeText={(t) => updateInnings(activeInnings, { oversText: t })}
                placeholder="21.2"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextInput
                label="b"
                value={inn.extrasByes}
                onChangeText={(t) => updateInnings(activeInnings, { extrasByes: t })}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="lb"
                value={inn.extrasLegByes}
                onChangeText={(t) => updateInnings(activeInnings, { extrasLegByes: t })}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="w"
                value={inn.extrasWides}
                onChangeText={(t) => updateInnings(activeInnings, { extrasWides: t })}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="nb"
                value={inn.extrasNoBalls}
                onChangeText={(t) => updateInnings(activeInnings, { extrasNoBalls: t })}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <Select
            label="Innings closed"
            value={inn.closeReason}
            options={closeReasonOptions}
            onChange={(v) =>
              updateInnings(activeInnings, { closeReason: v as InningsCloseReason })
            }
          />
        </View>

        <View className="gap-5 rounded-control border border-outline-variant bg-surface-container-lowest p-4">
          <Text className="font-sans-semibold text-base text-on-surface">Batting</Text>
          <Select
            label="Player"
            placeholder="Select player"
            value={batterDraft.playerId || null}
            options={batterOpts}
            onChange={(v) => patchBatterDraft({ playerId: v })}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextInput
                label="R"
                value={String(batterDraft.runs)}
                onChangeText={(t) => patchBatterDraft({ runs: num(t) })}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="B"
                value={String(batterDraft.balls)}
                onChangeText={(t) => patchBatterDraft({ balls: num(t) })}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="4s"
                value={String(batterDraft.fours ?? 0)}
                onChangeText={(t) => patchBatterDraft({ fours: num(t) })}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="6s"
                value={String(batterDraft.sixes ?? 0)}
                onChangeText={(t) => patchBatterDraft({ sixes: num(t) })}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <Select
            label="Dismissal"
            value={batterDraft.isOut ? (batterDraft.dismissalType ?? '') : ''}
            options={dismissalOptions}
            onChange={(v) => {
              const dismissalType = v ? (v as DismissalType) : null;
              patchBatterDraft({
                isOut: v.length > 0,
                dismissalType,
                fielderId: dismissalNeedsFielder(dismissalType)
                  ? batterDraft.fielderId
                  : null,
              });
            }}
          />
          {batterDraft.isOut ? (
            <>
              <Select
                label="Bowler"
                placeholder="Optional"
                value={batterDraft.bowlerId ?? null}
                options={dismissalBowlerOpts}
                onChange={(v) => patchBatterDraft({ bowlerId: v })}
              />
              {dismissalNeedsFielder(batterDraft.dismissalType) ? (
                <Select
                  label="Fielder"
                  placeholder="Optional"
                  value={batterDraft.fielderId ?? null}
                  options={fielderOpts}
                  onChange={(v) => patchBatterDraft({ fielderId: v })}
                />
              ) : null}
            </>
          ) : null}
          {batterDraftError ? (
            <Text className="font-sans text-sm text-error">{batterDraftError}</Text>
          ) : null}
          <View className="flex-row gap-2">
            {editingBatterKey ? (
              <Button
                label="Cancel"
                variant="secondary"
                className="h-12 min-w-0 flex-1"
                onPress={resetBatterDraft}
              />
            ) : null}
            <Button
              label={editingBatterKey ? 'Update Batter' : 'Add Batter'}
              variant="secondary"
              className={`h-12 ${editingBatterKey ? 'min-w-0 flex-1' : 'w-full'}`}
              onPress={commitBatterDraft}
            />
          </View>
          {inn.batters.length > 0 ? (
            <View className="gap-2">
              {inn.batters.map((batter) => {
                const name =
                  allBatterOpts.find((o) => o.value === batter.playerId)?.label ?? 'Player';
                const status = batter.isOut
                  ? formatDismissalShort(
                      {
                        dismissalType: batter.dismissalType,
                        bowlerId: batter.bowlerId,
                        fielderId: batter.fielderId,
                      },
                      (id) =>
                        dismissalBowlerOpts.find((o) => o.value === id)?.label ?? null,
                    ) || 'out'
                  : 'not out';
                const menuActions: OverflowMenuAction[] = [
                  {
                    key: 'edit',
                    label: 'Edit',
                    icon: 'pencil',
                    secondary: true,
                    onPress: () => editBatter(batter),
                  },
                  {
                    key: 'delete',
                    label: 'Delete',
                    icon: 'trash-outline',
                    destructive: true,
                    onPress: () => deleteBatter(batter),
                  },
                ];
                return (
                  <View
                    key={batter.key}
                    className="flex-row items-center gap-2 rounded-control border border-outline-variant bg-surface px-3 py-2.5"
                  >
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text
                        className="font-sans-semibold text-sm text-on-surface"
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      <Text
                        className="font-sans text-xs text-on-surface-variant"
                        numberOfLines={1}
                      >
                        {batter.runs} ({batter.balls}) · {batter.fours ?? 0}×4 ·{' '}
                        {batter.sixes ?? 0}×6 · {status}
                      </Text>
                    </View>
                    <OverflowMenu
                      actions={menuActions}
                      accessibilityLabel={`More options for ${name}`}
                      iconColor={FIELD_ORANGE}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <View className="gap-5 rounded-control border border-outline-variant bg-surface-container-lowest p-4">
          <Text className="font-sans-semibold text-base text-on-surface">Bowling</Text>
          <Select
            label="Player"
            placeholder="Select player"
            value={bowlerDraft.playerId || null}
            options={bowlerOpts}
            onChange={(v) => patchBowlerDraft({ playerId: v })}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextInput
                label="O"
                value={bowlerDraft.oversText}
                onChangeText={(t) => patchBowlerDraft({ oversText: t })}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="M"
                value={String(bowlerDraft.maidens ?? 0)}
                onChangeText={(t) => patchBowlerDraft({ maidens: num(t) })}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="R"
                value={String(bowlerDraft.runsConceded)}
                onChangeText={(t) => patchBowlerDraft({ runsConceded: num(t) })}
                keyboardType="number-pad"
              />
            </View>
            <View className="flex-1">
              <TextInput
                label="W"
                value={String(bowlerDraft.wickets)}
                onChangeText={(t) => patchBowlerDraft({ wickets: num(t) })}
                keyboardType="number-pad"
              />
            </View>
          </View>
          {bowlerDraftError ? (
            <Text className="font-sans text-sm text-error">{bowlerDraftError}</Text>
          ) : null}
          <View className="flex-row gap-2">
            {editingBowlerKey ? (
              <Button
                label="Cancel"
                variant="secondary"
                className="h-12 min-w-0 flex-1"
                onPress={resetBowlerDraft}
              />
            ) : null}
            <Button
              label={editingBowlerKey ? 'Update Bowler' : 'Add Bowler'}
              variant="secondary"
              className={`h-12 ${editingBowlerKey ? 'min-w-0 flex-1' : 'w-full'}`}
              onPress={commitBowlerDraft}
            />
          </View>
          {inn.bowlers.length > 0 ? (
            <View className="gap-2">
              {inn.bowlers.map((bowler) => {
                const name =
                  allBowlerOpts.find((o) => o.value === bowler.playerId)?.label ?? 'Player';
                const menuActions: OverflowMenuAction[] = [
                  {
                    key: 'edit',
                    label: 'Edit',
                    icon: 'pencil',
                    secondary: true,
                    onPress: () => editBowler(bowler),
                  },
                  {
                    key: 'delete',
                    label: 'Delete',
                    icon: 'trash-outline',
                    destructive: true,
                    onPress: () => deleteBowler(bowler),
                  },
                ];
                return (
                  <View
                    key={bowler.key}
                    className="flex-row items-center gap-2 rounded-control border border-outline-variant bg-surface px-3 py-2.5"
                  >
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text
                        className="font-sans-semibold text-sm text-on-surface"
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      <Text
                        className="font-sans text-xs text-on-surface-variant"
                        numberOfLines={1}
                      >
                        {bowler.oversText}-{bowler.maidens ?? 0}-{bowler.runsConceded}-
                        {bowler.wickets}
                      </Text>
                    </View>
                    <OverflowMenu
                      actions={menuActions}
                      accessibilityLabel={`More options for ${name}`}
                      iconColor={FIELD_ORANGE}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <Text className="mt-2 font-sans-semibold text-base text-on-surface">Result</Text>
        <Button
          label="Suggest Winner from Totals"
          variant="secondary"
          className="h-12 w-full"
          onPress={suggestWinner}
        />
        <Select
          label="Winner"
          placeholder="Select winner"
          value={isNoResult ? null : winnerId}
          options={winnerOptions}
          onChange={(v) => {
            setIsNoResult(false);
            setWinnerId(v);
          }}
        />
        <Pressable
          onPress={() => {
            setIsNoResult((v) => !v);
            if (!isNoResult) setWinnerId(null);
          }}
          className="flex-row items-center gap-2 py-2"
        >
          <View
            className={`h-5 w-5 rounded border ${
              isNoResult ? 'border-primary bg-primary' : 'border-outline-variant'
            }`}
          />
          <Text className="font-sans text-base text-on-surface">No Result</Text>
        </Pressable>
        </View>
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
