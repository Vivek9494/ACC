import { useMemo } from 'react';
import { View } from 'react-native';

import { DateField } from './DateField';
import { FormErrorText } from './FormErrorText';
import { labelClassName } from './fieldStyles';
import { Text } from './Text';

export interface TournamentLeatherDateRangeFieldProps {
  fromDate: string;
  endDate: string;
  onFromDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  /** Start-of-today in venue local tz for the native date picker floor. */
  minimumFromDate: Date;
  fromError?: string | null;
  endError?: string | null;
  /** Span / match-lock errors that apply to the date range as a whole. */
  spanError?: string | null;
}

/**
 * Leather tournament span: from/end date pickers (not individual match days).
 */
export function TournamentLeatherDateRangeField({
  fromDate,
  endDate,
  onFromDateChange,
  onEndDateChange,
  minimumFromDate,
  fromError,
  endError,
  spanError,
}: TournamentLeatherDateRangeFieldProps): React.ReactElement {
  const endMinimumDate = useMemo(() => {
    if (!fromDate) {
      return minimumFromDate;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromDate);
    if (!match) {
      return minimumFromDate;
    }
    const fromLocal = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return isBeforeCalendarDay(fromLocal, minimumFromDate) ? minimumFromDate : fromLocal;
  }, [fromDate, minimumFromDate]);

  return (
    <View className="gap-4">
      <Text className={labelClassName()}>Tournament Dates</Text>
      <DateField
        label="From Date"
        value={fromDate}
        onChange={onFromDateChange}
        enforceSignupAgeMax={false}
        minimumDate={minimumFromDate}
        error={fromError}
      />
      <DateField
        label="End Date"
        value={endDate}
        onChange={onEndDateChange}
        enforceSignupAgeMax={false}
        minimumDate={endMinimumDate}
        error={endError}
      />
      <FormErrorText inline>{spanError}</FormErrorText>
    </View>
  );
}

function calendarDayKey(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function isBeforeCalendarDay(a: Date, b: Date): boolean {
  return calendarDayKey(a) < calendarDayKey(b);
}
