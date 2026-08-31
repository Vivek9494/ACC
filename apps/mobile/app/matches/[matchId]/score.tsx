import {
  formatMatchResultNote,
  replaceGenericHomeAwayInResultNote,
  resolveMatchWinnerDisplayName,
  MatchState,
  MatchSquadRole,
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
  type InningsScorecard,
  resolveOversAllotment,
  type ScorecardResponse,
  type ScorerRevokedReason,
  type SetInningsParticipantsRequest,
  type SquadPlayerView,
} from '@acc/types';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BonusRunsDialog } from '../../../src/components/scoring/BonusRunsDialog';
import { CatchDropFielderPicker } from '../../../src/components/scoring/CatchDropFielderPicker';
import { DroppedCatchCardSection } from '../../../src/components/scoring/DroppedCatchCardSection';
import { MoreOptionsModal, type MoreOptionsAction } from '../../../src/components/scoring/MoreOptionsModal';
import { PenaltyRunsDialog } from '../../../src/components/scoring/PenaltyRunsDialog';
import {
  ChangeOversDialog,
  ChangeTargetBlockedDialog,
  ChangeTargetDialog,
  EndInningsConfirmDialog,
  ScoringNotAllowedDialog,
} from '../../../src/components/scoring/ScoringAdminDialogs';
import { ByesDialog } from '../../../src/components/scoring/ByesDialog';
import { LegByesDialog } from '../../../src/components/scoring/LegByesDialog';
import { NoBallDialog, type NoBallSelection } from '../../../src/components/scoring/NoBallDialog';
import { WideBallDialog } from '../../../src/components/scoring/WideBallDialog';
import { LiveScoringHeader } from '../../../src/components/scoring/LiveScoringHeader';
import { LiveScoringKeypad } from '../../../src/components/scoring/LiveScoringKeypad';
import { LiveScoringPlayerCards } from '../../../src/components/scoring/LiveScoringPlayerCards';
import { LiveScoringScorecardTab } from '../../../src/components/scoring/LiveScoringScorecardTab';
import { ScoringCockpit } from '../../../src/components/scoring/cockpit/ScoringCockpit';
import {
  CockpitSettingsHeaderButton,
  CockpitSettingsModal,
} from '../../../src/components/scoring/cockpit/CockpitSettingsModal';
import {
  ConfirmNextBowlerDialog,
  EndOverConfirmDialog,
  upcomingOverNumber,
} from '../../../src/components/scoring/cockpit/EndOverFlowDialogs';
import { ScorerRevokedDialog } from '../../../src/components/scoring/ScorerRevokedDialog';
import {
  WicketDismissalSheet,
  WicketFlowType,
  isBowlerCreditedStrikerOutFlow,
  type WicketDismissalResult,
} from '../../../src/components/scoring/WicketDismissalSheet';
import type { RunOutExtraOption } from '../../../src/components/scoring/RunOutDetailsDialog';
import { Button } from '../../../src/components/ui/Button';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import {
  ApiRequestError,
  endInnings,
  enterScoringSession,
  getMatch,
  getScorecard,
  recordDelivery,
  setDeliveryShotPlacement,
  setDlsTarget,
  setInningsParticipants,
  setOversAllotted,
  startScoring,
  undoLastDelivery,
} from '../../../src/lib/api';
import { isInningsTransitionPending } from '../../../src/lib/match-completion';
import {
  consumeScoringPickResult,
  setScoringPickResult,
  type ScoringPickResult,
} from '../../../src/lib/scoring-pick-session';
import {
  beginExplicitPickerNavigation,
  clearPickerNavigationGuard,
  handlePickerDismissWithoutSelection,
  isPickerAutoPromptSuppressed,
} from '../../../src/lib/scoring-picker-navigation';
import { useAuth } from '../../../src/lib/auth-context';
import { useDesktopLayout } from '../../../src/lib/desktop-layout';
import { homeRouteForUser } from '../../../src/lib/home-route';
import { useMatchScorerRevokeListener } from '../../../src/lib/live-socket';

type ScoringViewTab = 'live' | 'scorecard';

const SCORING_VIEW_TAB_OPTIONS = [
  { value: 'live' as const, label: 'Live' },
  { value: 'scorecard' as const, label: 'Scorecard' },
] as const;

function incomingBatterAutoPromptKey(live: InningsScorecard): string {
  return `${live.legalBalls}:${live.wickets}:${live.currentStrikerId ?? ''}:${live.currentNonStrikerId ?? ''}`;
}

/** Delivery types that consume a legal ball (count toward the over) — matches engine fold. */
function deliveryCountsAsLegalBall(
  body: Omit<RecordDeliveryRequest, 'expectedVersion'>,
): boolean {
  return (
    body.type === DeliveryType.Legal ||
    body.type === DeliveryType.Bye ||
    body.type === DeliveryType.LegBye
  );
}

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

