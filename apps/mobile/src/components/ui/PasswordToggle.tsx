import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { colors } from '@/theme/colors';

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

/** Eye icon toggle for password fields — use as TextInput `rightAccessory`. */
export function PasswordToggle({ visible, onToggle }: PasswordToggleProps): React.ReactElement {
  return (
    <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="button">
      <Ionicons
        name={visible ? 'eye-off-outline' : 'eye-outline'}
        size={22}
        color={colors.textMuted}
      />
    </Pressable>
  );
}
