import type { FielderPickerResponse } from '@acc/types';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';

import { AddExternalBowlerDialog } from './AddExternalBowlerDialog';
import { FielderPickerRow } from './FielderPickerRow';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../ui/fieldStyles';
import { ApiRequestError, getFielderPicker } from '../../lib/api';

export interface CatchDropFielderPickerProps {
  visible: boolean;
  matchId: string;
  inningsId: string;
  onCancel: () => void;
  onConfirm: (fielderId: string) => void;
}

/** Bowling-side fielder picker for dropped-catch metadata events. */
export function CatchDropFielderPicker({
  visible,
  matchId,
  inningsId,
  onCancel,
  onConfirm,
}: CatchDropFielderPickerProps): React.ReactElement {
  const [data, setData] = useState<FielderPickerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
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
      setPendingId(null);
      void load();
    } else {
      setData(null);
      setPendingId(null);
      setError(null);
      setShowAddExternal(false);
    }
  }, [visible, load]);

  const isExternalSide = data?.bowlingSideIsExternal === true;
  const showAddFielderByName =
    isExternalSide && data?.externalPlayingXiConfirmed !== true;

  function handleConfirm(): void {
    if (!pendingId) return;
    onConfirm(pendingId);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="max-h-[85%] w-full max-w-sm overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">Who dropped the catch?</Text>
            <Text className="mt-1 font-sans text-sm text-on-surface-variant">
              Select a fielder from the bowling side. This does not change the score or advance the over.
            </Text>
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
              <Button label="Cancel" variant="outline" onPress={onCancel} className="h-11" />
            </View>
          ) : data ? (
            <>
              <ScrollView
                className="max-h-80"
                contentContainerClassName="gap-3 p-4"
                keyboardShouldPersistTaps="handled"
              >
                {data.players.length === 0 ? (
                  <View className="rounded-control border border-outline-variant bg-surface p-4">
                    <Text className="font-sans text-sm text-on-surface-variant">
                      {isExternalSide
                        ? 'No fielders added yet. Add the fielder by name below.'
                        : 'No bowling-side players available. Lock the Playing 11 before the match.'}
                    </Text>
                  </View>
                ) : (
                  data.players.map((row) => (
                    <FielderPickerRow
                      key={row.userId}
                      row={row}
                      selected={pendingId === row.userId}
                      onPress={setPendingId}
                    />
                  ))
                )}
              </ScrollView>

              {showAddFielderByName ? (
                <View className="border-t border-outline-variant px-4 py-3">
                  <Button
                    variant="outline"
                    label="Add Fielder by Name"
                    onPress={() => setShowAddExternal(true)}
                    className="h-11"
                  />
                </View>
              ) : null}

              <View className="gap-2 border-t border-outline-variant p-4">
                <Button
                  label="Record dropped catch"
                  onPress={handleConfirm}
                  disabled={!pendingId}
                  className="h-11"
                />
                <Button label="Cancel" variant="outline" onPress={onCancel} className="h-11" />
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
