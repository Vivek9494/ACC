import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { DateTimePickerSheet } from './DateTimePickerSheet';
import {
  FIELD_ORANGE,
  FIELD_VALUE_TEXT_CLASS,
  INPUT_SHADOW_STYLE,
  INPUT_TEXT_STYLE,
  labelClassName,
  mergeFieldClassName,
  type LabelVariant,
} from './fieldStyles';
import { Text } from './Text';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format HH:mm (24h). */
export function formatTimeValue(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseTimeValue(value: string): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatDisplayTime(value: string): string {
  const parsed = parseTimeValue(value);
  if (!parsed) {
    return value;
  }
  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export interface TimeFieldProps {
  label?: string;
  labelVariant?: LabelVariant;
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  error?: string;
  containerClassName?: string;
}

/** Time picker field matching shared input styling (HH:mm, 24h storage). */
export function TimeField({
  label,
  labelVariant = 'brand',
  value,
  onChange,
  placeholder = 'Select time',
  error,
  containerClassName,
}: TimeFieldProps): React.ReactElement {
  const [showPicker, setShowPicker] = useState(false);
  const parsed = value ? parseTimeValue(value) : null;
  const pickerValue = useMemo(() => parsed ?? new Date(), [parsed]);

  function onAndroidPickerChange(event: DateTimePickerEvent, selected?: Date): void {
    setShowPicker(false);
    if (event.type === 'dismissed' || !selected) {
      return;
    }
    onChange(formatTimeValue(selected));
  }

  let fieldClassName = mergeFieldClassName('flex-row items-center', { hasLeadingIcon: true });
  if (error) {
    fieldClassName = fieldClassName.replace(/\bborder-\[#F1F1F1\]/, 'border-error');
  }

  return (
    <View className={containerClassName}>
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      <Pressable
        onPress={() => setShowPicker(true)}
        className={`relative ${fieldClassName}`}
        style={INPUT_SHADOW_STYLE}
      >
        <View className="absolute inset-y-0 left-5 justify-center">
          <Ionicons name="time-outline" size={20} color={FIELD_ORANGE} />
        </View>
        <Text
          className={`${FIELD_VALUE_TEXT_CLASS} ${parsed ? 'text-[#1A1A1A]' : 'text-[#9AA0A6]'}`}
          style={INPUT_TEXT_STYLE}
        >
          {parsed ? formatDisplayTime(value) : placeholder}
        </Text>
      </Pressable>
      {error ? <Text className="mt-1 font-sans text-sm text-error">{error}</Text> : null}

      <DateTimePickerSheet
        visible={showPicker}
        mode="time"
        value={pickerValue}
        onConfirm={(selected) => {
          onChange(formatTimeValue(selected));
          setShowPicker(false);
        }}
        onCancel={() => setShowPicker(false)}
      />

      {showPicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          display="default"
          onChange={onAndroidPickerChange}
        />
      ) : null}
    </View>
  );
}
