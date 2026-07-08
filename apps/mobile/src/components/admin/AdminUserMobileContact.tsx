import { formatCanadianMobileForDisplay } from '@acc/types';
import { Linking, Pressable } from 'react-native';

import { copyTextToClipboard } from '../../lib/copy-text';
import { Text } from '../ui/Text';

export interface AdminUserMobileContactProps {
  /** Full E.164 — present only when the server grants admin PII access. */
  mobileNumber?: string | null;
  /** Always present; used when full mobile is withheld. */
  maskedMobileNumber: string;
  textClassName?: string;
}

function isMissingPhone(maskedMobileNumber: string, mobileNumber?: string | null): boolean {
  if (mobileNumber?.trim()) {
    return false;
  }
  const masked = maskedMobileNumber.trim();
  return masked.length === 0 || masked === '+1 (***) ***-****';
}

/** Admin directory mobile — full number with tap-to-call; masked fallback for non-admin payloads. */
export function AdminUserMobileContact({
  mobileNumber,
  maskedMobileNumber,
  textClassName = 'font-sans text-sm',
}: AdminUserMobileContactProps): React.ReactElement {
  if (isMissingPhone(maskedMobileNumber, mobileNumber)) {
    return (
      <Text className={`${textClassName} text-text-muted`} numberOfLines={1}>
        No phone on file
      </Text>
    );
  }

  if (mobileNumber) {
    const display = formatCanadianMobileForDisplay(mobileNumber);
    return (
      <Pressable
        onPress={() => void Linking.openURL(`tel:${mobileNumber}`)}
        onLongPress={() => void copyTextToClipboard(mobileNumber)}
        accessibilityRole="link"
        accessibilityLabel={`Call ${display}`}
        accessibilityHint="Long press to copy number"
        hitSlop={4}
      >
        <Text className={`${textClassName} text-primary`} numberOfLines={1}>
          {display}
        </Text>
      </Pressable>
    );
  }

  return (
    <Text className={`${textClassName} text-text-muted`} numberOfLines={1}>
      {maskedMobileNumber}
    </Text>
  );
}
