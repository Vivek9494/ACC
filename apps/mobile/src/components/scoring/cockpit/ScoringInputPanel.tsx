import { Pressable, View } from 'react-native';

import { Text } from '../../ui/Text';
import { SCORING_KEY_HINTS } from '../../../lib/scoring-keyboard-map';
import { CockpitPanel } from './CockpitPanel';

export interface ScoringInputPanelProps {
  disabled: boolean;
  onRuns: (runs: number, isBoundary: boolean) => void;
  onWide: (ranPortion: number) => void;
  onNoBall: (runsBat: number) => void;
  onBye: (extraRuns: number) => void;
  onLegBye: (extraRuns: number) => void;
  onWicket: () => void;
  onPenalty: () => void;
  onLegalOddRuns: (runs: 5 | 7) => void;
  onUndo: () => void;
}

function KeyCap({
  label,
  hint,
  onPress,
  disabled,
  className,
  textClassName,
}: {
  label: string;
  hint?: string;
  onPress?: () => void;
  disabled: boolean;
  className: string;
  textClassName: string;
}): React.ReactElement {
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      className={`relative h-8 flex-1 items-center justify-center rounded ${className} ${
        disabled || !onPress ? 'opacity-40' : 'active:opacity-80'
      }`}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {hint ? (
        <Text className="absolute right-0.5 top-0 font-sans text-[8px] text-text-inverse/70">
          {hint}
        </Text>
      ) : null}
      <Text className={`font-sans-bold text-[13px] ${textClassName}`}>{label}</Text>
    </Pressable>
  );
}

function SectionLabel({ children }: { children: string }): React.ReactElement {
  return (
    <Text className="mb-1 font-sans text-[9px] uppercase tracking-wider text-on-surface-variant">
      {children}
    </Text>
  );
}

export function ScoringInputPanel({
  disabled,
  onRuns,
  onWide,
  onNoBall,
  onBye,
  onLegBye,
  onWicket,
  onPenalty,
  onLegalOddRuns,
  onUndo,
}: ScoringInputPanelProps): React.ReactElement {
  return (
    <CockpitPanel title="Scoring" live bodyNoPad>
      <View className="gap-1.5 p-2">
        <View>
          <SectionLabel>Runs off the bat</SectionLabel>
          <View className="flex-row gap-1">
            {([0, 1, 2, 3] as const).map((runs) => (
              <KeyCap
                key={runs}
                label={String(runs)}
                hint={String(runs)}
                disabled={disabled}
                onPress={() => onRuns(runs, false)}
                className="bg-secondary"
                textClassName="text-text-inverse"
              />
            ))}
            <KeyCap
              label="4"
              hint="4"
              disabled={disabled}
              onPress={() => onRuns(4, true)}
              className="bg-secondary"
              textClassName="text-text-inverse"
            />
            <KeyCap
              label="6"
              hint="6"
              disabled={disabled}
              onPress={() => onRuns(6, true)}
              className="bg-primary"
              textClassName="text-text-inverse"
            />
          </View>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <SectionLabel>Wide</SectionLabel>
            <View className="flex-row gap-1">
              <KeyCap
                label="w"
                hint={SCORING_KEY_HINTS.wide}
                disabled={disabled}
                onPress={() => onWide(0)}
                className="bg-secondary-700"
                textClassName="text-text-inverse"
              />
              <KeyCap
                label="+1"
                disabled={disabled}
                onPress={() => onWide(1)}
                className="bg-secondary-700"
                textClassName="text-text-inverse"
              />
              <KeyCap
                label="+2"
                disabled={disabled}
                onPress={() => onWide(2)}
                className="bg-secondary-700"
                textClassName="text-text-inverse"
              />
              <KeyCap
                label="+4"
                disabled={disabled}
                onPress={() => onWide(4)}
                className="bg-secondary-700"
                textClassName="text-text-inverse"
              />
            </View>
          </View>
          <View className="flex-1">
            <SectionLabel>No ball</SectionLabel>
            <View className="flex-row gap-1">
              <KeyCap
                label="nb"
                hint={SCORING_KEY_HINTS.noBall}
                disabled={disabled}
                onPress={() => onNoBall(0)}
                className="bg-secondary-800"
                textClassName="text-text-inverse"
              />
              <KeyCap
                label="+1"
                disabled={disabled}
                onPress={() => onNoBall(1)}
                className="bg-secondary-800"
                textClassName="text-text-inverse"
              />
              <KeyCap
                label="+2"
                disabled={disabled}
                onPress={() => onNoBall(2)}
                className="bg-secondary-800"
                textClassName="text-text-inverse"
              />
              <KeyCap
                label="+4"
                disabled={disabled}
                onPress={() => onNoBall(4)}
                className="bg-secondary-800"
                textClassName="text-text-inverse"
              />
            </View>
          </View>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <SectionLabel>Bye</SectionLabel>
            <View className="flex-row gap-1">
              {([1, 2, 3, 4] as const).map((runs) => (
                <KeyCap
                  key={runs}
                  label={String(runs)}
                  hint={runs === 1 ? SCORING_KEY_HINTS.bye : undefined}
                  disabled={disabled}
                  onPress={() => onBye(runs)}
                  className="bg-secondary-600"
                  textClassName="text-text-inverse"
                />
              ))}
            </View>
          </View>
          <View className="flex-1">
            <SectionLabel>Leg bye</SectionLabel>
            <View className="flex-row gap-1">
              {([1, 2, 3, 4] as const).map((runs) => (
                <KeyCap
                  key={runs}
                  label={String(runs)}
                  hint={runs === 1 ? SCORING_KEY_HINTS.legBye : undefined}
                  disabled={disabled}
                  onPress={() => onLegBye(runs)}
                  className="bg-stone-600"
                  textClassName="text-text-inverse"
                />
              ))}
            </View>
          </View>
        </View>

        <View className="flex-row gap-1">
          <KeyCap
            label="WICKET"
            hint={SCORING_KEY_HINTS.wicket}
            disabled={disabled}
            onPress={onWicket}
            className="bg-secondary-900"
            textClassName="text-text-inverse"
          />
          <KeyCap
            label="Pen"
            disabled={disabled}
            onPress={onPenalty}
            className="bg-primary-700"
            textClassName="text-text-inverse"
          />
          <KeyCap
            label="5"
            disabled={disabled}
            onPress={() => onLegalOddRuns(5)}
            className="bg-stone-200"
            textClassName="text-on-surface"
          />
          <KeyCap
            label="7"
            disabled={disabled}
            onPress={() => onLegalOddRuns(7)}
            className="bg-stone-200"
            textClassName="text-on-surface"
          />
        </View>

        <View className="mt-1 flex-row gap-1.5">
          <KeyCap
            label={`Undo ${SCORING_KEY_HINTS.undo}`}
            disabled={disabled}
            onPress={onUndo}
            className="border border-outline-variant bg-surface-container-low"
            textClassName="text-on-surface"
          />
          <KeyCap
            label={`End Ball ${SCORING_KEY_HINTS.endBall}`}
            disabled
            className="bg-secondary-100"
            textClassName="text-secondary"
          />
        </View>
      </View>
    </CockpitPanel>
  );
}
