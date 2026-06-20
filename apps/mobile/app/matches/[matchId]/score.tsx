import {
  formatMatchResultNote,
  InningsType,
  BatsmanPickerRole,
  DeliveryType,
  DismissalType,
  InningsCloseReason,
  MATCH_TYPE_LABELS,
  STANDARD_MATCH_PENALTY_RUNS,
  WICKETS_FOR_ALL_OUT,
  WICKETS_FOR_SUPER_OVER_ALL_OUT,
  type MatchDetail,
  type RecordDeliveryRequest,
  resolveOversAllotment,
  minimumOversAllotmentFromLegalBalls,
  type ScorecardResponse,
  type SetInningsParticipantsRequest,
} from '@acc/types';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BonusRunsDialog } from '../../../src/components/scoring/BonusRunsDialog';
import { CatchDropFielderPicker } from '../../../src/components/scoring/CatchDropFielderPicker';
import { MoreOptionsModal, type MoreOptionsAction } from '../../../src/components/scoring/MoreOptionsModal';
import { PenaltyRunsDialog } from '../../../src/components/scoring/PenaltyRunsDialog';
import {
  ChangeOversDialog,
  ChangeTargetBlockedDialog,
  ChangeTargetDialog,
  EndInningsConfirmDialog,
} from '../../../src/components/scoring/ScoringAdminDialogs';
import { ByesDialog } from '../../../src/components/scoring/ByesDialog';
import { LegByesDialog } from '../../../src/components/scoring/LegByesDialog';
import { NoBallDialog, type NoBallSelection } from '../../../src/components/scoring/NoBallDialog';
import { WideBallDialog } from '../../../src/components/scoring/WideBallDialog';
import { LiveScoringHeader } from '../../../src/components/scoring/LiveScoringHeader';
import { LiveScoringKeypad } from '../../../src/components/scoring/LiveScoringKeypad';
import { LiveScoringPlayerCards } from '../../../src/components/scoring/LiveScoringPlayerCards';
import {
  WicketDismissalSheet,
  WicketFlowType,
  isBowlerCreditedStrikerOutFlow,
  type WicketDismissalResult,
} from '../../../src/components/scoring/WicketDismissalSheet';
import type { RunOutExtraOption } from '../../../src/components/scoring/RunOutDetailsDialog';
import { Button } from '../../../src/components/ui/Button';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import {
  ApiRequestError,
  endInnings,
  getMatch,
  getScorecard,
  recordDelivery,
  setDlsTarget,
  setInningsParticipants,
  setOversAllotted,
  undoLastDelivery,
} from '../../../src/lib/api';
import { isInningsTransitionPending } from '../../../src/lib/match-completion';
import {
  consumeScoringPickResult,
  setScoringPickResult,
  type ScoringPickResult,
} from '../../../src/lib/scoring-pick-session';

function buildNoBallDelivery(
  selection: NoBallSelection,
): Omit<RecordDeliveryRequest, 'expectedVersion'> {
  switch (selection.branch) {
    case 'OFF_BAT':
      return {
        type: DeliveryType.NoBall,
        extraRuns: 1,
        runsBat: selection.runsBat,
        ...(selection.runsBat === 4 || selection.runsBat === 6 ? { isBoundary: true } : {}),
      };
    case 'LEG_BYE':
      return {
        type: DeliveryType.NoBall,
        extraRuns: 1,
        runsBat: 0,
        noBallLegByeRuns: selection.legByeRuns,
      };
    case 'BYE':
      return {
        type: DeliveryType.NoBall,
        extraRuns: 1,
        runsBat: 0,
        noBallByeRuns: selection.byeRuns,
      };
  }
}

function buildRunOutDelivery(
  result: WicketDismissalResult,
): Omit<RecordDeliveryRequest, 'expectedVersion'> {
  const runs = result.runsBat;
  const extra: RunOutExtraOption = result.runOutExtraType ?? 'NONE';
  const dismissal = {
    type: DismissalType.RunOut,
    dismissedId: result.dismissedId,
    fielderId: result.fielderId,
    fielder2Id: result.fielder2Id ?? null,
  };

  switch (extra) {
    case DeliveryType.Bye:
    case DeliveryType.LegBye:
      return { type: extra, runsBat: 0, extraRuns: runs, dismissal };
    case DeliveryType.Wide:
      return { type: DeliveryType.Wide, runsBat: 0, extraRuns: 1 + runs, dismissal };
    case DeliveryType.NoBall:
      return { type: DeliveryType.NoBall, runsBat: runs, extraRuns: 1, dismissal };
    default:
      return { type: DeliveryType.Legal, runsBat: runs, dismissal };
  }
}

type NameResolver = (id: string | null | undefined) => string;

