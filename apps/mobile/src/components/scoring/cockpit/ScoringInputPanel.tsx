import type { ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';

import { Text } from '../../ui/Text';
import { CockpitPanel } from './CockpitPanel';

/** Ran portions beyond the automatic 1-run wide penalty (same as WideBallDialog). */
const WIDE_RAN: readonly (readonly number[])[] = [
  [0, 1, 2],
  [3, 4, 6],
] as const;

/** Off-the-bat runs on a no-ball (same as NoBallDialog OFF_BAT). */
const NO_BALL_OFF_BAT: readonly (readonly number[])[] = [
  [0, 1, 2],
  [3, 4, 6],
] as const;

const BYE_VALUES: readonly (readonly number[])[] = [
  [1, 2, 3],
  [4, 5, 6],
] as const;

const LEG_BYE_VALUES: readonly (readonly number[])[] = [
  [1, 2, 3],
  [4, 5, 6],
] as const;

const RUNS_OFF_BAT: readonly (readonly { runs: number; boundary: boolean }[])[] = [
  [
    { runs: 0, boundary: false },
    { runs: 1, boundary: false },
    { runs: 2, boundary: false },
  ],
  [
    { runs: 3, boundary: false },
    { runs: 4, boundary: true },
    { runs: 6, boundary: true },
  ],
] as const;

export interface ScoringInputPanelProps {
  disabled: boolean;
  onRuns: (runs: number, isBoundary: boolean) => void;
  /** Wide — same event as WideBallDialog (`extraRuns: 1 + ranPortion`). */
  onWide: (ranPortion: number) => void;
  /** No-ball off bat — same as NoBallDialog OFF_BAT branch. */
  onNoBall: (runsBat: number) => void;
  /** Bye — same as ByesDialog. */
  onBye: (extraRuns: number) => void;
  /** Leg bye — same as LegByesDialog. */
  onLegBye: (extraRuns: number) => void;
  onWicket: () => void;
  /** Opens CatchDropFielderPicker. */
  onOpenCatchDrop: () => void;
  /** Opens BonusRunsDialog (±1…±6). */
  onOpenBonus: () => void;
  /** Opens MoreOptionsModal (End Inning, Change Target/Overs, …). */
  onOpenMore: () => void;
  /** Opens PenaltyRunsDialog (fixed 5-run penalty + team). Distinct from Bonus ±. */
  onPenalty: () => void;
}

const CLUSTER_GRID: ViewStyle = {
  display: 'grid' as unknown as ViewStyle['display'],
  gridTemplateColumns: 'repeat(3, minmax(44px, 1fr))',
  gap: 3,
} as ViewStyle;

const OUT_GRID: ViewStyle = {
  display: 'grid' as unknown as ViewStyle['display'],
  gridTemplateColumns: 'minmax(72px, 1.4fr) minmax(56px, 1fr) minmax(52px, 1fr)',
  gap: 3,
} as ViewStyle;

function KeyCap({
  label,
  onPress,
  disabled,
  className,
  textClassName,
}: {
  label: string;
  onPress?: () => void;
  disabled: boolean;
  className: string;
  textClassName: string;
}): React.ReactElement {
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      className={`h-7 min-w-0 items-center justify-center rounded px-0.5 ${className} ${
        disabled || !onPress ? 'opacity-40' : 'active:opacity-80'
      }`}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text className={`font-sans-bold text-[11px] ${textClassName}`} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Cluster({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View className="gap-0.5">
      <Text className="font-sans text-[8px] uppercase tracking-wider text-on-surface-variant">
        {label}
      </Text>
      <View style={CLUSTER_GRID}>{children}</View>
    </View>
  );
}

function formatWideLabel(ranPortion: number): string {
  return ranPortion === 0 ? 'wd' : `wd+${ranPortion}`;
}

function formatNbLabel(runsBat: number): string {
  return runsBat === 0 ? 'nb' : `nb+${runsBat}`;
}

export function ScoringInputPanel({
  disabled,
  onRuns,
  onWide,
  onNoBall,
  onBye,
  onLegBye,
  onWicket,
  onOpenCatchDrop,
  onOpenBonus,
  onOpenMore,
  onPenalty,
}: ScoringInputPanelProps): React.ReactElement {
  return (
    <CockpitPanel title="Scoring" live bodyNoPad fitContent>
      <View className="flex-row flex-wrap items-end gap-x-2.5 gap-y-2 px-1.5 py-1.5">
        <Cluster label="Runs off the bat">
          {RUNS_OFF_BAT.flat().map(({ runs, boundary }) => (
            <KeyCap
              key={runs}
              label={String(runs)}
              disabled={disabled}
              onPress={() => onRuns(runs, boundary)}
              className={runs === 6 ? 'bg-primary' : 'bg-secondary'}
              textClassName="text-text-inverse"
            />
          ))}
        </Cluster>

        <Cluster label="Wide">
          {WIDE_RAN.flat().map((ranPortion) => (
            <KeyCap
              key={ranPortion}
              label={formatWideLabel(ranPortion)}
              disabled={disabled}
              onPress={() => onWide(ranPortion)}
              className="bg-secondary-700"
              textClassName="text-text-inverse"
            />
          ))}
        </Cluster>

        <Cluster label="No ball">
          {NO_BALL_OFF_BAT.flat().map((runsBat) => (
            <KeyCap
              key={runsBat}
              label={formatNbLabel(runsBat)}
              disabled={disabled}
              onPress={() => onNoBall(runsBat)}
              className="bg-secondary-800"
              textClassName="text-text-inverse"
            />
          ))}
        </Cluster>

        <Cluster label="Bye">
          {BYE_VALUES.flat().map((runs) => (
            <KeyCap
              key={runs}
              label={`${runs} B`}
              disabled={disabled}
              onPress={() => onBye(runs)}
              className="bg-secondary-600"
              textClassName="text-text-inverse"
            />
          ))}
        </Cluster>

        <Cluster label="Leg bye">
          {LEG_BYE_VALUES.flat().map((runs) => (
            <KeyCap
              key={runs}
              label={`${runs} LB`}
              disabled={disabled}
              onPress={() => onLegBye(runs)}
              className="bg-stone-600"
              textClassName="text-text-inverse"
            />
          ))}
        </Cluster>

        <View className="gap-0.5">
          <Text className="font-sans text-[8px] uppercase tracking-wider text-on-surface-variant">
            Out & extras
          </Text>
          <View style={OUT_GRID}>
            <KeyCap
              label="WICKET"
              disabled={disabled}
              onPress={onWicket}
              className="bg-secondary-900"
              textClassName="text-text-inverse"
            />
            <KeyCap
              label="Catch/Drop"
              disabled={disabled}
              onPress={onOpenCatchDrop}
              className="bg-stone-500"
              textClassName="text-text-inverse"
            />
            <KeyCap
              label="Bonus ±"
              disabled={disabled}
              onPress={onOpenBonus}
              className="bg-stone-500"
              textClassName="text-text-inverse"
            />
            <KeyCap
              label="Pen 5"
              disabled={disabled}
              onPress={onPenalty}
              className="bg-primary-700"
              textClassName="text-text-inverse"
            />
            <KeyCap
              label="More ▾"
              disabled={disabled}
              onPress={onOpenMore}
              className="border border-outline-variant bg-surface-container-low"
              textClassName="text-on-surface"
            />
          </View>
        </View>
      </View>
    </CockpitPanel>
  );
}
