import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, View } from 'react-native';

import {
  DEFAULT_PLACEHOLDER_COLOR,
  FIELD_ORANGE,
  FIELD_VALUE_TEXT_CLASS,
  INPUT_SHADOW_STYLE,
  INPUT_TEXT_STYLE,
  labelClassName,
  mergeFieldClassName,
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
  /** Shows spinner in the field and blocks open while true (unless options already loaded). */
  loading?: boolean;
  /** Inline error below the field; also tints border red. */
  error?: string | null;
  /** Shown in the sheet when options is empty. */
  emptyMessage?: string;
  /** Called from the empty sheet state and from the inline error row. */
  onRetry?: () => void;
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
  loading = false,
  error,
  emptyMessage = 'No options available.',
  onRetry,
  containerClassName,
}: SelectProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const showLoading = loading && options.length === 0;
  const fieldDisabled = disabled || showLoading;

  let fieldClassName = mergeFieldClassName(undefined, { hasTrailingAccessory: true });
  if (error) {
    fieldClassName = fieldClassName.replace(/\bborder-\[#F1F1F1\]/, 'border-error');
  }

  const displayText = selected?.label ?? (showLoading ? 'Loading…' : placeholder);

  return (
    <View className={containerClassName}>
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      <Pressable
        disabled={fieldDisabled}
        onPress={() => setOpen(true)}
        className={`relative ${fieldClassName}`}
        style={INPUT_SHADOW_STYLE}
      >
        <Text
          className={`${FIELD_VALUE_TEXT_CLASS} ${
            selected ? 'text-[#1A1A1A]' : 'text-[#9AA0A6]'
          }`}
          style={INPUT_TEXT_STYLE}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <View className="absolute bottom-0 right-4 top-0 justify-center">
          {showLoading ? (
            <ActivityIndicator size="small" color={FIELD_ORANGE} />
          ) : (
            <Ionicons name="chevron-down" size={20} color={DEFAULT_PLACEHOLDER_COLOR} />
          )}
        </View>
      </Pressable>

      {error ? (
        <View className="mt-1 flex-row flex-wrap items-center gap-x-2">
          <Text className="flex-1 font-sans text-sm text-error">{error}</Text>
          {onRetry ? (
            <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
              <Text className="font-sans-semibold text-sm text-primary">Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[60%] rounded-t-xl bg-white px-4 pb-8 pt-4" onPress={() => {}}>
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-[#E5E5E5]" />
            {label ? (
              <Text className="mb-3 font-sans-bold text-base text-[#1A1A1A]">{label}</Text>
            ) : null}
            {loading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={FIELD_ORANGE} />
              </View>
            ) : (
              <FlatList
                data={options}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const active = item.value === value;
                  return (
                    <Pressable
                      className={`rounded-control px-4 py-3 ${active ? 'bg-[#FDF1EA]' : ''}`}
                      onPress={() => {
                        onChange(item.value);
                        setOpen(false);
                      }}
                    >
                      <Text
                        className={`font-sans text-base ${active ? 'font-sans-semibold text-primary' : 'text-[#1A1A1A]'}`}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View className="items-center gap-3 py-6">
                    <Text className="text-center font-sans text-sm text-[#9AA0A6]">
                      {emptyMessage}
                    </Text>
                    {onRetry ? (
                      <Pressable onPress={onRetry} accessibilityRole="button">
                        <Text className="font-sans-semibold text-sm text-primary">Retry</Text>
                      </Pressable>
                    ) : null}
                  </View>
                }
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
