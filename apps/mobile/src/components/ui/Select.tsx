import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Modal, Pressable, View } from 'react-native';

import {
  DEFAULT_PLACEHOLDER_COLOR,
  FIELD_ORANGE,
  FIELD_VALUE_TEXT_CLASS,
  INPUT_SHADOW_STYLE,
  INPUT_TEXT_STYLE,
  labelClassName,
  mergeFieldClassName,
  applyFieldErrorBorder,
  type LabelVariant,
} from './fieldStyles';
import { FormErrorText } from './FormErrorText';
import { Text } from './Text';
import { TextInput } from './TextInput';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  labelVariant?: LabelVariant;
  placeholder?: string;
  value: string | null;
  options?: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Shows spinner in the field and blocks open while true (unless options already loaded). */
  loading?: boolean;
  /** Inline error below the field; also tints border primary-orange. */
  error?: string | null;
  /** Shown in the sheet when options is empty. */
  emptyMessage?: string;
  /** Called from the empty sheet state and from the inline error row. */
  onRetry?: () => void;
  /** When true, shows a search field in the picker sheet to filter options by label. */
  searchable?: boolean;
  /** Placeholder for the in-sheet search field. */
  searchPlaceholder?: string;
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
  options = [],
  onChange,
  disabled = false,
  loading = false,
  error,
  emptyMessage = 'No options available.',
  onRetry,
  searchable = false,
  searchPlaceholder = 'Search…',
  containerClassName,
}: SelectProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const safeOptions = options ?? [];
  const selected = safeOptions.find((o) => o.value === value);
  const showLoading = loading && safeOptions.length === 0;
  const fieldDisabled = disabled || showLoading;

  const filteredOptions = useMemo(() => {
    if (!searchable) {
      return safeOptions;
    }
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return safeOptions;
    }
    return safeOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [safeOptions, searchQuery, searchable]);

  let fieldClassName = mergeFieldClassName(undefined, { hasTrailingAccessory: true });
  if (error) {
    fieldClassName = applyFieldErrorBorder(fieldClassName);
  }

  const displayText = selected?.label ?? (showLoading ? 'Loading…' : placeholder);

  function openSheet(): void {
    Keyboard.dismiss();
    setSearchQuery('');
    setOpen(true);
  }

  function closeSheet(): void {
    setOpen(false);
    setSearchQuery('');
  }

  return (
    <View className={containerClassName}>
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      <Pressable
        disabled={fieldDisabled}
        onPress={openSheet}
        className={`relative ${fieldClassName}`}
        style={INPUT_SHADOW_STYLE}
      >
        <Text
          className={`${FIELD_VALUE_TEXT_CLASS} ${
            selected ? 'text-text' : 'text-text-muted'
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
          <FormErrorText className="flex-1">{error}</FormErrorText>
          {onRetry ? (
            <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
              <Text className="font-sans-semibold text-sm text-primary">Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        // Keep the underlying form ScrollView mounted/offset (iOS Modal default
        // can reset KeyboardAwareFormScrollView to the top).
        presentationStyle="overFullScreen"
        onRequestClose={closeSheet}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={closeSheet}>
          <View
            className="max-h-[70%] rounded-t-xl bg-surface px-4 pb-8 pt-4"
            onStartShouldSetResponder={() => true}
          >
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-stone-200" />
            {label ? (
              <Text className="mb-3 font-sans-bold text-base text-text">{label}</Text>
            ) : null}
            {searchable ? (
              <TextInput
                label=""
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={searchPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                containerClassName="mb-3"
              />
            ) : null}
            {loading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={FIELD_ORANGE} />
              </View>
            ) : (
              <FlatList
                data={filteredOptions}
                keyExtractor={(item, index) => `${item.value}::${index}`}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ paddingBottom: 8 }}
                renderItem={({ item }) => {
                  const active = item.value === value;
                  return (
                    <Pressable
                      className={`rounded-control px-4 py-3 ${active ? 'bg-primary-50' : ''}`}
                      onPress={() => {
                        onChange(item.value);
                        closeSheet();
                      }}
                    >
                      <Text
                        className={`font-sans text-base ${active ? 'font-sans-semibold text-primary' : 'text-text'}`}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View className="items-center gap-3 py-6">
                    <Text className="text-center font-sans text-sm text-text-muted">
                      {searchQuery.trim() ? 'No matching options.' : emptyMessage}
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
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
