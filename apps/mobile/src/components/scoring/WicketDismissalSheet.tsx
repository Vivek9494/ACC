import { Ionicons } from '@expo/vector-icons';
import { DismissalType, type SquadPlayerView } from '@acc/types';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { SCORING_KEYPAD_GREY_BG } from './liveScoringKeypadTokens';
import { CaughtFielderPicker } from './CaughtFielderPicker';
import { MankadDetailsDialog } from './MankadDetailsDialog';
import { RetirementDetailsDialog } from './RetirementDetailsDialog';
import { RunOutDetailsDialog, type RunOutExtraOption } from './RunOutDetailsDialog';
import { StumpedDetailsDialog } from './StumpedDetailsDialog';

/** UI dismissal choices (Mankad maps to RUN_OUT in the engine; spec §30.3 keeps no Mankad enum). */
export const WicketFlowType = {
  Bowled: 'BOWLED',
  Caught: 'CAUGHT',
  Stumped: 'STUMPED',
  Lbw: 'LBW',
  RunOut: 'RUN_OUT',
  HitWicket: 'HIT_WICKET',
  Retired: 'RETIRED',
  Mankad: 'MANKAD',
} as const;
export type WicketFlowType = (typeof WicketFlowType)[keyof typeof WicketFlowType];

export const WICKET_FLOW_TYPE_LABELS: Record<WicketFlowType, string> = {
  BOWLED: 'Bowled',
  CAUGHT: 'Caught',
  STUMPED: 'Stumped',
  LBW: 'LBW',
  RUN_OUT: 'Run Out',
  HIT_WICKET: 'Hit Wicket',
  RETIRED: 'Retired',
  MANKAD: 'Mankad',
};

export const WICKET_TYPE_GRID: readonly (readonly WicketFlowType[])[] = [
  [WicketFlowType.Bowled, WicketFlowType.Caught, WicketFlowType.Stumped],
  [WicketFlowType.Lbw, WicketFlowType.RunOut, WicketFlowType.HitWicket],
  [WicketFlowType.Retired, WicketFlowType.Mankad],
] as const;

/** Bowler-credited dismissals of the on-strike batter — no follow-up dialog (§12.1). */
export const BOWLER_CREDITED_STRIKER_OUT_FLOWS: readonly WicketFlowType[] = [
  WicketFlowType.Bowled,
  WicketFlowType.Lbw,
  WicketFlowType.HitWicket,
] as const;

export function isBowlerCreditedStrikerOutFlow(flow: WicketFlowType): boolean {
  return BOWLER_CREDITED_STRIKER_OUT_FLOWS.includes(flow);
}

export interface WicketDismissalResult {
  flowType: WicketFlowType;
  dismissalType: DismissalType;
  dismissedId: string;
  fielderId: string | null;
  fielder2Id?: string | null;
  runsBat: number;
  /** Caught only — batters crossed before the catch (affects who is on strike). */
  batsmenCrossed: boolean;
  isRetiredHurt: boolean;
  /** Stumped only — stumping occurred off a wide delivery. */
  stumpedOffWide?: boolean;
  /** Run-out only — extra delivery type; NONE = legal ball with runs off bat. */
  runOutExtraType?: RunOutExtraOption;
}

type Step =
  | 'type'
  | 'retirement-details'
  | 'mankad-details'
  | 'caught-fielder'
  | 'stumped-details'
  | 'run-out-details'
  | 'caught-crossed';

export interface WicketDismissalSheetProps {
  visible: boolean;
  matchId: string;
  inningsId: string;
  freeHitActive: boolean;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  battingSquad: SquadPlayerView[];
  bowlingSquad: SquadPlayerView[];
  nameOf: (id: string | null | undefined) => string;
  onCancel: () => void;
  onConfirm: (result: WicketDismissalResult) => void;
}

function flowToDismissalType(flow: WicketFlowType): DismissalType {
  switch (flow) {
    case WicketFlowType.Bowled:
      return DismissalType.Bowled;
    case WicketFlowType.Caught:
      return DismissalType.Caught;
    case WicketFlowType.Stumped:
      return DismissalType.Stumped;
    case WicketFlowType.Lbw:
      return DismissalType.Lbw;
    case WicketFlowType.RunOut:
    case WicketFlowType.Mankad:
      return DismissalType.RunOut;
    case WicketFlowType.HitWicket:
      return DismissalType.HitWicket;
    case WicketFlowType.Retired:
      return DismissalType.RetiredOut;
    default:
      return DismissalType.Bowled;
  }
}

