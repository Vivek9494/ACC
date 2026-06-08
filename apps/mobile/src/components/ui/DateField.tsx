import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { MIN_SIGNUP_AGE } from '@acc/types';
import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import {
  FIELD_ORANGE,
  fieldBodyPaddingClass,
  FIELD_VALUE_TEXT_STYLE,
  fieldValueTextClassName,
  inputFieldShellStyle,
  labelClassName,
  mergeFieldShellClassName,
  type LabelVariant,
} from './fieldStyles';
import { Text } from './Text';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date as YYYY-MM-DD in local time. */
export function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** Latest selectable DOB so the user is at least MIN_SIGNUP_AGE (spec §3.1). */
export function maxBirthDateForSignup(today = new Date()): Date {
  return new Date(today.getFullYear() - MIN_SIGNUP_AGE, today.getMonth(), today.getDate());
}

export interface DateFieldProps {
  label?: string;
  labelVariant?: LabelVariant;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  containerClassName?: string;
}

/**
 * Date field with calendar icon and native picker. Enforces 18+ maximum birth date.
 */
export function DateField({
  label,
  labelVariant = 'brand',
  value,
  onChange,
  placeholder = 'yyyy-mm-dd',
  containerClassName,
}: DateFieldProps): React.ReactElement {
  const [showPicker, setShowPicker] = useState(false);
  const maxDate = useMemo(() => maxBirthDateForSignup(), []);
  const parsed = value ? parseIsoDate(value) : null;
  const pickerValue = parsed ?? maxDate;

  function onPickerChange(event: DateTimePickerEvent, selected?: Date): void {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'dismissed' || !selected) return;
    onChange(formatIsoDate(selected));
  }

  return (
    <View className={['w-full min-w-0', containerClassName].filter(Boolean).join(' ')}>
      {label ? <Text className={labelClassName(labelVariant)}>{label}</Text> : null}
      <Pressable
        onPress={() => setShowPicker(true)}
        className={`${mergeFieldShellClassName()} ${fieldBodyPaddingClass({ hasLeadingIcon: true })}`}
        style={inputFieldShellStyle()}
      >
        <View className="absolute inset-y-0 left-5 justify-center">
          <Ionicons name="calendar-outline" size={20} color={FIELD_ORANGE} />
        </View>
        <Text
          className={fieldValueTextClassName(Boolean(parsed))}
          style={FIELD_VALUE_TEXT_STYLE}
        >
          {parsed ? value : placeholder}
        </Text>
      </Pressable>

      {showPicker ? (
        Platform.OS === 'ios' ? (
          <View className="mt-2 overflow-hidden rounded-xl border border-[#F1F1F1] bg-white">
            <View className="flex-row justify-end border-b border-[#F1F1F1] px-3 py-2">
              <Pressable onPress={() => setShowPicker(false)} hitSlop={8}>
                <Text className="font-sans-semibold text-sm text-[#F37021]">Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display="spinner"
              maximumDate={maxDate}
              onChange={onPickerChange}
            />
          </View>
        ) : (
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display="default"
            maximumDate={maxDate}
            onChange={onPickerChange}
          />
        )
      ) : null}
    </View>
  );
}
