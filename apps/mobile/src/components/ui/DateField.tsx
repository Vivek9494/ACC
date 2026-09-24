import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { MIN_SIGNUP_AGE } from '@acc/types';
import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { DateTimePickerSheet } from './DateTimePickerSheet';
import {
  FIELD_CONTROL_MIN_HEIGHT_CLASS,
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date as YYYY-MM-DD in local time. */
export function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Format a Date for display: e.g. "June 8, 2026" (long) or "Jun 8, 2026" (short). */
export function formatDisplayDate(
  date: Date,
  month: 'long' | 'short' = 'long',
): string {
  return date.toLocaleDateString('en-US', {
    month,
    day: 'numeric',
    year: 'numeric',
  });
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

function calendarDayKey(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function isBeforeCalendarDay(a: Date, b: Date): boolean {
  return calendarDayKey(a) < calendarDayKey(b);
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
  /** When set, shows primary-orange border and optionally the message below. */
  error?: string;
  /** When false, still applies error border but hides the message (pair-level copy). Default true. */
  showErrorMessage?: boolean;
  containerClassName?: string;
  /** When true (default), caps selectable dates for 18+ signup DOB. */
  enforceSignupAgeMax?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Short month (e.g. "Jun 8, 2026") — use in narrow side-by-side layouts. */
  compactDisplay?: boolean;
  /** Smaller control height/padding for dense rows (e.g. analytics date range). */
  compact?: boolean;
}

/**
 * Date field with calendar icon and native picker. Enforces 18+ maximum birth date.
 */
export function DateField({
  label,
  labelVariant = 'brand',
  value,
  onChange,
  placeholder = 'Month D, YYYY',
  error,
  showErrorMessage = true,
  containerClassName,
  enforceSignupAgeMax = true,
  minimumDate,
  maximumDate,
  compactDisplay = false,
  compact = false,
}: DateFieldProps): React.ReactElement {
  const [showPicker, setShowPicker] = useState(false);
  const signupMaxDate = useMemo(() => maxBirthDateForSignup(), []);
  const defaultPickerDate = useMemo(() => new Date(), []);
  const effectiveMaximumDate = maximumDate ?? (enforceSignupAgeMax ? signupMaxDate : undefined);
  const parsed = value ? parseIsoDate(value) : null;
  const pickerValue = useMemo(() => {
    const selected = parseIsoDate(value);
    if (selected && minimumDate && isBeforeCalendarDay(selected, minimumDate)) {
      return minimumDate;
    }
    return selected ?? minimumDate ?? effectiveMaximumDate ?? defaultPickerDate;
  }, [defaultPickerDate, effectiveMaximumDate, minimumDate, value]);

  function onAndroidPickerChange(event: DateTimePickerEvent, selected?: Date): void {
    setShowPicker(false);
    if (event.type === 'dismissed' || !selected) return;
    onChange(formatIsoDate(selected));
  }

  const heightClass = compact ? 'min-h-11' : FIELD_CONTROL_MIN_HEIGHT_CLASS;
  let fieldClassName = mergeFieldClassName(
    compact ? 'flex-row items-center px-3 py-2 pl-11' : 'flex-row items-center',
    { hasLeadingIcon: !compact },
  );
  if (error) {
    fieldClassName = applyFieldErrorBorder(fieldClassName);
  }

  const labelClass = compact
    ? 'font-sans text-sm leading-5 text-text-muted mb-1 ml-0.5'
    : labelClassName(labelVariant);

  return (
    <View className={containerClassName}>
      {label ? <Text className={labelClass}>{label}</Text> : null}
      <Pressable
        onPress={() => setShowPicker(true)}
        className={`relative ${heightClass} ${fieldClassName}`}
        style={INPUT_SHADOW_STYLE}
      >
        <View
          className={`absolute inset-y-0 justify-center ${compact ? 'left-3' : 'left-5'}`}
        >
          <Ionicons
            name="calendar-outline"
            size={compact ? 16 : 20}
            color={FIELD_ORANGE}
          />
        </View>
        <Text
          className={`min-w-0 flex-1 ${FIELD_VALUE_TEXT_CLASS} ${
            compact ? 'text-sm' : ''
          } ${parsed ? 'text-text' : 'text-text-muted'}`}
          style={compact ? { fontSize: 14 } : INPUT_TEXT_STYLE}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {parsed
            ? formatDisplayDate(parsed, compact || compactDisplay ? 'short' : 'long')
            : placeholder}
        </Text>
      </Pressable>

      <FormErrorText inline>{showErrorMessage ? error : null}</FormErrorText>

      <DateTimePickerSheet
        visible={showPicker}
        mode="date"
        value={pickerValue}
        minimumDate={minimumDate}
        maximumDate={effectiveMaximumDate}
        onConfirm={(selected) => {
          onChange(formatIsoDate(selected));
          setShowPicker(false);
        }}
        onCancel={() => setShowPicker(false)}
      />

      {showPicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={effectiveMaximumDate}
          onChange={onAndroidPickerChange}
        />
      ) : null}
    </View>
  );
}
