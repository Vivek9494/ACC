import { Ionicons } from '@expo/vector-icons';
import { PASSWORD_POLICY_RULES, passwordPolicyChecks } from '@acc/types';
import { View } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

export interface PasswordRequirementsProps {
  password: string;
}

/** Live password-policy checklist driven by {@link PASSWORD_POLICY_RULES}. */
export function PasswordRequirements({ password }: PasswordRequirementsProps): React.ReactElement {
  const checks = passwordPolicyChecks(password);

  return (
    <View className="gap-2">
      <Text className="font-sans-semibold text-xs uppercase tracking-wider text-text-muted">
        Security requirements
      </Text>
      {PASSWORD_POLICY_RULES.map((rule) => {
        const met = checks[rule.id];
        return (
          <View key={rule.id} className="flex-row items-center gap-2">
            <Ionicons
              name={met ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={met ? colors.primary : colors.textMuted}
            />
            <Text
              className={`font-sans text-sm ${met ? 'text-text' : 'text-text-muted'}`}
            >
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
