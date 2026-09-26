import {
  computeEconomyRate,
  computeStrikeRate,
  DISMISSAL_TYPE_LABELS,
  DismissalType,
  InningsCloseReason,
  LEATHER_POINTS_LOSS,
  LEATHER_POINTS_WIN,
  MatchSide,
  MatchState,
  ScoringMode,
  TossDecision,
  UserRole,
  formatBowlerEconomyDisplay,
  formatBatterStrikeRateDisplay,
  parseOversTextToLegalBalls,
  type MatchDetail,
  type ScorecardSummaryBatterInput,
  type ScorecardSummaryBowlerInput,
  type ScorecardSummaryFallOfWicketInput,
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
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Select, type SelectOption } from '../../../src/components/ui/Select';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import {
  ApiRequestError,
  getMatch,
  upsertScorecardSummary,
} from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth-context';
import { tournamentDetailHref } from '../../../src/lib/tournament-detail-route';
import { TOURNAMENT_DETAIL_TAB } from '../../../src/lib/tournament-detail-tabs';

const EXTERNAL_WINNER = '__EXTERNAL__';

type BatterDraft = ScorecardSummaryBatterInput & { key: string };
type BowlerDraft = ScorecardSummaryBowlerInput & { key: string };
type FowDraft = ScorecardSummaryFallOfWicketInput & { key: string };

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
  fallOfWickets: FowDraft[];
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

