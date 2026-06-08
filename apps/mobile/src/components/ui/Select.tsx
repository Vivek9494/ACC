import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';

import {
  DEFAULT_PLACEHOLDER_COLOR,
  fieldBodyPaddingClass,
  FIELD_VALUE_TEXT_STYLE,
  fieldValueTextClassName,
  inputFieldShellStyle,
  labelClassName,
  mergeFieldShellClassName,
  type LabelVariant,
} from './fieldStyles';
import { Text } from './Text';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  labelVariant?: LabelVariant;
  placeholder?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  containerClassName?: string;
}

/**
 * Dropdown field matching the shared input style. Opens a modal picker.
 */
export function Select({
  label,
  labelVariant = 'brand',
  placeholder = 'Select…',
  value,
  options,
  onChange,
  disabled = false,
  containerClassName,
}: SelectProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View className={['w-full min-w-0', containerClassName].filter(Boolean).join(' ')}>
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={`${mergeFieldShellClassName()} ${fieldBodyPaddingClass({ hasTrailingAccessory: true })}`}
        style={inputFieldShellStyle()}
      >
        <Text className={fieldValueTextClassName(Boolean(selected))} style={FIELD_VALUE_TEXT_STYLE}>
          {selected?.label ?? placeholder}
        </Text>
        <View className="absolute inset-y-0 right-4 justify-center">
          <Ionicons name="chevron-down" size={20} color={DEFAULT_PLACEHOLDER_COLOR} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <View className="max-h-[60%] rounded-t-xl bg-white px-4 pb-8 pt-4">
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-[#E5E5E5]" />
            {label ? (
              <Text className="mb-3 font-sans-bold text-base text-[#1A1A1A]">{label}</Text>
            ) : null}
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    className={`rounded-xl px-4 py-3 ${active ? 'bg-[#FDF1EA]' : ''}`}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      className={`font-sans text-base ${active ? 'font-sans-semibold text-[#F37021]' : 'text-[#1A1A1A]'}`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text className="py-6 text-center font-sans text-sm text-[#9AA0A6]">
                  No options available.
                </Text>
              }
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
