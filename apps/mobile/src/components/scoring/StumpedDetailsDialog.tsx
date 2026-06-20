import { Ionicons } from '@expo/vector-icons';
import type { FielderPickerResponse } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';

import { AddExternalBowlerDialog } from './AddExternalBowlerDialog';
import { FielderPickerRow } from './FielderPickerRow';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { ApiRequestError, getFielderPicker } from '../../lib/api';

export interface StumpedDetailsConfirm {
  keeperId: string;
  offWide: boolean;
}

export interface StumpedDetailsDialogProps {
  visible: boolean;
  matchId: string;
  inningsId: string;
  onClose: () => void;
  onBack: () => void;
  onConfirm: (result: StumpedDetailsConfirm) => void;
}

/** Wicketkeeper + wide-ball options for a stumping dismissal (§12.1). */
export function StumpedDetailsDialog({
  visible,
  matchId,
  inningsId,
  onClose,
  onBack,
  onConfirm,
}: StumpedDetailsDialogProps): React.ReactElement {
  const [data, setData] = useState<FielderPickerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keeperId, setKeeperId] = useState<string | null>(null);
  const [offWide, setOffWide] = useState(false);
  const [showAddExternal, setShowAddExternal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getFielderPicker(matchId, inningsId, { excludeBowler: true });
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
      setKeeperId(null);
      setOffWide(false);
      void load();
    } else {
      setData(null);
      setKeeperId(null);
      setOffWide(false);
      setError(null);
      setShowAddExternal(false);
    }
  }, [visible, load]);

  const isExternalSide = data?.bowlingSideIsExternal === true;

  function handleConfirm(): void {
    if (!keeperId) return;
    onConfirm({ keeperId, offWide });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onClose}>
        <Pressable
          className="max-h-[85%] w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">Stumped Details</Text>
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
                className="max-h-80"
                contentContainerClassName="gap-4 p-4"
                keyboardShouldPersistTaps="handled"
              >
                <Checkbox checked={offWide} onChange={setOffWide}>
                  <Text className="font-sans text-sm text-on-surface">Is that a wide ball?</Text>
                </Checkbox>

                <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
                  Select the wicket keeper
                </Text>

                {data.players.length === 0 ? (
                  <View className="rounded-control border border-outline-variant bg-surface p-4">
                    <Text className="font-sans text-sm text-on-surface-variant">
                      {isExternalSide
                        ? 'No keepers added yet. Add a fielder by name below (the bowler is excluded).'
                        : 'No eligible keepers — the current bowler cannot be selected for a stumping.'}
                    </Text>
                  </View>
                ) : (
                  <View className="gap-3">
                    {data.players.map((row) => (
                      <FielderPickerRow
                        key={row.userId}
                        row={row}
                        selected={keeperId === row.userId}
                        onPress={setKeeperId}
                      />
                    ))}
                  </View>
                )}
              </ScrollView>

              {isExternalSide ? (
                <View className="border-t border-outline-variant px-4 py-3">
                  <Button
                    variant="outline"
                    label="Add Keeper by Name"
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
                  disabled={!keeperId}
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