function emptyFow(): FowDraft {
  return {
    key: `f-${Math.random().toString(36).slice(2, 9)}`,
    wicketNumber: 1,
    playerId: '',
    teamRuns: 0,
    oversText: '0',
  };
}

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isValidOversText(oversText: string): boolean {
  return /^(\d+)(?:\.([0-5]))?$/.test(oversText.trim());
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
      batters: [emptyBatter()],
      bowlers: [emptyBowler()],
      fallOfWickets: [],
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
      batters: [emptyBatter()],
      bowlers: [emptyBowler()],
      fallOfWickets: [],
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
  const [resultNote, setResultNote] = useState('');
  const [statedHomePoints, setStatedHomePoints] = useState('');
  const [statedAwayPoints, setStatedAwayPoints] = useState('');
  const [clientWarnings, setClientWarnings] = useState<ScorecardSummaryValidationIssue[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      setResultNote(detail.resultNote ?? '');
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

  function updateBatter(
    inningsIndex: number,
    batterKey: string,
    patch: Partial<BatterDraft>,
  ): void {
    setInnings((prev) =>
      prev.map((inn, i) => {
        if (i !== inningsIndex) return inn;
        return {
          ...inn,
          batters: inn.batters.map((b) => (b.key === batterKey ? { ...b, ...patch } : b)),
        };
      }),
    );
  }

  function updateBowler(
    inningsIndex: number,
    bowlerKey: string,
    patch: Partial<BowlerDraft>,
  ): void {
    setInnings((prev) =>
      prev.map((inn, i) => {
        if (i !== inningsIndex) return inn;
        return {
          ...inn,
          bowlers: inn.bowlers.map((b) => (b.key === bowlerKey ? { ...b, ...patch } : b)),
        };
      }),
    );
  }

  function updateFow(inningsIndex: number, fowKey: string, patch: Partial<FowDraft>): void {
    setInnings((prev) =>
      prev.map((inn, i) => {
        if (i !== inningsIndex) return inn;
        return {
          ...inn,
          fallOfWickets: inn.fallOfWickets.map((f) =>
            f.key === fowKey ? { ...f, ...patch } : f,
          ),
        };
      }),
    );
  }

  function suggestWinner(): void {
    if (!match || innings.length < 2) return;
    const a = num(innings[0]!.runs);
    const b = num(innings[1]!.runs);
    if (a === b) {
      setIsNoResult(false);
      setWinnerId(null);
      setResultNote('Match tied');
      return;
    }
    const firstWins = a > b;
    const winnerTeamId = firstWins ? innings[0]!.battingTeamId : innings[1]!.battingTeamId;
    const winnerExternal = firstWins
      ? innings[0]!.battingIsExternal
      : innings[1]!.battingIsExternal;
    const margin = Math.abs(a - b);
    if (winnerExternal) {
      setWinnerId(EXTERNAL_WINNER);
      setResultNote(
        `${match.externalOpponentName ?? 'Opponent'} won by ${
          firstWins ? `${margin} runs` : `${10 - num(innings[1]!.wickets)} wickets`
        }`,
      );
    } else if (winnerTeamId) {
      setWinnerId(winnerTeamId);
      const name =
        winnerTeamId === match.homeTeamId
          ? (match.homeTeamName ?? 'ACC')
          : (match.awayTeamName ?? 'Away');
      setResultNote(
        firstWins
          ? `${name} won by ${margin} runs`
          : `${name} won by ${10 - num(innings[1]!.wickets)} wickets`,
      );
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

    if (match && !isNoResult && statedHomePoints.trim() !== '') {
      const stated = num(statedHomePoints);
      const homeWins = winnerId === match.homeTeamId;
      const expected = homeWins ? LEATHER_POINTS_WIN : LEATHER_POINTS_LOSS;
      if (stated !== expected) {
        issues.push({
          code: 'POINTS_MISMATCH',
          severity: 'soft',
          message: `Home stated points ${stated} ≠ computed ${expected}`,
        });
      }
    }
    if (match && !isNoResult && statedAwayPoints.trim() !== '') {
      const stated = num(statedAwayPoints);
      const awayWins =
        winnerId === EXTERNAL_WINNER ||
        (match.awayTeamId != null && winnerId === match.awayTeamId);
      const expected = awayWins ? LEATHER_POINTS_WIN : LEATHER_POINTS_LOSS;
      if (stated !== expected) {
        issues.push({
          code: 'POINTS_MISMATCH',
          severity: 'soft',
          message: `Away stated points ${stated} ≠ computed ${expected}`,
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
      resultNote: resultNote.trim() || null,
      statedHomePoints: statedHomePoints.trim() === '' ? null : num(statedHomePoints),
      statedAwayPoints: statedAwayPoints.trim() === '' ? null : num(statedAwayPoints),
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
          fallOfWickets: inn.fallOfWickets
            .filter((f) => f.playerId)
            .map(({ key: _k, ...rest }) => rest),
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

  const batterOpts = playerOptions(match, inn.battingIsExternal);
  const bowlerOpts = bowlingOptions(match, inn.bowlingIsExternal);
  // Bowler/fielder pickers for dismissals come from the bowling side.
  const dismissalBowlerOpts = bowlerOpts;
  const fielderOpts = bowlerOpts;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Enter scorecard" showBack onBack={handleBack} />
      <KeyboardAwareFormScrollView
        contentContainerClassName="gap-4 px-4 pt-2"
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
        <Text className="font-sans-bold text-xl text-on-surface">
          {match.homeTeamName ?? 'ACC'} vs{' '}
          {match.awayTeamName ?? match.externalOpponentName ?? 'Opponent'}
        </Text>
        <Text className="font-sans text-sm text-on-surface-variant">
          Enter totals and player figures from the paper scorecard. Save writes summary records
          and locks the match.
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

        <View className="flex-row gap-2">
          {innings.map((item, index) => (
            <Pressable
              key={item.sequence}
              onPress={() => setActiveInnings(index)}
              className={`flex-1 items-center rounded-control border px-2 py-3 ${
                activeInnings === index
                  ? 'border-primary bg-primary/10'
                  : 'border-outline-variant bg-surface'
              }`}
            >
              <Text className="font-sans-semibold text-sm text-on-surface">
                Inn {item.sequence}
              </Text>
              <Text className="font-sans text-xs text-on-surface-variant" numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="font-sans-semibold text-base text-on-surface">
          {inn.label} — totals
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

        <Text className="font-sans-semibold text-base text-on-surface">Batting</Text>
        {inn.batters.map((batter, bi) => {
          const sr = formatBatterStrikeRateDisplay({
            balls: Number(batter.balls) || 0,
            strikeRate: computeStrikeRate(Number(batter.runs) || 0, Number(batter.balls) || 0) ?? 0,
          });
          return (
            <View key={batter.key} className="gap-2 rounded-control border border-outline-variant p-3">
              <Text className="font-sans-semibold text-sm text-on-surface">
                Batter {bi + 1}
              </Text>
              <Select
                label="Player"
                placeholder="Select player"
                value={batter.playerId || null}
                options={batterOpts}
                onChange={(v) => updateBatter(activeInnings, batter.key, { playerId: v })}
              />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <TextInput
                    label="R"
                    value={String(batter.runs)}
                    onChangeText={(t) =>
                      updateBatter(activeInnings, batter.key, { runs: num(t) })
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    label="B"
                    value={String(batter.balls)}
                    onChangeText={(t) =>
                      updateBatter(activeInnings, batter.key, { balls: num(t) })
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    label="4s"
                    value={String(batter.fours ?? 0)}
                    onChangeText={(t) =>
                      updateBatter(activeInnings, batter.key, { fours: num(t) })
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    label="6s"
                    value={String(batter.sixes ?? 0)}
                    onChangeText={(t) =>
                      updateBatter(activeInnings, batter.key, { sixes: num(t) })
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <View className="w-16 justify-end pb-2">
                  <Text className="font-sans text-xs text-on-surface-variant">SR {sr}</Text>
                </View>
              </View>
              <Select
                label="Dismissal"
                value={batter.isOut ? (batter.dismissalType ?? '') : ''}
                options={dismissalOptions}
                onChange={(v) =>
                  updateBatter(activeInnings, batter.key, {
                    isOut: v.length > 0,
                    dismissalType: v ? (v as DismissalType) : null,
                  })
                }
              />
              {batter.isOut ? (
                <>
                  <Select
                    label="Bowler"
                    placeholder="Optional"
                    value={batter.bowlerId ?? null}
                    options={dismissalBowlerOpts}
                    onChange={(v) =>
                      updateBatter(activeInnings, batter.key, { bowlerId: v })
                    }
                  />
                  <Select
                    label="Fielder"
                    placeholder="Optional"
                    value={batter.fielderId ?? null}
                    options={fielderOpts}
                    onChange={(v) =>
                      updateBatter(activeInnings, batter.key, { fielderId: v })
                    }
                  />
                </>
              ) : null}
            </View>
          );
        })}
        <Button
          label="Add batter"
          variant="secondary"
          onPress={() =>
            updateInnings(activeInnings, { batters: [...inn.batters, emptyBatter()] })
          }
        />

        <Text className="font-sans-semibold text-base text-on-surface">Bowling</Text>
        {inn.bowlers.map((bowler, bi) => {
          const legal = isValidOversText(bowler.oversText)
            ? parseOversTextToLegalBalls(bowler.oversText)
            : 0;
          const eco = formatBowlerEconomyDisplay({
            legalBalls: legal,
            economy: computeEconomyRate(Number(bowler.runsConceded) || 0, legal) ?? 0,
          });
          return (
            <View key={bowler.key} className="gap-2 rounded-control border border-outline-variant p-3">
              <Text className="font-sans-semibold text-sm text-on-surface">
                Bowler {bi + 1}
              </Text>
              <Select
                label="Player"
                placeholder="Select player"
                value={bowler.playerId || null}
                options={bowlerOpts}
                onChange={(v) => updateBowler(activeInnings, bowler.key, { playerId: v })}
              />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <TextInput
                    label="Overs"
                    value={bowler.oversText}
                    onChangeText={(t) =>
                      updateBowler(activeInnings, bowler.key, { oversText: t })
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    label="M"
                    value={String(bowler.maidens ?? 0)}
                    onChangeText={(t) =>
                      updateBowler(activeInnings, bowler.key, { maidens: num(t) })
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    label="R"
                    value={String(bowler.runsConceded)}
                    onChangeText={(t) =>
                      updateBowler(activeInnings, bowler.key, { runsConceded: num(t) })
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    label="W"
                    value={String(bowler.wickets)}
                    onChangeText={(t) =>
                      updateBowler(activeInnings, bowler.key, { wickets: num(t) })
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <View className="w-16 justify-end pb-2">
                  <Text className="font-sans text-xs text-on-surface-variant">Econ {eco}</Text>
                </View>
              </View>
            </View>
          );
        })}
        <Button
          label="Add bowler"
          variant="secondary"
          onPress={() =>
            updateInnings(activeInnings, { bowlers: [...inn.bowlers, emptyBowler()] })
          }
        />

        <Text className="font-sans-semibold text-base text-on-surface">
          Fall of wickets (optional)
        </Text>
        {inn.fallOfWickets.map((fow) => (
          <View key={fow.key} className="gap-2 rounded-control border border-outline-variant p-3">
            <View className="flex-row gap-2">
              <View className="w-16">
                <TextInput
                  label="#"
                  value={String(fow.wicketNumber)}
                  onChangeText={(t) =>
                    updateFow(activeInnings, fow.key, { wicketNumber: num(t) || 1 })
                  }
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-1">
                <Select
                  label="Batter out"
                  value={fow.playerId || null}
                  options={batterOpts}
                  onChange={(v) => updateFow(activeInnings, fow.key, { playerId: v })}
                />
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <TextInput
                  label="Score"
                  value={String(fow.teamRuns)}
                  onChangeText={(t) =>
                    updateFow(activeInnings, fow.key, { teamRuns: num(t) })
                  }
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-1">
                <TextInput
                  label="Overs"
                  value={fow.oversText}
                  onChangeText={(t) => updateFow(activeInnings, fow.key, { oversText: t })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
        ))}
        <Button
          label="Add FoW"
          variant="secondary"
          onPress={() =>
            updateInnings(activeInnings, {
              fallOfWickets: [
                ...inn.fallOfWickets,
                { ...emptyFow(), wicketNumber: inn.fallOfWickets.length + 1 },
              ],
            })
          }
        />

        <Text className="mt-2 font-sans-semibold text-base text-on-surface">Result</Text>
        <Button label="Suggest winner from totals" variant="secondary" onPress={suggestWinner} />
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
        <TextInput
          label="Result note"
          value={resultNote}
          onChangeText={setResultNote}
          placeholder="e.g. Atmiya 3 won by 8 wickets"
        />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <TextInput
              label="Stated home pts"
              value={statedHomePoints}
              onChangeText={setStatedHomePoints}
              keyboardType="number-pad"
              placeholder="10 / 0 / 5"
            />
          </View>
          <View className="flex-1">
            <TextInput
              label="Stated away pts"
              value={statedAwayPoints}
              onChangeText={setStatedAwayPoints}
              keyboardType="number-pad"
              placeholder="10 / 0 / 5"
            />
          </View>
        </View>
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