function DialogShell({
  title,
  onClose,
  onBack,
  children,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onClose}>
        <Pressable
          className="max-h-[85%] w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center gap-2 border-b border-outline-variant px-4 py-3">
            {onBack ? (
              <Pressable
                onPress={onBack}
                className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="arrow-back" size={22} color={FIELD_ORANGE} />
              </Pressable>
            ) : null}
            <Text className="min-w-0 flex-1 font-sans-bold text-lg text-on-surface" numberOfLines={2}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>
          <ScrollView className="max-h-96" keyboardShouldPersistTaps="handled">
            <View className="gap-2 p-4">{children}</View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function GreyOptionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-12 flex-1 items-center justify-center rounded-control ${SCORING_KEYPAD_GREY_BG} active:opacity-80`}
      accessibilityRole="button"
    >
      <Text className="text-center font-sans-semibold text-sm text-on-surface">{label}</Text>
    </Pressable>
  );
}

/** Multi-step wicket / dismissal flow (§12.1). */
export function WicketDismissalSheet({
  visible,
  matchId,
  inningsId,
  freeHitActive,
  strikerId,
  nonStrikerId,
  bowlerId,
  battingSquad: _battingSquad,
  bowlingSquad: _bowlingSquad,
  nameOf,
  onCancel,
  onConfirm,
}: WicketDismissalSheetProps): React.ReactElement {
  const [step, setStep] = useState<Step>('type');
  const [flowType, setFlowType] = useState<WicketFlowType | null>(null);
  const [fielderId, setFielderId] = useState<string | null>(null);
  const [batsmenCrossed, setBatsmenCrossed] = useState(false);
  const [runsBat, setRunsBat] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStep('type');
      setFlowType(null);
      setFielderId(null);
      setBatsmenCrossed(false);
      setRunsBat(0);
    }
  }, [visible]);

  if (!visible) {
    return <></>;
  }

  function emit(result: Omit<WicketDismissalResult, 'flowType' | 'dismissalType'> & { flowType: WicketFlowType }): void {
    onConfirm({
      flowType: result.flowType,
      dismissalType: flowToDismissalType(result.flowType),
      dismissedId: result.dismissedId,
      fielderId: result.fielderId,
      fielder2Id: result.fielder2Id,
      runsBat: result.runsBat,
      batsmenCrossed: result.batsmenCrossed,
      isRetiredHurt: result.isRetiredHurt,
      stumpedOffWide: result.stumpedOffWide,
      runOutExtraType: result.runOutExtraType,
    });
  }

  function finishStrikerOut(type: WicketFlowType, fielder: string | null, crossed = false, runs = 0): void {
    if (!strikerId) return;
    emit({
      flowType: type,
      dismissedId: strikerId,
      fielderId: fielder,
      runsBat: runs,
      batsmenCrossed: crossed,
      isRetiredHurt: false,
    });
  }

  function pickFlowType(type: WicketFlowType): void {
    setFlowType(type);
    switch (type) {
      case WicketFlowType.Bowled:
      case WicketFlowType.Lbw:
      case WicketFlowType.HitWicket:
        finishStrikerOut(type, null);
        break;
      case WicketFlowType.Caught:
        setStep('caught-fielder');
        break;
      case WicketFlowType.Stumped:
        setStep('stumped-details');
        break;
      case WicketFlowType.RunOut:
        setStep('run-out-details');
        break;
      case WicketFlowType.Mankad:
        if (!nonStrikerId) return;
        setStep('mankad-details');
        break;
      case WicketFlowType.Retired:
        setStep('retirement-details');
        break;
      default:
        break;
    }
  }

  function confirmMankadDetails({ dismissedId }: { dismissedId: string }): void {
    emit({
      flowType: WicketFlowType.Mankad,
      dismissedId,
      fielderId: bowlerId,
      runsBat: 0,
      batsmenCrossed: false,
      isRetiredHurt: false,
    });
  }

  function confirmRetirementDetails(result: { retiredHurt: boolean; batsmanId: string }): void {
    emit({
      flowType: WicketFlowType.Retired,
      dismissedId: result.batsmanId,
      fielderId: null,
      runsBat: 0,
      batsmenCrossed: false,
      isRetiredHurt: result.retiredHurt,
    });
  }

  function confirmRunOutDetails(result: {
    dismissedId: string;
    fielderId: string;
    fielder2Id: string | null;
    completedRuns: number;
    extraType: RunOutExtraOption;
  }): void {
    emit({
      flowType: WicketFlowType.RunOut,
      dismissedId: result.dismissedId,
      fielderId: result.fielderId,
      fielder2Id: result.fielder2Id,
      runsBat: result.completedRuns,
      batsmenCrossed: false,
      isRetiredHurt: false,
      runOutExtraType: result.extraType,
    });
  }

  function confirmStumpedDetails({ keeperId, offWide }: { keeperId: string; offWide: boolean }): void {
    if (!strikerId) return;
    emit({
      flowType: WicketFlowType.Stumped,
      dismissedId: strikerId,
      fielderId: keeperId,
      runsBat: 0,
      batsmenCrossed: false,
      isRetiredHurt: false,
      stumpedOffWide: offWide,
    });
  }

  function confirmCaughtFielder(id: string): void {
    setFielderId(id);
    setStep('caught-crossed');
  }

  function pickCaughtCrossed(crossed: boolean): void {
    setBatsmenCrossed(crossed);
    if (!strikerId || !fielderId) return;
    finishStrikerOut(WicketFlowType.Caught, fielderId, crossed);
  }

  if (step === 'mankad-details') {
    return (
      <MankadDetailsDialog
        visible={visible}
        strikerId={strikerId}
        nonStrikerId={nonStrikerId}
        nameOf={nameOf}
        onClose={() => setStep('type')}
        onBack={() => setStep('type')}
        onConfirm={confirmMankadDetails}
      />
    );
  }

  if (step === 'retirement-details') {
    return (
      <RetirementDetailsDialog
        visible={visible}
        strikerId={strikerId}
        nonStrikerId={nonStrikerId}
        nameOf={nameOf}
        onClose={() => setStep('type')}
        onBack={() => setStep('type')}
        onConfirm={confirmRetirementDetails}
      />
    );
  }

  if (step === 'run-out-details') {
    return (
      <RunOutDetailsDialog
        visible={visible}
        matchId={matchId}
        inningsId={inningsId}
        strikerId={strikerId}
        nonStrikerId={nonStrikerId}
        nameOf={nameOf}
        onClose={() => setStep('type')}
        onBack={() => setStep('type')}
        onConfirm={confirmRunOutDetails}
      />
    );
  }

  if (step === 'stumped-details') {
    return (
      <StumpedDetailsDialog
        visible={visible}
        matchId={matchId}
        inningsId={inningsId}
        onClose={() => setStep('type')}
        onBack={() => setStep('type')}
        onConfirm={confirmStumpedDetails}
      />
    );
  }

  if (step === 'caught-fielder') {
    return (
      <CaughtFielderPicker
        visible={visible}
        matchId={matchId}
        inningsId={inningsId}
        selectedFielderId={fielderId}
        onBack={() => setStep('type')}
        onCancel={() => setStep('type')}
        onConfirm={confirmCaughtFielder}
      />
    );
  }

  if (step === 'type') {
    const rows = freeHitActive
      ? [[WicketFlowType.RunOut, WicketFlowType.Mankad] as const]
      : WICKET_TYPE_GRID;
    return (
      <DialogShell title="Select Dismissal Type" onClose={onCancel}>
        {freeHitActive ? (
          <Text className="font-sans text-sm text-primary">
            Free hit — only run out and mankad are allowed.
          </Text>
        ) : null}
        {rows.map((row) => (
          <View key={row.join(',')} className="flex-row gap-2">
            {row.map((type) => (
              <GreyOptionButton
                key={type}
                label={WICKET_FLOW_TYPE_LABELS[type]}
                onPress={() => pickFlowType(type)}
              />
            ))}
            {!freeHitActive && row.length < 3
              ? Array.from({ length: 3 - row.length }).map((_, index) => (
                  <View key={`pad-${index}`} className="min-h-12 flex-1" />
                ))
              : null}
          </View>
        ))}
        <Button label="Cancel" variant="outline" onPress={onCancel} className="mt-2 h-11" />
      </DialogShell>
    );
  }

  if (step === 'caught-crossed') {
    return (
      <DialogShell title="Did the batters cross?" onClose={onCancel} onBack={() => setStep('caught-fielder')}>
        <Text className="font-sans text-sm text-on-surface-variant">
          If they crossed before the catch, the surviving batter stays on strike.
        </Text>
        <View className="flex-row gap-2">
          <GreyOptionButton label="No" onPress={() => pickCaughtCrossed(false)} />
          <GreyOptionButton label="Yes" onPress={() => pickCaughtCrossed(true)} />
        </View>
        <Button label="Cancel" variant="outline" onPress={onCancel} className="mt-2 h-11" />
      </DialogShell>
    );
  }

  return <></>;
}
