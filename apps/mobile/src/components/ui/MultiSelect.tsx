import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Modal, Pressable, View } from 'react-native';
import { colors } from '@/theme/colors';

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
import type { SelectOption } from './Select';

export interface MultiSelectProps {
  label?: string;
  labelVariant?: LabelVariant;
  placeholder?: string;
  values: string[];
  options?: SelectOption[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRetry?: () => void;
  containerClassName?: string;
  /**
   * When false, selected chips are omitted under the field so the caller can
   * render {@link MultiSelectChips} at full row width (e.g. side-by-side layout).
   */
  showChips?: boolean;
}

export interface MultiSelectChipsProps {
  values: string[];
  options?: SelectOption[];
  onChange: (values: string[]) => void;
  containerClassName?: string;
}

/** Removable selection pills — horizontal wrap across the container width. */
export function MultiSelectChips({
  values,
  options = [],
  onChange,
  containerClassName = 'mt-2 flex-row flex-wrap gap-2',
}: MultiSelectChipsProps): React.ReactElement | null {
  if (values.length === 0) {
    return null;
  }

  const optionByValue = new Map(options.map((option) => [option.value, option]));

  return (
    <View className={containerClassName}>
      {values.map((value) => {
        const chipLabel = optionByValue.get(value)?.label ?? value;
        return (
          <View
            key={value}
            className="flex-row items-center gap-1 rounded-full border border-primary/30 bg-primary-50 px-3 py-1"
          >
            <Text className="font-sans text-sm text-on-surface">{chipLabel}</Text>
            <Pressable
              onPress={() => onChange(values.filter((id) => id !== value))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${chipLabel}`}
            >
              <Ionicons name="close-circle" size={16} color={FIELD_ORANGE} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Multi-select dropdown with checkmarks in the sheet and removable chips below the field.
 */
export function MultiSelect({
  label,
  labelVariant = 'brand',
  placeholder = 'Select…',
  values,
  options = [],
  onChange,
  disabled = false,
  loading = false,
  error,
  emptyMessage = 'No options available.',
  onRetry,
  containerClassName,
  showChips = true,
}: MultiSelectProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(values);

  const safeOptions = options ?? [];
  const showLoading = loading && safeOptions.length === 0;
  const fieldDisabled = disabled || showLoading;

  const optionByValue = useMemo(() => {
    const map = new Map<string, SelectOption>();
    for (const option of safeOptions) {
      map.set(option.value, option);
    }
    return map;
  }, [safeOptions]);

  const selectedLabels = values
    .map((value) => optionByValue.get(value)?.label)
    .filter((name): name is string => Boolean(name));

  let fieldClassName = mergeFieldClassName(undefined, { hasTrailingAccessory: true });
  if (error) {
    fieldClassName = applyFieldErrorBorder(fieldClassName);
  }

  const displayText =
    selectedLabels.length > 0
      ? selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} centers selected`
      : showLoading
        ? 'Loading…'
        : placeholder;

  function openSheet(): void {
    Keyboard.dismiss();
    setDraft(values);
    setOpen(true);
  }

  function toggleDraft(value: string): void {
    setDraft((prev) =>
      prev.includes(value) ? prev.filter((id) => id !== value) : [...prev, value],
    );
  }

  function applyDraft(): void {
    onChange(draft);
    setOpen(false);
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
            selectedLabels.length > 0 ? 'text-text' : 'text-text-muted'
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

      {showChips ? (
        <MultiSelectChips values={values} options={safeOptions} onChange={onChange} />
      ) : null}

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
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[70%] rounded-t-xl bg-surface px-4 pb-8 pt-4" onPress={() => {}}>
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-stone-200" />
            <View className="mb-3 flex-row items-center justify-between">
              {label ? (
                <Text className="font-sans-bold text-base text-text">{label}</Text>
              ) : (
                <View />
              )}
              <Pressable onPress={applyDraft} hitSlop={8} accessibilityRole="button">
                <Text className="font-sans-semibold text-sm text-primary">Done</Text>
              </Pressable>
            </View>
            {loading ? (
              <View className="items-center py-8">
                <ActivityIndicator color={FIELD_ORANGE} />
              </View>
            ) : (
              <FlatList
                data={safeOptions}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const checked = draft.includes(item.value);
                  return (
                    <Pressable
                      className={`flex-row items-center gap-3 rounded-control px-4 py-3 ${
                        checked ? 'bg-primary-50' : ''
                      }`}
                      onPress={() => toggleDraft(item.value)}
                    >
                      <View
                        className={`h-5 w-5 items-center justify-center rounded-md border ${
                          checked ? 'border-primary bg-primary' : 'border-stone-300 bg-surface'
                        }`}
                      >
                        {checked ? <Ionicons name="checkmark" size={14} color={colors.textInverse} /> : null}
                      </View>
                      <Text
                        className={`flex-1 font-sans text-base ${
                          checked ? 'font-sans-semibold text-primary' : 'text-text'
                        }`}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View className="items-center gap-3 py-6">
                    <Text className="text-center font-sans text-sm text-text-muted">
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
