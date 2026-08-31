import {
  DeliveryType,
  DismissalType,
  buildEditDeliveryBodyFromTimeline,
  type EditDeliveryRequest,
  type TimelineEntry,
} from '@acc/types';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { INPUT_SHADOW_STYLE } from '../../ui/fieldStyles';

export interface EditBallDialogProps {
  visible: boolean;
  entry: TimelineEntry | null;
  over: number;
  ball: number;
  saving?: boolean;
  onCancel: () => void;
  onSave: (
    deliveryId: string,
    body: Omit<EditDeliveryRequest, 'deliveryId' | 'expectedVersion'>,
  ) => void;
}

const LEGAL_RUNS = [0, 1, 2, 3, 4, 6] as const;
const WIDE_RAN = [0, 1, 2, 3, 4, 6] as const;

function RunChip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      className={`min-h-[36px] min-w-[44px] items-center justify-center rounded-control border px-2 ${
        active
          ? 'border-primary bg-primary-50'
          : 'border-outline-variant bg-surface-container-lowest'
      } ${disabled ? 'opacity-40' : 'active:opacity-80'}`}
    >
      <Text
        className={`font-sans-bold text-[13px] ${active ? 'text-primary' : 'text-on-surface'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Desktop — edit a past delivery via PUT /deliveries (engine re-folds the innings). */
export function EditBallDialog({
  visible,
  entry,
  over,
  ball,
  saving = false,
  onCancel,
  onSave,
}: EditBallDialogProps): React.ReactElement {
  const baseBody = useMemo(
    () => (entry ? buildEditDeliveryBodyFromTimeline(entry) : null),
    [entry],
  );

  const [legalRuns, setLegalRuns] = useState(0);
  const [wideRan, setWideRan] = useState(0);
  const [noBallRuns, setNoBallRuns] = useState(0);
  const [removeWicket, setRemoveWicket] = useState(false);
  const [addBowledWicket, setAddBowledWicket] = useState(false);

  useEffect(() => {
    if (!visible || !entry || !baseBody) return;
    setRemoveWicket(false);
    setAddBowledWicket(false);
    if (baseBody.type === DeliveryType.Legal) {
      setLegalRuns(baseBody.runsBat);
    } else if (baseBody.type === DeliveryType.Wide) {
      setWideRan(Math.max(0, baseBody.extraRuns - 1));
    } else if (baseBody.type === DeliveryType.NoBall) {
      setNoBallRuns(baseBody.runsBat);
    }
  }, [visible, entry, baseBody]);

  function handleSave(): void {
    if (!entry?.deliveryId || !baseBody) return;
    let body: Omit<EditDeliveryRequest, 'deliveryId' | 'expectedVersion'> = { ...baseBody };

    switch (baseBody.type) {
      case DeliveryType.Legal: {
        const { dismissal, ...legalBase } = baseBody;
        body = {
          ...legalBase,
          runsBat: legalRuns,
          isBoundary: legalRuns === 4 || legalRuns === 6,
        };
        if (removeWicket) {
          break;
        }
        if (addBowledWicket && entry.strikerId) {
          body.dismissal = { type: DismissalType.Bowled, dismissedId: entry.strikerId };
        } else if (dismissal) {
          body.dismissal = dismissal;
        }
        break;
      }
      case DeliveryType.Wide:
        body = { ...baseBody, extraRuns: 1 + wideRan, runsBat: 0 };
        break;
      case DeliveryType.NoBall:
        body = {
          ...baseBody,
          runsBat: noBallRuns,
          isBoundary: noBallRuns === 4 || noBallRuns === 6,
        };
        break;
      default:
        break;
    }

    onSave(entry.deliveryId, body);
  }

  const title = entry ? `Over ${over}, Ball ${ball}` : 'Edit ball';
  const canEditRuns =
    baseBody != null &&
    (baseBody.type === DeliveryType.Legal ||
      baseBody.type === DeliveryType.Wide ||
      baseBody.type === DeliveryType.NoBall);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/40 px-4" onPress={onCancel}>
        <Pressable
          className="w-full max-w-md overflow-hidden rounded-control bg-surface"
          style={INPUT_SHADOW_STYLE}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="border-b border-outline-variant px-4 py-3">
            <Text className="font-sans-bold text-lg text-on-surface">{title}</Text>
            {entry ? (
              <Text className="mt-1 font-sans text-sm text-on-surface-variant">
                {entry.description}
              </Text>
            ) : null}
          </View>

          <View className="gap-4 p-4">
            {!entry || !baseBody ? (
              <Text className="font-sans text-sm text-on-surface-variant">
                Select a delivered ball to edit.
              </Text>
            ) : !canEditRuns ? (
              <Text className="font-sans text-sm text-on-surface-variant">
                This delivery type cannot be edited from Play Control yet. Use undo and re-score,
                or contact an admin for post-confirmation correction.
              </Text>
            ) : baseBody.type === DeliveryType.Legal ? (
              <View className="gap-3">
                <View className="gap-2">
                  <Text className="font-sans text-sm text-on-surface">Runs off the bat</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {LEGAL_RUNS.map((runs) => (
                      <RunChip
                        key={runs}
                        label={String(runs)}
                        active={legalRuns === runs}
                        disabled={saving}
                        onPress={() => setLegalRuns(runs)}
                      />
                    ))}
                  </View>
                </View>
                {entry.isWicket ? (
                  <View className="gap-2">
                    <Text className="font-sans text-sm text-on-surface">Wicket</Text>
                    <RunChip
                      label={removeWicket ? 'Wicket removed' : 'Remove wicket'}
                      active={removeWicket}
                      disabled={saving}
                      onPress={() => setRemoveWicket((v) => !v)}
                    />
                  </View>
                ) : entry.strikerId ? (
                  <View className="gap-2">
                    <Text className="font-sans text-sm text-on-surface">Wicket</Text>
                    <RunChip
                      label={addBowledWicket ? 'Striker bowled' : 'Mark striker bowled'}
                      active={addBowledWicket}
                      disabled={saving}
                      onPress={() => setAddBowledWicket((v) => !v)}
                    />
                  </View>
                ) : null}
              </View>
            ) : baseBody.type === DeliveryType.Wide ? (
              <View className="gap-2">
                <Text className="font-sans text-sm text-on-surface">Wide + runs</Text>
                <View className="flex-row flex-wrap gap-2">
                  {WIDE_RAN.map((ran) => (
                    <RunChip
                      key={ran}
                      label={ran === 0 ? 'Wd' : `Wd+${ran}`}
                      active={wideRan === ran}
                      disabled={saving}
                      onPress={() => setWideRan(ran)}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <View className="gap-2">
                <Text className="font-sans text-sm text-on-surface">No-ball off the bat</Text>
                <View className="flex-row flex-wrap gap-2">
                  {LEGAL_RUNS.map((runs) => (
                    <RunChip
                      key={runs}
                      label={String(runs)}
                      active={noBallRuns === runs}
                      disabled={saving}
                      onPress={() => setNoBallRuns(runs)}
                    />
                  ))}
                </View>
              </View>
            )}

            <View className="flex-row gap-2">
              <Button
                label="Cancel"
                variant="outline"
                onPress={onCancel}
                disabled={saving}
                className="h-11 flex-1"
              />
              <Button
                label={saving ? 'Saving…' : 'Save'}
                onPress={handleSave}
                disabled={!entry?.deliveryId || !canEditRuns || saving}
                className="h-11 flex-1"
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
