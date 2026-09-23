import { useRef } from 'react';
import { Pressable, type TextInput as RNTextInput, View } from 'react-native';
import { Text } from './ui/Text';
import { TextInput } from './ui/TextInput';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
}

/**
 * Segmented OTP entry: a row of digit cells backed by a single transparent
 * TextInput that captures focus/keyboard (robust paste + backspace handling).
 */
export function OtpInput({
  value,
  onChange,
  length = 4,
  autoFocus = false,
}: OtpInputProps): React.ReactElement {
  const inputRef = useRef<RNTextInput>(null);

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View className="flex-row justify-center gap-3">
        {Array.from({ length }).map((_, i) => {
          const active = value.length === i;
          const filled = value.length > i;
          return (
            <View
              key={i}
              className={`h-16 w-14 items-center justify-center rounded-xl border bg-surface-container-low ${
                active ? 'border-primary' : filled ? 'border-outline-variant' : 'border-outline-variant/60'
              }`}
            >
              <Text className="font-sans-bold text-2xl text-on-surface">{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        className="absolute h-full w-full opacity-0"
      />
    </Pressable>
  );
}
