import {
  SCORER_REVOKED_MATCH_CANCELLED_MESSAGE,
  SCORER_REVOKED_MID_MATCH_MESSAGE,
  ScorerRevokedReason,
  type ScorerRevokedReason as ScorerRevokedReasonType,
} from '@acc/types';
import { useEffect, useRef } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Button } from '../ui/Button';
import { Text } from '../ui/Text';

const AUTO_REDIRECT_MS = 5000;

export interface ScorerRevokedDialogProps {
  visible: boolean;
  reason?: ScorerRevokedReasonType;
  onDismiss: () => void;
}

function revokeMessage(reason: ScorerRevokedReasonType | undefined): string {
  if (reason === ScorerRevokedReason.Cancelled) {
    return SCORER_REVOKED_MATCH_CANCELLED_MESSAGE;
  }
  return SCORER_REVOKED_MID_MATCH_MESSAGE;
}

/** Shown when a scorer loses access mid-match (swap or cancellation). */
export function ScorerRevokedDialog({
  visible,
  reason,
  onDismiss,
}: ScorerRevokedDialogProps): React.ReactElement {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onDismiss();
    }, AUTO_REDIRECT_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, onDismiss]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-6" onPress={onDismiss}>
        <Pressable
          className="w-full max-w-sm gap-4 rounded-control bg-background p-6"
          onPress={() => undefined}
        >
          <Text className="font-sans-bold text-lg text-on-surface">Scoring access revoked</Text>
          <Text className="font-sans text-sm text-on-surface-variant">{revokeMessage(reason)}</Text>
          <Text className="font-sans text-xs text-on-surface-variant">
            Returning to your dashboard in a few seconds…
          </Text>
          <Button label="Go to Dashboard" onPress={onDismiss} className="h-12" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