function scoringWriteErrorMessage(err: ApiRequestError): string {
  if (err.status === 403) {
    return err.message || 'You are not authorized to score this match.';
  }
  return err.message;
}

const SCORING_NOT_ALLOWED_MESSAGE =
  'The match is not live; scoring is not allowed in its current state';

function isScoringNotAllowedError(err: ApiRequestError): boolean {
  return err.error.code === 'MATCH_NOT_LIVE' || err.message === SCORING_NOT_ALLOWED_MESSAGE;
}

function isScoringNotAllowedMessage(message: string): boolean {
  return message === SCORING_NOT_ALLOWED_MESSAGE;
}

function isMatchScoringAllowed(match: Pick<MatchDetail, 'state'> | null): boolean {
  return match?.state === 'LIVE' || match?.state === 'RAIN_INTERRUPTED';
}

type NameResolver = (id: string | null | undefined) => string;

interface BattingSlots {
  batsman1Id: string | null;
  batsman2Id: string | null;
}

/**
 * Keep UI row slots stable across strike rotations: clear leavers, then place any
 * at-crease player who is not already shown into a vacant slot (parity with reload).
 */
function syncBattingSlots(
  live: { currentStrikerId: string | null; currentNonStrikerId: string | null },
  match: MatchDetail | null,
  prev: BattingSlots,
): BattingSlots {
  const atCreaseIds = [live.currentStrikerId, live.currentNonStrikerId].filter(
    (id): id is string => Boolean(id),
  );
  const atCrease = new Set(atCreaseIds);

  let batsman1Id = prev.batsman1Id;
  let batsman2Id = prev.batsman2Id;

  if (batsman1Id && !atCrease.has(batsman1Id)) batsman1Id = null;
  if (batsman2Id && !atCrease.has(batsman2Id)) batsman2Id = null;

  if (!batsman1Id && !batsman2Id) {
    batsman1Id = match?.openingStrikerUserId ?? live.currentStrikerId;
    batsman2Id = match?.openingNonStrikerUserId ?? live.currentNonStrikerId;
    if (batsman1Id && !atCrease.has(batsman1Id)) batsman1Id = null;
    if (batsman2Id && !atCrease.has(batsman2Id)) batsman2Id = null;
  }

  const placed = new Set(
    [batsman1Id, batsman2Id].filter((id): id is string => Boolean(id)),
  );
  for (const id of atCreaseIds) {
    if (placed.has(id)) continue;
    if (!batsman1Id) {
      batsman1Id = id;
      placed.add(id);
    } else if (!batsman2Id) {
      batsman2Id = id;
      placed.add(id);
    }
  }

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
  const { user, status: authStatus } = useAuth();
  const { isDesktop } = useDesktopLayout();
  const useCockpit = Platform.OS === 'web' && isDesktop;

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [card, setCard] = useState<ScorecardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [scorerRevokedOpen, setScorerRevokedOpen] = useState(false);
  const [scorerRevokedReason, setScorerRevokedReason] = useState<ScorerRevokedReason | undefined>(
    undefined,
  );
  const [scoringViewTab, setScoringViewTab] = useState<ScoringViewTab>('live');
  const [sessionBlocked, setSessionBlocked] = useState<string | null>(null);
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
  const [showCockpitSettings, setShowCockpitSettings] = useState(false);
  const [moreAction, setMoreAction] = useState<MoreOptionsAction | null>(null);
  const [showChangeTargetBlocked, setShowChangeTargetBlocked] = useState(false);
  const [showEndInningsConfirm, setShowEndInningsConfirm] = useState(false);
  const [scoringBlockedOpen, setScoringBlockedOpen] = useState(false);
  const [scoringBlockedMessage, setScoringBlockedMessage] = useState(SCORING_NOT_ALLOWED_MESSAGE);
  /** Desktop end-of-over: hold 6th legal ball until Dialog 2 OK commits it. */
  const [endOverStep, setEndOverStep] = useState<'confirm' | 'bowler' | null>(null);
  const [endOverPending, setEndOverPending] = useState<{
    body: Omit<RecordDeliveryRequest, 'expectedVersion'>;
    strikerId: string | null;
    nonStrikerId: string | null;
    bowlerId: string | null;
    legalBalls: number;
  } | null>(null);
  const [endOverConfirming, setEndOverConfirming] = useState(false);
  const endInningsPromptDismissedRef = useRef(false);
  const pendingBatsmanPickerRef = useRef(false);
  const pendingBowlerRef = useRef(false);
  /** Suppress auto incoming-batsman prompt after user backs out of the picker. */
  const batsmanAutoPromptSuppressedKeyRef = useRef<string | null>(null);
  /** Suppress auto bowler prompt after user backs out of picker at this legalBalls count. */
  const bowlerAutoPromptSuppressedForBallsRef = useRef<number | null>(null);
  const skipNextFocusLoadRef = useRef(true);
  const cardRef = useRef<ScorecardResponse | null>(null);
  cardRef.current = card;

  const dismissScoringBlocked = useCallback(() => {
    setScoringBlockedOpen(false);
  }, []);

  const showScoringBlocked = useCallback((message: string = SCORING_NOT_ALLOWED_MESSAGE) => {
    setScoringBlockedMessage(message);
    setScoringBlockedOpen(true);
    setError(null);
  }, []);

  const reportWriteError = useCallback(
    (err: unknown, fallback: string): void => {
      if (err instanceof ApiRequestError && isScoringNotAllowedError(err)) {
        showScoringBlocked(err.message || SCORING_NOT_ALLOWED_MESSAGE);
        return;
      }
      if (err instanceof ApiRequestError) {
        setError(scoringWriteErrorMessage(err));
        return;
      }
      setError(fallback);
    },
    [showScoringBlocked],
  );

  const load = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    setSessionBlocked(null);
    try {
      await enterScoringSession(matchId);
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
      if (err instanceof ApiRequestError && err.status === 403) {
        setSessionBlocked(err.message);
        setMatch(null);
        setCard(null);
      } else {
        setError(err instanceof ApiRequestError ? err.message : 'Could not load match.');
      }
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (authStatus === 'loading') {
      return;
    }
    void load();
  }, [load, authStatus]);

  const handleScorerRevoked = useCallback((reason?: ScorerRevokedReason) => {
    setScorerRevokedReason(reason);
    setScorerRevokedOpen(true);
  }, []);

  const dismissScorerRevoked = useCallback(() => {
    setScorerRevokedOpen(false);
    setScorerRevokedReason(undefined);
    router.replace(homeRouteForUser(user));
  }, [router, user]);

  useMatchScorerRevokeListener(matchId, user?.id, handleScorerRevoked);

  const inn = card?.innings.at(-1) ?? null;

  const canCompleteScoringSetup =
    !inn &&
    match?.state === 'LIVE' &&
    match.tossWinner != null &&
    match.tossDecision != null;

  async function completeScoringSetup(): Promise<void> {
    if (!matchId || !match?.tossWinner || !match.tossDecision) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await startScoring(matchId, {
        tossWinner: match.tossWinner,
        decision: match.tossDecision,
      });
      await load();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Could not open the first innings.',
      );
    } finally {
      setWorking(false);
    }
  }

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
    if (!matchId || !liveInnings?.inningsId || pendingBatsmanPickerRef.current) return;
    if (!isMatchScoringAllowed(match)) {
      showScoringBlocked();
      return;
    }
    beginExplicitPickerNavigation(
      pendingBatsmanPickerRef,
      batsmanAutoPromptSuppressedKeyRef,
      skipNextFocusLoadRef,
    );
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
    if (!needIncomingBatter(live) || pendingBatsmanPickerRef.current) return;
    if (isPickerAutoPromptSuppressed(batsmanAutoPromptSuppressedKeyRef, incomingBatterAutoPromptKey(live))) {
      return;
    }
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

  function promptBowlerIfNeeded(live: NonNullable<typeof inn>): void {
    if (!needsBowlerSelection(live, live.currentBowlerId)) return;
    if (isPickerAutoPromptSuppressed(bowlerAutoPromptSuppressedForBallsRef, live.legalBalls)) return;
    if (useCockpit) {
      openDesktopNextBowlerDialog(live);
      return;
    }
    openBowlerPicker(live);
  }

  /** Desktop recovery / end-over: Dialog 2 without navigating to the full-page picker. */
  function openDesktopNextBowlerDialog(
    liveInnings: NonNullable<typeof inn> | null = inn,
  ): void {
    if (!matchId || !liveInnings?.inningsId) return;
    if (endOverStep != null) return;
    if (!isMatchScoringAllowed(match)) {
      showScoringBlocked();
      return;
    }
    bowlerAutoPromptSuppressedForBallsRef.current = null;
    setEndOverPending(null);
    setEndOverStep('bowler');
  }

  function clearEndOverFlow(opts: { suppressBowlerAutoPrompt?: boolean } = {}): void {
    if (opts.suppressBowlerAutoPrompt && inn) {
      bowlerAutoPromptSuppressedForBallsRef.current = inn.legalBalls;
    }
    setEndOverStep(null);
    setEndOverPending(null);
    setEndOverConfirming(false);
  }

  function openBowlerPicker(liveInnings: NonNullable<typeof inn> | null = inn): void {
    if (!matchId || !liveInnings?.inningsId || pendingBowlerRef.current) return;
    if (!isMatchScoringAllowed(match)) {
      showScoringBlocked();
      return;
    }
    if (useCockpit && needsBowlerSelection(liveInnings, bowlerId ?? liveInnings.currentBowlerId)) {
      openDesktopNextBowlerDialog(liveInnings);
      return;
    }
    beginExplicitPickerNavigation(
      pendingBowlerRef,
      bowlerAutoPromptSuppressedForBallsRef,
      skipNextFocusLoadRef,
    );
    router.push({
      pathname: '/matches/[matchId]/select-bowler',
      params: {
        matchId,
        inningsId: liveInnings.inningsId,
        ...(bowlerId ? { selectedBowlerId: bowlerId } : {}),
      },
    });
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
    if (!needIncomingBatter(live)) {
      clearPickerNavigationGuard(pendingBatsmanPickerRef, batsmanAutoPromptSuppressedKeyRef);
    }
    if (live.currentBowlerId) {
      clearPickerNavigationGuard(pendingBowlerRef, bowlerAutoPromptSuppressedForBallsRef);
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

  /** Desktop Play Control — same setInningsParticipants write as the full-page batsman picker. */
  function selectBatterInline(role: 'striker' | 'nonStriker', userId: string): void {
    const snapshot = card;
    const liveInnings = inn;
    const inningsId = liveInnings?.inningsId;
    if (!matchId || !snapshot || !inningsId) return;
    if (!isMatchScoringAllowed(match)) {
      showScoringBlocked();
      return;
    }
    const pick: ScoringPickResult = {
      kind: 'batsman',
      role: role === 'striker' ? BatsmanPickerRole.Striker : BatsmanPickerRole.NonStriker,
      userId,
    };
    setBattingSlots((prev) => applyBattingSlotPick(pick, prev));
    if (role === 'striker') {
      setStrikerId(userId);
    } else {
      setNonStrikerId(userId);
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
          if (isScoringNotAllowedError(err)) {
            showScoringBlocked(err.message || SCORING_NOT_ALLOWED_MESSAGE);
          } else {
            setError(scoringWriteErrorMessage(err));
          }
          if (err.status === 409) {
            syncFromCard(await getScorecard(matchId), { promptBowlers: false });
          }
        } else {
          setError('Could not save player selection.');
        }
      } finally {
        setWorking(false);
      }
    })();
  }

  /** Desktop Play Control — same setInningsParticipants write as the full-page bowler picker. */
  function selectBowlerInline(userId: string): void {
    const snapshot = card;
    const liveInnings = inn;
    const inningsId = liveInnings?.inningsId;
    if (!matchId || !snapshot || !inningsId) return;
    if (!isMatchScoringAllowed(match)) {
      showScoringBlocked();
      return;
    }
    const pick: ScoringPickResult = { kind: 'bowler', userId };
    setBowlerId(userId);
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
          if (isScoringNotAllowedError(err)) {
            showScoringBlocked(err.message || SCORING_NOT_ALLOWED_MESSAGE);
          } else {
            setError(scoringWriteErrorMessage(err));
          }
          if (err.status === 409) {
            syncFromCard(await getScorecard(matchId), { promptBowlers: false });
          } else {
            setBowlerId(liveInnings?.currentBowlerId ?? null);
          }
        } else {
          setError('Could not save player selection.');
          setBowlerId(liveInnings?.currentBowlerId ?? null);
        }
      } finally {
        setWorking(false);
      }
    })();
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
          clearPickerNavigationGuard(pendingBowlerRef, bowlerAutoPromptSuppressedForBallsRef);
        } else {
          setBattingSlots((prev) => applyBattingSlotPick(pick, prev));
          clearPickerNavigationGuard(pendingBatsmanPickerRef, batsmanAutoPromptSuppressedKeyRef);
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
              if (isScoringNotAllowedError(err)) {
                showScoringBlocked(err.message || SCORING_NOT_ALLOWED_MESSAGE);
              } else {
                setError(scoringWriteErrorMessage(err));
              }
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
        const liveOnReturn = cardRef.current?.innings.at(-1);
        handlePickerDismissWithoutSelection(
          pendingBowlerRef,
          bowlerAutoPromptSuppressedForBallsRef,
          liveOnReturn && needsBowlerSelection(liveOnReturn, liveOnReturn.currentBowlerId)
            ? liveOnReturn.legalBalls
            : null,
        );
      }

      if (pendingBatsmanPickerRef.current) {
        const liveOnReturn = cardRef.current?.innings.at(-1);
        handlePickerDismissWithoutSelection(
          pendingBatsmanPickerRef,
          batsmanAutoPromptSuppressedKeyRef,
          liveOnReturn && needIncomingBatter(liveOnReturn)
            ? incomingBatterAutoPromptKey(liveOnReturn)
            : null,
        );
      }

      if (matchId && !loading) {
        if (skipNextFocusLoadRef.current) {
          skipNextFocusLoadRef.current = false;
          return;
        }
        void load();
      }
    }, [load, loading, matchId, showScoringBlocked]),
  );

  const nameOf = useMemo((): NameResolver => {
    const players = new Map<string, string>();
    if (card?.display.players) {
      for (const [id, label] of Object.entries(card.display.players)) {
        players.set(id, label);
      }
    }
    if (match) {
      for (const squad of match.squads) {
        for (const p of squad.players) players.set(p.userId, `${p.firstName} ${p.lastName}`);
      }
      for (const external of match.externalPlayers ?? []) {
        players.set(external.id, external.name);
      }
    }
    return (id) => (id ? (players.get(id) ?? 'Player') : '—');
  }, [card?.display.players, match]);

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

  const battingSquad = useMemo((): SquadPlayerView[] => {
    if (inn?.battingIsExternal) {
      return (match?.externalPlayers ?? [])
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((player) => ({
          userId: player.id,
          firstName: player.name,
          lastName: '',
          role: MatchSquadRole.PlayingXi,
          isActiveImpact: false,
          battingOrder: player.slot,
        }));
    }
    const players =
      match?.squads.find((s) => s.teamId === battingTeamId)?.players.filter(
        (p) => p.role === MatchSquadRole.PlayingXi,
      ) ?? [];
    return players
      .slice()
      .sort(
        (a, b) =>
          (a.battingOrder ?? 999) - (b.battingOrder ?? 999) ||
          a.userId.localeCompare(b.userId),
      );
  }, [
    battingTeamId,
    inn?.battingIsExternal,
    match?.externalPlayers,
    match?.squads,
  ]);
  const bowlingSquad = useMemo((): SquadPlayerView[] => {
    if (inn?.bowlingIsExternal) {
      return (match?.externalPlayers ?? [])
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((player) => ({
          userId: player.id,
          firstName: player.name,
          lastName: '',
          role: MatchSquadRole.PlayingXi,
          isActiveImpact: false,
          battingOrder: player.slot,
        }));
    }
    return (
      match?.squads
        .find((s) => s.teamId === bowlingTeamId)
        ?.players.filter((p) => p.role === MatchSquadRole.PlayingXi) ?? []
    );
  }, [
    bowlingTeamId,
    inn?.bowlingIsExternal,
    match?.externalPlayers,
    match?.squads,
  ]);


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
    if (!needIncomingBatter(inn) || pendingBatsmanPickerRef.current) return;
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
        reportWriteError(err, 'Could not save change.');
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

  // After Cancel, keep dialog dismissed while the end condition still holds.
  // If the scorer undoes out of the end condition, clear the dismiss so the
  // dialog can auto-prompt again when the innings next becomes closable.
  useEffect(() => {
    if (!inningsTransitionPending) {
      endInningsPromptDismissedRef.current = false;
    }
  }, [inningsTransitionPending]);

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
    if (!card?.result.decided || !match) {
      if (match?.state === 'COMPLETED' && match.resultNote) {
        return replaceGenericHomeAwayInResultNote(
          match.resultNote,
          match.homeTeamName ?? 'Home',
          match.awayTeamName ?? match.externalOpponentName ?? 'Away',
        );
      }
      return null;
    }
    const winnerName =
      match.squads.find((s) => s.teamId === card.result.winningTeamId)?.teamName ??
      resolveMatchWinnerDisplayName(
        {
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeTeamName: match.homeTeamName,
          awayTeamName: match.awayTeamName,
          externalOpponentName: match.externalOpponentName,
        },
        card.result,
        card.innings,
      );
    return (
      formatMatchResultNote(winnerName, card.result) ??
      (match.resultNote
        ? replaceGenericHomeAwayInResultNote(
            match.resultNote,
            match.homeTeamName ?? 'Home',
            match.awayTeamName ?? match.externalOpponentName ?? 'Away',
          )
        : null)
    );
  }, [card?.result, card?.innings, match]);

  async function confirmEndInnings(): Promise<void> {
    const inningsId = inn?.inningsId;
    if (!matchId || !card || !inningsId) return;
    setShowEndInningsConfirm(false);
    closeMoreFlows();
    setWorking(true);
    setError(null);
    try {
      const updated = await endInnings(matchId, inningsId, { expectedVersion: card.version });
      const refreshedMatch = await getMatch(matchId);

      // Final contest decided → leave live scoring; first innings / super-over stay put.
      if (refreshedMatch.state === MatchState.Completed) {
        router.replace(`/matches/${matchId}/scorecard`);
        return;
      }

      syncFromCard(updated, { promptBowlers: false });
      setMatch(refreshedMatch);

      const live = updated.innings.at(-1);
      if (live && !live.closed && !live.currentStrikerId) {
        setStrikerId(null);
        setNonStrikerId(null);
        setBowlerId(null);
        setBattingSlots({ batsman1Id: null, batsman2Id: null });
      }
    } catch (err) {
      reportWriteError(err, 'Could not end the innings.');
      if (err instanceof ApiRequestError && err.status === 409) {
        const refreshed = await getScorecard(matchId);
        syncFromCard(refreshed);
        setMatch(await getMatch(matchId));
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
  const teamsLabel =
    match?.homeTeamName && (match?.awayTeamName || match?.externalOpponentName)
      ? `${match.homeTeamName} vs ${match.awayTeamName ?? match.externalOpponentName}`
      : (match?.homeTeamName ?? 'Match');
  const tournamentName = match?.tournamentName ?? null;
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
      reportWriteError(err, 'Could not update the scorecard.');
      if (err instanceof ApiRequestError && err.status === 409) {
        syncFromCard(await getScorecard(matchId), opts);
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

    // Desktop: 6th legal ball only opens end-over Dialog 1 — do not commit yet.
    if (
      useCockpit &&
      !isPenalty &&
      deliveryCountsAsLegalBall(body) &&
      inn.legalBalls % 6 === 5 &&
      endOverStep == null
    ) {
      if (!isMatchScoringAllowed(match)) {
        showScoringBlocked();
        return;
      }
      setError(null);
      setEndOverPending({
        body,
        strikerId,
        nonStrikerId,
        bowlerId,
        legalBalls: inn.legalBalls,
      });
      setEndOverStep('confirm');
      return;
    }

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

  async function commitEndOverWithBowler(nextBowlerId: string): Promise<void> {
    if (!matchId || !inn?.inningsId || !card) return;
    if (!isMatchScoringAllowed(match)) {
      showScoringBlocked();
      return;
    }
    const inningsId = inn.inningsId;
    setEndOverConfirming(true);
    setWorking(true);
    setError(null);
    try {
      let version = card.version;
      let liveAfterBall = inn;
      const pending = endOverPending;
      if (pending) {
        const afterBall = await recordDelivery(matchId, inningsId, {
          ...pending.body,
          strikerId: pending.strikerId,
          nonStrikerId: pending.nonStrikerId,
          bowlerId: pending.bowlerId,
          expectedVersion: version,
        });
        version = afterBall.version;
        syncFromCard(afterBall, { promptBowlers: false });
        liveAfterBall = afterBall.innings.at(-1) ?? inn;
      }
      // Innings may have closed on the 6th ball — no next-over bowler to assign.
      if (liveAfterBall.closed || !needsBowlerSelection(liveAfterBall, liveAfterBall.currentBowlerId)) {
        clearEndOverFlow();
        return;
      }
      const afterBowler = await setInningsParticipants(matchId, inningsId, {
        expectedVersion: version,
        bowlerId: nextBowlerId,
      });
      syncFromCard(afterBowler, { promptBowlers: false });
      clearEndOverFlow();
    } catch (err) {
      reportWriteError(err, 'Could not end the over.');
      if (err instanceof ApiRequestError && err.status === 409) {
        syncFromCard(await getScorecard(matchId), { promptBowlers: false });
        clearEndOverFlow();
      }
    } finally {
      setEndOverConfirming(false);
      setWorking(false);
    }
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
        <ScreenHeader compact showProfileMenu={false} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={FIELD_ORANGE} />
        </View>
      </SafeAreaView>
    );
  }

  if (sessionBlocked) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <ScreenHeader compact showProfileMenu={false} />
        <View className="flex-1 justify-center gap-4 px-4">
          <View className="rounded-control border border-outline-variant bg-surface-container-lowest p-4">
            <Text className="font-sans text-sm text-on-surface">{sessionBlocked}</Text>
          </View>
          <Button className="h-12" label="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const batsman1Card = inn?.batters.find((b) => b.playerId === battingSlots.batsman1Id);
  const batsman2Card = inn?.batters.find((b) => b.playerId === battingSlots.batsman2Id);
  const bowlerCard = inn?.bowlers.find((b) => b.playerId === bowlerId);
  const keypadDisabled =
    working ||
    endOverStep != null ||
    !openersReady ||
    (Boolean(inn?.closed) && !inningsTransitionPending);

  const inningsLabels = card?.display.innings.find(
    (row) => inn?.inningsId != null && row.inningsId === inn.inningsId,
  );
  const battingTeamName =
    inningsLabels?.battingTeamName ?? match?.homeTeamName ?? 'Batting';
  const bowlingTeamName =
    inningsLabels?.bowlingTeamName ??
    match?.awayTeamName ??
    match?.externalOpponentName ??
    'Bowling';

  const cockpitPrompt = !inn
    ? null
    : inn.inningsType === InningsType.SuperOver && !openersReady && !inn.closed
      ? 'Super Over — select batters and bowler (2 wickets ends the innings)'
      : inn.inningsType === InningsType.Normal &&
          inn.sequence === 1 &&
          !openersReady &&
          !inn.closed
        ? 'Select opening batters and bowler to start scoring'
        : inn.inningsType === InningsType.Normal &&
            inn.sequence > 1 &&
            !openersReady &&
            !inn.closed
          ? 'Select opening batters and bowler for the chase'
          : needsIncomingBatter
            ? 'Select incoming batter'
            : inningsAllOut
              ? `All out (${WICKETS_FOR_ALL_OUT} wickets)`
              : needsBowlerForNewOver
                ? 'Select next bowler'
                : null;

  const dialogOpen =
    showWicket ||
    showWide ||
    showNoBall ||
    showLegByes ||
    showByes ||
    showBonus ||
    showMore ||
    showCockpitSettings ||
    showCatchDrop ||
    showEndInningsConfirm ||
    endOverStep != null ||
    moreAction != null;

  const cockpitHeaderTrailing =
    useCockpit && inn ? (
      <CockpitSettingsHeaderButton onPress={() => setShowCockpitSettings(true)} />
    ) : undefined;

  const scoringViewToggle =
    inn != null ? (
      <SegmentedControl
        size="sm"
        options={SCORING_VIEW_TAB_OPTIONS}
        value={scoringViewTab}
        onChange={setScoringViewTab}
        accessibilityLabel="Live scoring view"
      />
    ) : undefined;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader
        compact
        showProfileMenu={false}
        trailing={cockpitHeaderTrailing ?? scoringViewToggle}
      />
      {useCockpit && inn && match && matchId ? (
        <ScoringCockpit
          matchId={matchId}
          match={match}
          card={card!}
          innings={inn}
          user={user}
          nameOf={nameOf}
          battingTeamName={battingTeamName}
          bowlingTeamName={bowlingTeamName}
          strikerId={strikerId}
          nonStrikerId={nonStrikerId}
          bowlerId={bowlerId}
          strikerCard={inn.batters.find((b) => b.playerId === strikerId)}
          nonStrikerCard={inn.batters.find((b) => b.playerId === nonStrikerId)}
          bowlerCard={inn.bowlers.find((b) => b.playerId === bowlerId)}
          battingXi={battingSquad}
          bowlingXi={bowlingSquad}
          keypadDisabled={keypadDisabled}
          keyboardEnabled={!keypadDisabled && !dialogOpen}
          error={error && !isScoringNotAllowedMessage(error) ? error : null}
          prompt={cockpitPrompt}
          onRuns={(runs, isBoundary) => {
            void record({ type: DeliveryType.Legal, runsBat: runs, isBoundary });
          }}
          onWide={(ranPortion) => {
            void record({ type: DeliveryType.Wide, extraRuns: 1 + ranPortion });
          }}
          onNoBall={(runsBat) => {
            void record(buildNoBallDelivery({ branch: 'OFF_BAT', runsBat }));
          }}
          onBye={(extraRuns) => {
            void record({ type: DeliveryType.Bye, extraRuns });
          }}
          onLegBye={(extraRuns) => {
            void record({ type: DeliveryType.LegBye, extraRuns });
          }}
          onWicket={() => setShowWicket(true)}
          onOpenCatchDrop={() => setShowCatchDrop(true)}
          onOpenBonus={() => setShowBonus(true)}
          onOpenMore={() => setShowMore(true)}
          onPenalty={() => handleMoreSelect('PENALTY')}
          onUndo={() => {
            const inningsId = inn.inningsId;
            if (!matchId || !card || !inningsId) return;
            void applyMutation(() =>
              undoLastDelivery(matchId, inningsId, {
                expectedVersion: card.version,
              }),
            );
          }}
          onSelectStriker={(userId) => selectBatterInline('striker', userId)}
          onSelectNonStriker={(userId) => selectBatterInline('nonStriker', userId)}
          onSelectBowler={(userId) => selectBowlerInline(userId)}
          working={working}
          onSetShotPlacement={(target, shotX, shotY) => {
            const inningsId = inn.inningsId;
            if (!matchId || !card || !inningsId || working) return;
            void applyMutation(() =>
              setDeliveryShotPlacement(matchId, inningsId, {
                ...target,
                shotX,
                shotY,
                expectedVersion: card.version,
              }),
            );
          }}
        />
      ) : (
      <View className="min-h-0 flex-1">
        {!inn ? (
          <View className="flex-1 justify-center gap-4 px-4">
            {error ? (
              <View className="rounded-control bg-primary-50 px-3 py-2">
                <Text className="font-sans text-xs text-primary">{error}</Text>
              </View>
            ) : null}
            <View className="rounded-control border border-outline-variant bg-surface p-4">
              <Text className="font-sans text-sm text-on-surface">
                {canCompleteScoringSetup
                  ? 'The match is live but the first innings has not been opened yet. Complete setup to begin scoring.'
                  : 'Complete match setup (toss and first innings) from your dashboard before scoring.'}
              </Text>
            </View>
            {canCompleteScoringSetup ? (
              <Button
                className="h-12"
                disabled={working}
                label={working ? 'Opening innings…' : 'Complete match setup'}
                onPress={() => void completeScoringSetup()}
              />
            ) : (
              <Button className="h-12" label="Go Back" onPress={() => router.back()} />
            )}
          </View>
        ) : (
          <>
            <ScrollView
              className="min-h-0 flex-1"
              contentContainerClassName="gap-2 px-4 pb-2 pt-1"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {error && !isScoringNotAllowedMessage(error) ? (
                <View className="rounded-control bg-primary-50 px-3 py-2">
                  <Text className="font-sans text-xs text-primary">{error}</Text>
                </View>
              ) : null}

              <LiveScoringHeader
                compact
                tournamentName={tournamentName}
                teamsLabel={teamsLabel}
                matchTypeLabel={matchTypeLabel}
                resultLine={completedResultLine}
                matchState={match?.state ?? 'LIVE'}
                innings={inn}
                totalOvers={
                  resolveOversAllotment(
                    inn.oversAllotted,
                    card?.innings[0]?.oversAllotted,
                    match?.oversPerInnings,
                  )
                }
                originalTarget={
                  card?.originalTarget ??
                  (card?.innings[0] != null ? card.innings[0].runs + 1 : null)
                }
                showRunStats={openersReady}
              />

              {scoringViewTab === 'live' ? (
                <>
              <LiveScoringPlayerCards
                compact
                batsman1Id={battingSlots.batsman1Id}
                batsman2Id={battingSlots.batsman2Id}
                onStrikePlayerId={inn.currentStrikerId}
                bowlerId={bowlerId}
                batsman1Card={batsman1Card}
                batsman2Card={batsman2Card}
                bowlerCard={bowlerCard}
                inningsBowlers={inn.bowlers}
                needsIncomingBatter={needsIncomingBatter}
                needsBowlerPick={needsBowlerForNewOver}
                extras={inn.extras}
                nameOf={nameOf}
                onOpenBatsmanPicker={openBatsmanPickerFromBatIcon}
                onPickBatsman1={() => openBatsmanPicker('striker')}
                onPickBatsman2={() => openBatsmanPicker('nonStriker')}
                onPickBowler={() => openBowlerPicker()}
              />

              <DroppedCatchCardSection
                card={card}
                match={match}
                user={user}
                nameOf={nameOf}
                innings={inn}
              />

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
                </>
              ) : card ? (
                <LiveScoringScorecardTab card={card} match={match} />
              ) : (
                <View className="rounded-control border border-outline-variant bg-surface-container-low px-4 py-8">
                  <Text className="text-center font-sans text-sm text-on-surface-variant">
                    Scorecard unavailable
                  </Text>
                </View>
              )}
            </ScrollView>

            {scoringViewTab === 'live' ? (
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
            ) : null}
          </>
        )}
      </View>
      )}

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

      <CockpitSettingsModal
        visible={showCockpitSettings}
        matchId={matchId}
        overlayTheme={match?.overlayTheme ?? 'theme1'}
        onClose={() => setShowCockpitSettings(false)}
        onThemeSaved={(overlayTheme) => {
          setMatch((prev) => (prev ? { ...prev, overlayTheme } : prev));
        }}
      />

      <ChangeTargetBlockedDialog
        visible={showChangeTargetBlocked}
        onClose={() => setShowChangeTargetBlocked(false)}
      />

      <ScoringNotAllowedDialog
        visible={scoringBlockedOpen}
        message={scoringBlockedMessage}
        onClose={dismissScoringBlocked}
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
        legalBalls={inn?.legalBalls ?? 0}
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

      <ScorerRevokedDialog
        visible={scorerRevokedOpen}
        reason={scorerRevokedReason}
        onDismiss={dismissScorerRevoked}
      />

      {useCockpit && matchId && inn?.inningsId ? (
        <>
          <EndOverConfirmDialog
            visible={endOverStep === 'confirm'}
            onNo={() => {
              clearEndOverFlow();
            }}
            onYes={() => {
              setEndOverStep('bowler');
            }}
          />
          <ConfirmNextBowlerDialog
            visible={endOverStep === 'bowler'}
            matchId={matchId}
            inningsId={inn.inningsId}
            upcomingOver={upcomingOverNumber(
              endOverPending?.legalBalls ?? inn.legalBalls,
            )}
            previousOverBowlerId={
              endOverPending?.bowlerId ?? inn.currentBowlerId ?? bowlerId
            }
            confirming={endOverConfirming}
            onCancel={() => {
              // Recovery (no pending ball): suppress auto-reopen. Pending 6th-ball
              // abandon needs no suppress — over is still incomplete.
              clearEndOverFlow({
                suppressBowlerAutoPrompt: endOverPending == null,
              });
            }}
            onConfirm={(nextBowlerId) => {
              void commitEndOverWithBowler(nextBowlerId);
            }}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}
