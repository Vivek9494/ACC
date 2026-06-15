import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { formatDisplayDate, formatIsoDate, parseIsoDateLocal } from '../../lib/tournament-datetime';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE, labelClassName } from './fieldStyles';
import { Text } from './Text';

export interface TournamentDatesFieldProps {
  values: string[];
  onChange: (values: string[]) => void;
  error?: string | null;
}

/**
 * Multi-date calendar for tournament match days. Tapping toggles selection.
 * TODO(match-scheduling): scheduled matches must use only these dates.
 */
export function TournamentDatesField({
  values,
  onChange,
  error,
}: TournamentDatesFieldProps): React.ReactElement {
  const minDate = useMemo(() => formatIsoDate(new Date()), []);

  const markedDates = useMemo((): Record<string, { selected: boolean; selectedColor: string; selectedTextColor: string }> => {
    const marked: Record<string, { selected: boolean; selectedColor: string; selectedTextColor: string }> = {};
    for (const date of values) {
      marked[date] = {
        selected: true,
        selectedColor: FIELD_ORANGE,
        selectedTextColor: '#ffffff',
      };
    }
    return marked;
  }, [values]);

  function onDayPress(day: DateData): void {
    if (day.dateString < minDate) {
      return;
    }
    if (values.includes(day.dateString)) {
      onChange(values.filter((value) => value !== day.dateString));
      return;
    }
    onChange([...values, day.dateString].sort());
  }

  function removeDate(date: string): void {
    onChange(values.filter((value) => value !== date));
  }

  const countLabel =
    values.length === 0
      ? 'No dates selected'
      : values.length === 1
        ? '1 date selected'
        : `${values.length} dates selected`;

  return (
    <View className="gap-2">
      <Text className={labelClassName()}>Tournament Dates</Text>
      <View
        className={`overflow-hidden rounded-control border bg-white ${
          error ? 'border-error' : 'border-[#F1F1F1]'
        }`}
        style={INPUT_SHADOW_STYLE}
      >
        <Calendar
          minDate={minDate}
          markedDates={markedDates}
          onDayPress={onDayPress}
          enableSwipeMonths
          theme={{
            todayTextColor: FIELD_ORANGE,
            selectedDayBackgroundColor: FIELD_ORANGE,
            selectedDayTextColor: '#ffffff',
            arrowColor: FIELD_ORANGE,
            monthTextColor: '#1A1A1A',
            textDayFontFamily: 'Montserrat_400Regular',
            textMonthFontFamily: 'Montserrat_600SemiBold',
            textDayHeaderFontFamily: 'Montserrat_500Medium',
            textDayFontSize: 15,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 12,
          }}
        />
      </View>
      <Text className="ml-1 font-sans text-sm text-on-surface-variant">{countLabel}</Text>
      {values.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {values.map((date) => {
            const parsed = parseIsoDateLocal(date);
            const label = parsed ? formatDisplayDate(parsed) : date;
            return (
              <View
                key={date}
                className="flex-row items-center gap-1 rounded-full border border-[#F1F1F1] bg-white px-3 py-1.5"
                style={INPUT_SHADOW_STYLE}
              >
                <Text className="font-sans text-sm text-on-surface">{label}</Text>
                <Pressable
                  onPress={() => removeDate(date)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${label}`}
                  hitSlop={8}
                >
                  <Text className="font-sans-semibold text-sm text-primary">×</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
      {error ? <Text className="ml-1 font-sans text-sm text-error">{error}</Text> : null}
    </View>
  );
}
