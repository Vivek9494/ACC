import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { PASSWORD_POLICY_RULES, passwordPolicyChecks } from '@acc/types';

import { FIELD_ORANGE } from './fieldStyles';
import { Text } from './Text';

export interface PasswordRequirementsProps {
  password: string;
}

/** Live password-policy checklist driven by {@link PASSWORD_POLICY_RULES}. */
export function PasswordRequirements({ password }: PasswordRequirementsProps): React.ReactElement {
  const checks = passwordPolicyChecks(password);

  return (
    <View className="gap-2">
      <Text className="font-sans-semibold text-xs uppercase tracking-wider text-on-surface-variant">
        Security requirements
      </Text>
      {PASSWORD_POLICY_RULES.map((rule) => {
        const met = checks[rule.id];
        return (
          <View key={rule.id} className="flex-row items-center gap-2">
            <Ionicons
              name={met ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={met ? FIELD_ORANGE : '#9AA0A6'}
            />
            <Text
              className={`font-sans text-sm ${met ? 'text-on-surface' : 'text-on-surface-variant'}`}
            >
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