interface BattingSlots {
  batsman1Id: string | null;
  batsman2Id: string | null;
}

/** Keep UI row slots stable; only clear a slot when that player leaves the crease. */
function syncBattingSlots(
  live: { currentStrikerId: string | null; currentNonStrikerId: string | null },
  match: MatchDetail | null,
  prev: BattingSlots,
): BattingSlots {
  const atCrease = new Set(
    [live.currentStrikerId, live.currentNonStrikerId].filter((id): id is string => Boolean(id)),
  );

  let batsman1Id = prev.batsman1Id;
  let batsman2Id = prev.batsman2Id;

  if (!batsman1Id && !batsman2Id) {
    batsman1Id = match?.openingStrikerUserId ?? live.currentStrikerId;
    batsman2Id = match?.openingNonStrikerUserId ?? live.currentNonStrikerId;
  }

  if (batsman1Id && !atCrease.has(batsman1Id)) batsman1Id = null;
  if (batsman2Id && !atCrease.has(batsman2Id)) batsman2Id = null;

  return { batsman1Id, batsman2Id };
}

function applyBattingSlotPick(pick: ScoringPickResult, prev: BattingSlots): BattingSlots {
  if (pick.kind !== 'batsman') return prev;
  if (pick.role === BatsmanPickerRole.Striker) {
    return { ...prev, batsman1Id: pick.userId };
  }
  if (pick.role === BatsmanPickerRole.NonStriker) {
    return { ...prev, batsman2Id: pick.userId };
  }
  if (!prev.batsman1Id) return { ...prev, batsman1Id: pick.userId };
  if (!prev.batsman2Id) return { ...prev, batsman2Id: pick.userId };
  return pick.incomingSlot === 'striker'
    ? { ...prev, batsman1Id: pick.userId }
    : { ...prev, batsman2Id: pick.userId };
}

