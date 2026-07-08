import { KNOCKOUT_BRACKET_MESSAGES } from '@acc/types';
import type { ReactElement } from 'react';
import { View } from 'react-native';

import { Text } from '../ui/Text';

export function KnockoutAwaitingConfirmationNotice(): ReactElement {
  return (
    <Text className="font-sans text-sm text-amber-700">
      {KNOCKOUT_BRACKET_MESSAGES.awaitingScorecardConfirmation}
    </Text>
  );
}

export function KnockoutAwaitingConfirmationPill(): ReactElement {
  return (
    <View className="rounded-full bg-amber-100 px-2 py-0.5">
      <Text className="font-sans-semibold text-[10px] text-amber-800">
        {KNOCKOUT_BRACKET_MESSAGES.awaitingScorecardConfirmationShort}
      </Text>
    </View>
  );
}

export function KnockoutFeederAwaitingConfirmationHint(): ReactElement {
  return (
    <Text className="font-sans text-xs text-amber-700">
      {KNOCKOUT_BRACKET_MESSAGES.feederAwaitingScorecardConfirmation}
    </Text>
  );
}
