import { Ionicons } from '@expo/vector-icons';
import { DeliveryType, type FielderPickerResponse } from '@acc/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';

import { AddExternalBowlerDialog } from './AddExternalBowlerDialog';
import { SCORING_KEYPAD_GREY_BG } from './liveScoringKeypadTokens';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { ApiRequestError, getFielderPicker } from '../../lib/api';

const COMPLETED_RUN_VALUES = [0, 1, 2, 3, 4, 5, 6] as const;

export type RunOutExtraOption =
  | 'NONE'
  | typeof DeliveryType.Bye
  | typeof DeliveryType.LegBye
  | typeof DeliveryType.NoBall
  | typeof DeliveryType.Wide;

const EXTRA_OPTIONS: readonly { value: RunOutExtraOption; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: DeliveryType.Bye, label: 'Byes' },
  { value: DeliveryType.LegBye, label: 'Leg Byes' },
  { value: DeliveryType.NoBall, label: 'No Ball' },
  { value: DeliveryType.Wide, label: 'Wide' },
] as const;

export interface RunOutDetailsConfirm {
  dismissedId: string;
  fielderId: string;
  fielder2Id: string | null;
  completedRuns: number;
  extraType: RunOutExtraOption;
}

export interface RunOutDetailsDialogProps {
  visible: boolean;
  matchId: string;
  inningsId: string;
  strikerId: string | null;
  nonStrikerId: string | null;
  nameOf: (id: string | null | undefined) => string;
  onClose: () => void;
  onBack: () => void;
  onConfirm: (result: RunOutDetailsConfirm) => void;
}

function BatsmanToggle({
  label,
  sublabel,
  selected,
  onPress,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className={[
        'min-h-12 flex-1 flex-row items-center justify-between rounded-control border px-3 py-2.5 active:opacity-80',
        selected ? 'border-2 border-primary bg-primary-container' : 'border border-outline-variant bg-surface',
      ].join(' ')}
      accessibilityRole="button"
    >
      <View className="min-w-0 flex-1 pr-2">
        <Text className="font-sans-semibold text-sm text-on-surface">{label}</Text>
        <Text className="font-sans text-xs text-on-surface-variant">{sublabel}</Text>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={FIELD_ORANGE} /> : null}
    </Pressable>
  );
}

function ExtraTypeButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      className={[
        'min-h-10 flex-1 items-center justify-center rounded-control px-2 active:opacity-80',
        selected ? 'border-2 border-primary bg-primary-container' : `${SCORING_KEYPAD_GREY_BG} border border-transparent`,
      ].join(' ')}
      accessibilityRole="button"
    >
      <Text className="text-center font-sans-semibold text-xs text-on-surface">{label}</Text>
    </Pressable>
  );
}