export default function LiveScoringScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [card, setCard] = useState<ScorecardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [battingSlots, setBattingSlots] = useState<BattingSlots>({
    batsman1Id: null,
    batsman2Id: null,
  });
  const [bowlerId, setBowlerId] = useState<string | null>(null);
  const [showWicket, setShowWicket] = useState(false);
  const [showBonus, setShowBonus] = useState(false);
  const [showLegByes, setShowLegByes] = useState(false);
  const [showByes, setShowByes] = useState(false);
  const [showWide, setShowWide] = useState(false);
  const [showNoBall, setShowNoBall] = useState(false);
  const [showCatchDrop, setShowCatchDrop] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [moreAction, setMoreAction] = useState<MoreOptionsAction | null>(null);
  const [showChangeTargetBlocked, setShowChangeTargetBlocked] = useState(false);
  const [showEndInningsConfirm, setShowEndInningsConfirm] = useState(false);
  const endInningsPromptDismissedRef = useRef(false);
  const pendingIncomingRef = useRef(false);
  const pendingBowlerRef = useRef(false);
  const skipNextFocusLoadRef = useRef(true);
  const cardRef = useRef<ScorecardResponse | null>(null);
  cardRef.current = card;

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const [m, c] = await Promise.all([getMatch(matchId).catch(() => null), getScorecard(matchId)]);
      setMatch(m);
      setCard(c);
      const live = c.innings.at(-1);
      if (live) {
        const useMatchOpeners = live.sequence === 1;
        setStrikerId(live.currentStrikerId ?? (useMatchOpeners ? m?.openingStrikerUserId : null) ?? null);
        setNonStrikerId(
          live.currentNonStrikerId ?? (useMatchOpeners ? m?.openingNonStrikerUserId : null) ?? null,
        );
        setBattingSlots({
          batsman1Id:
            (useMatchOpeners ? m?.openingStrikerUserId : null) ?? live.currentStrikerId ?? null,
          batsman2Id:
            (useMatchOpeners ? m?.openingNonStrikerUserId : null) ?? live.currentNonStrikerId ?? null,
        });
        setBowlerId(live.currentBowlerId ?? (useMatchOpeners ? m?.openingBowlerUserId : null) ?? null);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load match.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const inn = card?.innings.at(-1) ?? null;

  /** One crease vacant after a wicket — scorer must name the incoming batter. */
  function needIncomingBatter(live: NonNullable<typeof inn>): boolean {
    if (live.closed) return false;
    const wicketCap =
      live.inningsType === InningsType.SuperOver
        ? WICKETS_FOR_SUPER_OVER_ALL_OUT
        : WICKETS_FOR_ALL_OUT;
    if (live.wickets >= wicketCap) return false;
    const hasStriker = Boolean(live.currentStrikerId);
    const hasNonStriker = Boolean(live.currentNonStrikerId);
    if (hasStriker === hasNonStriker) return false;
    return live.legalBalls > 0 || live.wickets > 0;
  }

  function isInningsAllOut(live: NonNullable<typeof inn>): boolean {
    return live.closed && live.closeReason === InningsCloseReason.AllOut;
  }

  function openBatsmanPicker(
    role: 'striker' | 'nonStriker' | 'incoming',
    liveInnings: NonNullable<typeof inn> | null = inn,
  ): void {
    if (!matchId || !liveInnings?.inningsId) return;
    const pickerRole =
      role === 'striker'
        ? BatsmanPickerRole.Striker
        : role === 'nonStriker'
          ? BatsmanPickerRole.NonStriker
          : BatsmanPickerRole.Incoming;
    const otherSlotUserId =
      pickerRole === BatsmanPickerRole.Striker
        ? nonStrikerId
        : pickerRole === BatsmanPickerRole.NonStriker
          ? strikerId
          : strikerId ?? nonStrikerId;
    const incomingSlot =
      role === 'incoming'
        ? !liveInnings.currentStrikerId
          ? 'striker'
          : !liveInnings.currentNonStrikerId
            ? 'nonStriker'
            : null
        : null;
    router.push({
      pathname: '/matches/[matchId]/select-batsman',
      params: {
        matchId,
        inningsId: liveInnings.inningsId,
        role: pickerRole,
        ...(otherSlotUserId ? { otherSlotUserId } : {}),
        ...(incomingSlot ? { incomingSlot } : {}),
      },
    });
  }

  function promptIncomingIfNeeded(live: NonNullable<typeof inn>): void {
    if (!needIncomingBatter(live) || pendingIncomingRef.current) return;
    pendingIncomingRef.current = true;
    openBatsmanPicker('incoming', live);
  }

  function openBatsmanPickerFromBatIcon(): void {
    if (inn && needIncomingBatter(inn)) {
      openBatsmanPicker('incoming', inn);
      return;
    }
    openBatsmanPicker('striker');
  }

  /** True at an over boundary when the upcoming over still has no bowler assigned. */
  function needsBowlerSelection(
    live: NonNullable<typeof inn>,
    bowlerIdForOver: string | null | undefined = live.currentBowlerId,
  ): boolean {
    if (live.closed) return false;
    const atOverBoundary = live.legalBalls > 0 && live.legalBalls % 6 === 0;
    if (!atOverBoundary) return false;
    return !bowlerIdForOver;
  }

  function openBowlerPicker(liveInnings: NonNullable<typeof inn> | null = inn): void {
    if (!matchId || !liveInnings?.inningsId || pendingBowlerRef.current) return;
    pendingBowlerRef.current = true;
    router.push({
      pathname: '/matches/[matchId]/select-bowler',
      params: {
        matchId,
        inningsId: liveInnings.inningsId,
        ...(bowlerId ? { selectedBowlerId: bowlerId } : {}),
      },
    });
  }

  function promptBowlerIfNeeded(live: NonNullable<typeof inn>): void {
    if (!needsBowlerSelection(live, live.currentBowlerId)) return;
    openBowlerPicker(live);
  }

  function syncFromCard(updated: ScorecardResponse, opts: { promptBowlers?: boolean } = {}): void {
    const { promptBowlers = true } = opts;
    setCard(updated);
    const live = updated.innings.at(-1);
    if (!live) return;
    setStrikerId(live.currentStrikerId);
    setNonStrikerId(live.currentNonStrikerId);
    setBattingSlots((prev) => syncBattingSlots(live, match, prev));
    setBowlerId(live.currentBowlerId);
    pendingIncomingRef.current = false;
    if (live.currentBowlerId) {
      pendingBowlerRef.current = false;
    }
    if (promptBowlers && !needIncomingBatter(live)) {
      promptBowlerIfNeeded(live);
    }
    promptIncomingIfNeeded(live);
  }

  function participantsBodyFromPick(
    pick: ScoringPickResult,
    expectedVersion: number,
  ): SetInningsParticipantsRequest {
    const body: SetInningsParticipantsRequest = { expectedVersion };
    if (pick.kind === 'bowler') {
      body.bowlerId = pick.userId;
    } else if (pick.incomingSlot === 'striker' || pick.role === BatsmanPickerRole.Striker) {
      body.strikerId = pick.userId;
    } else if (pick.incomingSlot === 'nonStriker' || pick.role === BatsmanPickerRole.NonStriker) {
      body.nonStrikerId = pick.userId;
    }
    return body;
  }

  useFocusEffect(
    useCallback(() => {
      const pick = consumeScoringPickResult();
      const snapshot = cardRef.current;
      if (pick && matchId) {
        if (snapshot == null) {
          setScoringPickResult(pick);
          return;
        }

        const liveInnings = snapshot.innings.at(-1);
        const inningsId = liveInnings?.inningsId;
        if (!inningsId) {
          setScoringPickResult(pick);
          setError('Could not save player selection — innings not found.');
          return;
        }

        if (pick.kind === 'bowler') {
          setBowlerId(pick.userId);
          pendingBowlerRef.current = false;
        } else {
          setBattingSlots((prev) => applyBattingSlotPick(pick, prev));
        }

        void (async () => {
          setWorking(true);
          setError(null);
          try {
            syncFromCard(
              await setInningsParticipants(
                matchId,
                inningsId,
                participantsBodyFromPick(pick, snapshot.version),
              ),
              { promptBowlers: false },
            );
          } catch (err) {
            if (err instanceof ApiRequestError) {
              setError(err.message);
              if (err.status === 409) {
                syncFromCard(await getScorecard(matchId), { promptBowlers: false });
              } else if (pick.kind === 'bowler') {
                setBowlerId(liveInnings?.currentBowlerId ?? null);
                if (liveInnings && needsBowlerSelection(liveInnings, liveInnings.currentBowlerId)) {
                  pendingBowlerRef.current = false;
                }
              }
            } else {
              setError('Could not save player selection.');
              if (pick.kind === 'bowler') {
                setBowlerId(liveInnings?.currentBowlerId ?? null);
              }
            }
          } finally {
            setWorking(false);
          }
        })();
        return;
      }

      if (pendingBowlerRef.current) {
        pendingBowlerRef.current = false;
      }

      if (matchId && !loading) {
        if (skipNextFocusLoadRef.current) {
          skipNextFocusLoadRef.current = false;
          return;
        }
        void load();
      }
    }, [load, loading, matchId]),
  );

  const nameOf = useMemo((): NameResolver => {
    const players = new Map<string, string>();
    if (match) {
      for (const squad of match.squads) {
        for (const p of squad.players) players.set(p.userId, `${p.firstName} ${p.lastName}`);
      }
      for (const external of match.externalPlayers ?? []) {
        players.set(external.id, external.name);
      }
    }
    return (id) => (id ? (players.get(id) ?? 'Player') : '—');
  }, [match]);

  const battingTeamId = inn?.battingTeamId ?? match?.battingFirstTeamId ?? null;
  const bowlingTeamId = inn?.bowlingTeamId ?? match?.bowlingFirstTeamId ?? null;
  const canChangeTarget = Boolean(
    card?.innings[0]?.closed && card.innings.length >= 2,
  );
  const penaltyTeamOptions = useMemo(() => {
    const options: { teamId: string; label: string }[] = [];
    if (match?.homeTeamId && match.homeTeamName) {
      options.push({ teamId: match.homeTeamId, label: match.homeTeamName });
    }
    if (match?.awayTeamId && match.awayTeamName) {
      options.push({ teamId: match.awayTeamId, label: match.awayTeamName });
    }
    if (options.length === 0 && battingTeamId) {
      options.push({ teamId: battingTeamId, label: 'Batting' });
    }
    if (bowlingTeamId && !options.some((o) => o.teamId === bowlingTeamId)) {
      options.push({ teamId: bowlingTeamId, label: 'Bowling' });
    }
    return options;
  }, [battingTeamId, bowlingTeamId, match?.awayTeamId, match?.awayTeamName, match?.homeTeamId, match?.homeTeamName]);

  const battingSquad = useMemo(
    () => match?.squads.find((s) => s.teamId === battingTeamId)?.players.filter((p) => p.role === 'PLAYING_XI') ?? [],
    [battingTeamId, match?.squads],
  );
  const bowlingSquad = useMemo(
    () => match?.squads.find((s) => s.teamId === bowlingTeamId)?.players.filter((p) => p.role === 'PLAYING_XI') ?? [],
    [bowlingTeamId, match?.squads],
  );

  const battersReady = Boolean(strikerId && nonStrikerId);
  const needsIncomingBatter = Boolean(inn && needIncomingBatter(inn));
  const needsBowlerForNewOver = Boolean(
    inn && needsBowlerSelection(inn, bowlerId ?? inn.currentBowlerId) && battersReady,
  );
  const openersReady = battersReady && Boolean(bowlerId);
  const inningsAllOut = Boolean(inn && isInningsAllOut(inn));

  useEffect(() => {
    if (loading || !inn?.inningsId || inn.closed) return;
    if (!needsBowlerSelection(inn, bowlerId ?? inn.currentBowlerId)) return;
    if (needsIncomingBatter) return;
    if (pendingBowlerRef.current) return;
    promptBowlerIfNeeded(inn);
  }, [loading, inn?.inningsId, inn?.legalBalls, inn?.closed, inn?.currentBowlerId, bowlerId, needsIncomingBatter]);

  useEffect(() => {
    if (loading || !inn?.inningsId || inn.closed) return;
    if (battersReady) return;
    if (!needIncomingBatter(inn) || pendingIncomingRef.current) return;
    promptIncomingIfNeeded(inn);
  }, [
    loading,
    inn?.inningsId,
    inn?.legalBalls,
    inn?.closed,
    inn?.wickets,
    battersReady,
    strikerId,
    nonStrikerId,
  ]);
  async function applyAdminMutation(action: () => Promise<ScorecardResponse>): Promise<void> {
    if (!matchId || !card) return;
    setWorking(true);
    setError(null);
    try {
      syncFromCard(await action());
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        if (err.status === 409) {
          syncFromCard(await getScorecard(matchId));
        }
      } else {
        setError('Could not save change.');
      }
    } finally {
      setWorking(false);
    }
  }

  function closeMoreFlows(): void {
    setShowMore(false);
    setMoreAction(null);
  }

  function backToMoreOptions(): void {
    setMoreAction(null);
    setShowMore(true);
  }

  function handleMoreSelect(action: MoreOptionsAction): void {
    setShowMore(false);
    if (action === 'CHANGE_TARGET' && !canChangeTarget) {
      setShowChangeTargetBlocked(true);
      return;
    }
    if (action === 'END_INNINGS') {
      endInningsPromptDismissedRef.current = false;
      setShowEndInningsConfirm(true);
      return;
    }
    setMoreAction(action);
  }

  const inningsTransitionPending = useMemo(
    () => isInningsTransitionPending(match, card),
    [match, card],
  );

  useEffect(() => {
    if (
      inningsTransitionPending &&
      !showEndInningsConfirm &&
      !working &&
      !endInningsPromptDismissedRef.current
    ) {
      setShowEndInningsConfirm(true);
    }
  }, [inningsTransitionPending, showEndInningsConfirm, working]);

  const completedResultLine = useMemo(() => {
    if (match?.state === 'COMPLETED' && match.resultNote) {
      return match.resultNote;
    }
    if (!card?.result.decided || !match) return null;
    const winnerId = card.result.winningTeamId;
    const winnerName =
      match.squads.find((s) => s.teamId === winnerId)?.teamName ??
      (winnerId === match.homeTeamId ? match.homeTeamName : match.awayTeamName) ??
      'Winner';
    return formatMatchResultNote(winnerName, card.result);
  }, [card?.result, match]);

  async function confirmEndInnings(): Promise<void> {
    const inningsId = inn?.inningsId;
    if (!matchId || !card || !inningsId) return;
    setShowEndInningsConfirm(false);
    closeMoreFlows();
    setWorking(true);
    setError(null);
    try {
      const updated = await endInnings(matchId, inningsId, { expectedVersion: card.version });
      syncFromCard(updated, { promptBowlers: false });
      const refreshedMatch = await getMatch(matchId);
      setMatch(refreshedMatch);

      const live = updated.innings.at(-1);
      if (live && !live.closed && !live.currentStrikerId) {
        setStrikerId(null);
        setNonStrikerId(null);
        setBowlerId(null);
        setBattingSlots({ batsman1Id: null, batsman2Id: null });
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        if (err.status === 409) {
          const refreshed = await getScorecard(matchId);
          syncFromCard(refreshed);
          setMatch(await getMatch(matchId));
        }
      } else {
        setError('Could not end the innings.');
      }
    } finally {
      setWorking(false);
    }
  }

  function cancelEndInningsConfirm(): void {
    setShowEndInningsConfirm(false);
    endInningsPromptDismissedRef.current = true;
    closeMoreFlows();
  }
  const matchDecided = Boolean(card?.result.decided && match?.state === 'COMPLETED');
  const matchLabel =
    match?.homeTeamName && (match?.awayTeamName || match?.externalOpponentName)
      ? `${match.homeTeamName} vs ${match.awayTeamName ?? match.externalOpponentName}`
      : (match?.homeTeamName ?? 'Match');
  const matchTypeLabel = match?.matchType ? MATCH_TYPE_LABELS[match.matchType] : '';

  async function applyMutation(
    action: () => Promise<ScorecardResponse>,
    opts: { promptBowlers?: boolean } = {},
  ): Promise<void> {
    if (!matchId || !card || !inn?.inningsId) return;
    setWorking(true);
    setError(null);
    try {
      syncFromCard(await action(), opts);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        if (err.status === 409) {
          syncFromCard(await getScorecard(matchId), opts);
        }
      } else {
        setError('Could not update the scorecard.');
      }
    } finally {
      setWorking(false);
    }
  }

  async function record(
    body: Omit<RecordDeliveryRequest, 'expectedVersion'>,
    opts: { promptBowlers?: boolean } = {},
  ): Promise<void> {
    const isPenalty = body.type === DeliveryType.PenaltyRuns;
    const isCatchDrop = body.type === DeliveryType.CatchDrop;
    if (needsIncomingBatter) {
      setError('Select the incoming batter before scoring.');
      openBatsmanPicker('incoming');
      return;
    }
    if (!battersReady) {
      setError('Select both batters before scoring.');
      return;
    }
    if (!isPenalty && !bowlerId) {
      setError('Select the bowler for this over before scoring.');
      openBowlerPicker();
      return;
    }
    if (isCatchDrop && !body.fielderId) {
      setError('Select the fielder who dropped the catch.');
      return;
    }
    if (!matchId || !card || !inn) return;
    const inningsId = inn.inningsId;
    if (!inningsId) return;
    await applyMutation(
      () =>
        recordDelivery(matchId, inningsId, {
          ...body,
          strikerId,
          nonStrikerId,
          bowlerId,
          expectedVersion: card.version,
        }),
      isPenalty ? { promptBowlers: false, ...opts } : opts,
    );
  }

  async function recordWicket(result: WicketDismissalResult): Promise<void> {
    const promoteSurvivorToStriker =
      result.batsmenCrossed &&
      result.dismissalType === DismissalType.Caught &&
      result.dismissedId === strikerId &&
      nonStrikerId;

    if (result.flowType === WicketFlowType.Retired) {
      if (result.isRetiredHurt) {
        await record({
          type: DeliveryType.RetiredHurt,
          dismissal: { type: DismissalType.RetiredOut, dismissedId: result.dismissedId },
        });
      } else {
        await record({
          type: DeliveryType.RetiredOut,
          dismissal: { type: DismissalType.RetiredOut, dismissedId: result.dismissedId },
        });
      }
      return;
    }

    if (result.flowType === WicketFlowType.Mankad) {
      await record({
        type: DeliveryType.Mankad,
        dismissal: {
          type: DismissalType.RunOut,
          dismissedId: result.dismissedId,
          fielderId: bowlerId,
        },
      });
      return;
    }

    if (isBowlerCreditedStrikerOutFlow(result.flowType)) {
      await record({
        type: DeliveryType.Legal,
        runsBat: 0,
        dismissal: {
          type: result.dismissalType,
          dismissedId: result.dismissedId,
          fielderId: null,
        },
      });
      return;
    }

    if (result.dismissalType === DismissalType.Stumped) {
      await record({
        type: result.stumpedOffWide ? DeliveryType.Wide : DeliveryType.Legal,
        runsBat: 0,
        ...(result.stumpedOffWide ? { extraRuns: 1 } : {}),
        dismissal: {
          type: DismissalType.Stumped,
          dismissedId: result.dismissedId,
          fielderId: result.fielderId,
        },
      });
      return;
    }

    if (result.dismissalType === DismissalType.RunOut) {
      await record(buildRunOutDelivery(result));
      return;
    }

    await record({
      type: DeliveryType.Legal,
      runsBat: result.runsBat,
      dismissal: {
        type: result.dismissalType,
        dismissedId: result.dismissedId,
        fielderId: result.fielderId,
      },
    });

    if (promoteSurvivorToStriker && matchId && inn?.inningsId) {
      const version = cardRef.current?.version;
      if (version == null) return;
      await applyMutation(() =>
        setInningsParticipants(matchId, inn.inningsId!, {
          strikerId: nonStrikerId,
          expectedVersion: version,
        }),
      );
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <ScreenHeader compact />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      </SafeAreaView>
    );
  }

  const batsman1Card = inn?.batters.find((b) => b.playerId === battingSlots.batsman1Id);
  const batsman2Card = inn?.batters.find((b) => b.playerId === battingSlots.batsman2Id);
  const bowlerCard = inn?.bowlers.find((b) => b.playerId === bowlerId);
  const keypadDisabled = working || !openersReady || Boolean(inn?.closed);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader compact />
      <View className="min-h-0 flex-1">
        {!inn ? (
          <View className="flex-1 justify-center px-4">
            {error ? (
              <View className="mb-3 rounded-control bg-primary-50 px-3 py-2">
                <Text className="font-sans text-xs text-primary">{error}</Text>
              </View>
            ) : null}
            <View className="rounded-control border border-outline-variant bg-surface p-4">
              <Text className="font-sans text-sm text-on-surface">
                Start the match from your dashboard (Start Match → toss) before scoring.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <ScrollView
              className="min-h-0 flex-1"
              contentContainerClassName="gap-2 px-4 pb-2 pt-1"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {error ? (
                <View className="rounded-control bg-primary-50 px-3 py-2">
                  <Text className="font-sans text-xs text-primary">{error}</Text>
                </View>
              ) : null}

              <LiveScoringHeader
                compact
                matchLabel={matchLabel}
                matchTypeLabel={matchTypeLabel}
                innings={inn}
                totalOvers={
                  resolveOversAllotment(
                    inn.oversAllotted,
                    card?.innings[0]?.oversAllotted,
                    match?.oversPerInnings,
                  )
                }
                showRunStats={openersReady}
              />

              <LiveScoringPlayerCards
                compact
                batsman1Id={battingSlots.batsman1Id}
                batsman2Id={battingSlots.batsman2Id}
                onStrikePlayerId={inn.currentStrikerId}
                bowlerId={bowlerId}
                batsman1Card={batsman1Card}
                batsman2Card={batsman2Card}
                bowlerCard={bowlerCard}
                needsIncomingBatter={needsIncomingBatter}
                needsBowlerPick={needsBowlerForNewOver}
                extras={inn.extras}
                nameOf={nameOf}
                onOpenBatsmanPicker={openBatsmanPickerFromBatIcon}
                onPickBatsman1={() => openBatsmanPicker('striker')}
                onPickBatsman2={() => openBatsmanPicker('nonStriker')}
                onPickBowler={() => openBowlerPicker()}
              />

              {matchDecided ? (
                <View className="rounded-control border border-primary bg-primary-container px-3 py-1.5">
                  <Text className="font-sans-semibold text-[11px] text-on-primary-container">
                    {completedResultLine ?? 'Match complete'}
                  </Text>
                </View>
              ) : null}

              {inn && inn.inningsType === InningsType.SuperOver && !openersReady && !inn.closed ? (
                <View className="rounded-control border border-primary bg-primary-container px-3 py-1.5">
                  <Text className="font-sans-semibold text-[11px] text-on-primary-container">
                    Super Over — select batters and bowler (2 wickets ends the innings)
                  </Text>
                </View>
              ) : null}

              {inn &&
              inn.inningsType === InningsType.Normal &&
              inn.sequence === 1 &&
              !openersReady &&
              !inn.closed ? (
                <View className="rounded-control border border-primary bg-primary-container px-3 py-1.5">
                  <Text className="font-sans-semibold text-[11px] text-on-primary-container">
                    Select opening batters and bowler to start scoring
                  </Text>
                </View>
              ) : null}

              {inn &&
              inn.inningsType === InningsType.Normal &&
              inn.sequence > 1 &&
              !openersReady &&
              !inn.closed ? (
                <View className="rounded-control border border-primary bg-primary-container px-3 py-1.5">
                  <Text className="font-sans-semibold text-[11px] text-on-primary-container">
                    Select opening batters and bowler for the chase
                  </Text>
                </View>
              ) : null}

              {needsIncomingBatter ? (
                <View className="rounded-control border border-primary bg-primary-container px-3 py-1.5">
                  <Text className="font-sans-semibold text-[11px] text-on-primary-container">
                    Select incoming batter
                  </Text>
                </View>
              ) : null}

              {inningsAllOut ? (
                <View className="rounded-control border border-outline-variant bg-surface-container-low px-3 py-1.5">
                  <Text className="font-sans-semibold text-[11px] text-on-surface">
                    All out ({WICKETS_FOR_ALL_OUT} wickets)
                  </Text>
                </View>
              ) : null}

              {needsBowlerForNewOver ? (
                <View className="rounded-control border border-primary bg-primary-container px-3 py-1.5">
                  <Text className="font-sans-semibold text-[11px] text-on-primary-container">
                    Select next bowler
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View className="flex-shrink-0 px-4 pb-1 pt-1">
              <LiveScoringKeypad
                compact
                disabled={keypadDisabled}
                timeline={inn.timeline}
                onRuns={(runs, isBoundary) =>
                  void record({ type: DeliveryType.Legal, runsBat: runs, isBoundary })
                }
                onWicket={() => setShowWicket(true)}
                onWide={() => setShowWide(true)}
                onNoBall={() => setShowNoBall(true)}
                onLegBye={() => setShowLegByes(true)}
                onBye={() => setShowByes(true)}
                onBonus={() => setShowBonus(true)}
                onUndo={() => {
                  const inningsId = inn.inningsId;
                  if (!matchId || !card || !inningsId) return;
                  void applyMutation(() =>
                    undoLastDelivery(matchId, inningsId, {
                      expectedVersion: card.version,
                    }),
                  );
                }}
                onMore={() => setShowMore(true)}
                onCatchDrop={() => setShowCatchDrop(true)}
              />
            </View>
          </>
        )}
      </View>

      <CatchDropFielderPicker
        visible={showCatchDrop}
        matchId={matchId ?? ''}
        inningsId={inn?.inningsId ?? ''}
        onCancel={() => setShowCatchDrop(false)}
        onConfirm={(fielderId) => {
          setShowCatchDrop(false);
          void record({
            type: DeliveryType.CatchDrop,
            fielderId,
          });
        }}
      />

      <WicketDismissalSheet
        visible={showWicket}
        matchId={matchId ?? ''}
        inningsId={inn?.inningsId ?? ''}
        freeHitActive={Boolean(inn?.freeHitNext)}
        strikerId={strikerId}
        nonStrikerId={nonStrikerId}
        bowlerId={bowlerId}
        battingSquad={battingSquad}
        bowlingSquad={bowlingSquad}
        nameOf={nameOf}
        onCancel={() => setShowWicket(false)}
        onConfirm={(result) => {
          setShowWicket(false);
          void recordWicket(result);
        }}
      />

      <ByesDialog
        visible={showByes}
        onCancel={() => setShowByes(false)}
        onSelect={(extraRuns) => {
          setShowByes(false);
          void record({ type: DeliveryType.Bye, extraRuns });
        }}
      />

      <WideBallDialog
        visible={showWide}
        onCancel={() => setShowWide(false)}
        onSelect={(ranPortion) => {
          setShowWide(false);
          void record({ type: DeliveryType.Wide, extraRuns: 1 + ranPortion });
        }}
      />

      <NoBallDialog
        visible={showNoBall}
        onCancel={() => setShowNoBall(false)}
        onSelect={(selection) => {
          setShowNoBall(false);
          void record(buildNoBallDelivery(selection));
        }}
      />

      <LegByesDialog
        visible={showLegByes}
        onCancel={() => setShowLegByes(false)}
        onSelect={(extraRuns) => {
          setShowLegByes(false);
          void record({ type: DeliveryType.LegBye, extraRuns });
        }}
      />

      <BonusRunsDialog
        visible={showBonus}
        onCancel={() => setShowBonus(false)}
        onSelect={(extraRuns) => {
          setShowBonus(false);
          void record({ type: DeliveryType.PenaltyRuns, extraRuns });
        }}
      />

      <MoreOptionsModal
        visible={showMore}
        onCancel={() => setShowMore(false)}
        onSelect={handleMoreSelect}
      />

      <ChangeTargetBlockedDialog
        visible={showChangeTargetBlocked}
        onClose={() => setShowChangeTargetBlocked(false)}
      />

      <EndInningsConfirmDialog
        visible={showEndInningsConfirm}
        onCancel={cancelEndInningsConfirm}
        onConfirm={() => {
          void confirmEndInnings();
        }}
      />

      <PenaltyRunsDialog
        visible={moreAction === 'PENALTY'}
        teamOptions={penaltyTeamOptions}
        onCancel={closeMoreFlows}
        onConfirm={(teamId) => {
          closeMoreFlows();
          void record({
            type: DeliveryType.PenaltyRuns,
            extraRuns: STANDARD_MATCH_PENALTY_RUNS,
            penaltyBeneficiaryTeamId: teamId,
          });
        }}
      />

      <ChangeTargetDialog
        visible={moreAction === 'CHANGE_TARGET'}
        currentTarget={card?.effectiveTarget ?? inn?.target ?? null}
        onCancel={closeMoreFlows}
        onConfirm={(target) => {
          if (!matchId || !card) return;
          closeMoreFlows();
          void applyAdminMutation(() =>
            setDlsTarget(matchId, {
              dlsTarget: target,
              originalTarget: card.originalTarget ?? card.effectiveTarget ?? target,
              expectedVersion: card.version,
            }),
          );
        }}
      />

      <ChangeOversDialog
        visible={moreAction === 'CHANGE_OVERS'}
        currentOvers={resolveOversAllotment(
          inn?.oversAllotted,
          card?.innings[0]?.oversAllotted,
          match?.oversPerInnings,
        )}
        minOversBowled={minimumOversAllotmentFromLegalBalls(inn?.legalBalls ?? 0)}
        onBack={backToMoreOptions}
        onConfirm={(oversAllotted) => {
          const inningsId = inn?.inningsId;
          if (!matchId || !card || !inningsId) return;
          closeMoreFlows();
          void applyAdminMutation(() =>
            setOversAllotted(matchId, {
              inningsId,
              oversAllotted,
              expectedVersion: card.version,
            }),
          );
        }}
      />
    </SafeAreaView>
  );
}