/** Run-out dismissal details — batsman, fielder(s), completed runs, optional extra (§12.1). */
export function RunOutDetailsDialog({
  visible,
  matchId,
  inningsId,
  strikerId,
  nonStrikerId,
  nameOf,
  onClose,
  onBack,
  onConfirm,
}: RunOutDetailsDialogProps): React.ReactElement {
  const [data, setData] = useState<FielderPickerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [fielderId, setFielderId] = useState<string | null>(null);
  const [fielder2Id, setFielder2Id] = useState<string | null>(null);
  const [completedRuns, setCompletedRuns] = useState(0);
  const [extraType, setExtraType] = useState<RunOutExtraOption>('NONE');
  const [showAddExternal, setShowAddExternal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getFielderPicker(matchId, inningsId);
      setData(response);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load fielders.');
    } finally {
      setLoading(false);
    }
  }, [inningsId, matchId]);

  useEffect(() => {
    if (visible) {
      setDismissedId(null);
      setFielderId(null);
      setFielder2Id(null);
      setCompletedRuns(0);
      setExtraType('NONE');
      void load();
    } else {
      setData(null);
      setDismissedId(null);
      setFielderId(null);
      setFielder2Id(null);
      setCompletedRuns(0);
      setExtraType('NONE');
      setError(null);
      setShowAddExternal(false);
    }
  }, [visible, load]);

  const fielderOptions = useMemo(() => {
    if (!data) return [];
    return data.players.map((row) => ({
      value: row.userId,
      label: `${row.firstName} ${row.lastName}`.trim(),
    }));
  }, [data]);

  const fielder2Options = useMemo(() => {
    return [{ value: '', label: 'None (optional)' }, ...fielderOptions.filter((o) => o.value !== fielderId)];
  }, [fielderOptions, fielderId]);

  const isExternalSide = data?.bowlingSideIsExternal === true;
  const canConfirm = dismissedId !== null && fielderId !== null;

  function handleConfirm(): void {
    if (!dismissedId || !fielderId) return;
    onConfirm({
      dismissedId,
      fielderId,
      fielder2Id: fielder2Id || null,
      completedRuns,
      extraType,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onClose}>
        <Pressable
          className="max-h-[90%] w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">Run Out Details</Text>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-black/5"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={FIELD_ORANGE} />
            </Pressable>
          </View>

          {loading ? (
            <View className="items-center justify-center py-16">
              <ActivityIndicator color={FIELD_ORANGE} />
            </View>
          ) : error ? (
            <View className="gap-3 p-4">
              <View className="rounded-control bg-primary-50 px-4 py-3">
                <Text className="font-sans text-sm text-primary">{error}</Text>
              </View>
              <Button label="Retry" onPress={() => void load()} className="h-11" />
              <Button label="Back" variant="outline" onPress={onBack} className="h-11" />
            </View>
          ) : data ? (
            <>
              <ScrollView
                className="max-h-[28rem]"
                contentContainerClassName="gap-4 p-4"
                keyboardShouldPersistTaps="handled"
              >
                <View className="gap-2">
                  <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                    Select the batsman
                  </Text>
                  <View className="flex-row gap-2">
                    {strikerId ? (
                      <BatsmanToggle
                        label={nameOf(strikerId)}
                        sublabel="On strike"
                        selected={dismissedId === strikerId}
                        onPress={() => setDismissedId(strikerId)}
                      />
                    ) : null}
                    {nonStrikerId ? (
                      <BatsmanToggle
                        label={nameOf(nonStrikerId)}
                        sublabel="Non-striker"
                        selected={dismissedId === nonStrikerId}
                        onPress={() => setDismissedId(nonStrikerId)}
                      />
                    ) : null}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                    Select fielder
                  </Text>
                  <Select
                    label="Fielder 1"
                    placeholder="Select fielder"
                    value={fielderId}
                    options={fielderOptions}
                    onChange={(value) => {
                      setFielderId(value);
                      if (fielder2Id === value) setFielder2Id(null);
                    }}
                    emptyMessage={
                      isExternalSide
                        ? 'No fielders yet. Add one by name below.'
                        : 'No bowling-side players available.'
                    }
                  />
                  <Select
                    label="Fielder 2 (optional)"
                    placeholder="Optional"
                    value={fielder2Id ?? ''}
                    options={fielder2Options}
                    onChange={(value) => setFielder2Id(value || null)}
                  />
                </View>

                <View className="gap-2">
                  <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                    Did batsman complete any runs?
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {COMPLETED_RUN_VALUES.map((runs) => (
                      <Pressable
                        key={runs}
                        onPress={() => setCompletedRuns(runs)}
                        className={[
                          'min-h-11 min-w-[14%] flex-1 items-center justify-center rounded-control active:opacity-80',
                          completedRuns === runs
                            ? 'border-2 border-primary bg-primary-container'
                            : SCORING_KEYPAD_GREY_BG,
                        ].join(' ')}
                        accessibilityRole="button"
                      >
                        <Text className="font-sans-bold text-base text-on-surface">{runs}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                    Extras (optional)
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {EXTRA_OPTIONS.map((option) => (
                      <ExtraTypeButton
                        key={option.value}
                        label={option.label}
                        selected={extraType === option.value}
                        onPress={() => setExtraType(option.value)}
                      />
                    ))}
                  </View>
                </View>
              </ScrollView>

              {isExternalSide ? (
                <View className="border-t border-outline-variant px-4 py-3">
                  <Button
                    variant="outline"
                    label="Add Fielder by Name"
                    onPress={() => setShowAddExternal(true)}
                    className="h-11"
                  />
                </View>
              ) : null}

              <View className="flex-row gap-3 border-t border-outline-variant p-4">
                <Button label="Back" variant="outline" onPress={onBack} className="h-11 flex-1" />
                <Button
                  label="Confirm"
                  onPress={handleConfirm}
                  disabled={!canConfirm}
                  className="h-11 flex-1"
                />
              </View>
            </>
          ) : null}

          <AddExternalBowlerDialog
            visible={showAddExternal}
            matchId={matchId}
            inningsId={inningsId}
            onCancel={() => setShowAddExternal(false)}
            onAdded={() => {
              setShowAddExternal(false);
              void load();
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
