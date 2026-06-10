import {
  BattingStyle,
  BATTING_STYLE_LABELS,
  BowlingStyle,
  BOWLING_STYLE_LABELS,
  RATING_MAX,
  RATING_MIN,
  REGISTRATION_DECLINED_MESSAGE,
  REGISTRATION_STATUS_LABELS,
  type RegistrationDetail,
  type RegistrationFieldDefinition,
  RegistrationStatus,
  type SubmitRegistrationRequest,
  type TournamentDetail,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../../src/components/ui/Button';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckboxRow } from '../../../src/components/CheckboxRow';
import { FormField } from '../../../src/components/FormField';
import { OptionSelector, type SelectorOption } from '../../../src/components/OptionSelector';
import {
  ApiRequestError,
  getMyRegistration,
  getTournament,
  listRegistrationFields,
  submitRegistration,
} from '../../../src/lib/api';

const BATTING_OPTIONS: SelectorOption<BattingStyle>[] = Object.values(BattingStyle).map((value) => ({
  value,
  label: BATTING_STYLE_LABELS[value],
}));

const BOWLING_OPTIONS: SelectorOption<BowlingStyle>[] = Object.values(BowlingStyle).map((value) => ({
  value,
  label: BOWLING_STYLE_LABELS[value],
}));

const RATING_OPTIONS: SelectorOption<string>[] = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, i) => {
    const n = RATING_MIN + i;
    return { value: String(n), label: String(n) };
  },
);

const STATUS_STYLES: Record<RegistrationStatus, string> = {
  IN_WAITLIST: 'bg-surface-container-high',
  CONFIRMED: 'bg-secondary-container',
  DECLINED: 'bg-error-container',
};

function ratingValue(value: string | null): number | null {
  return value === null || value === '' ? null : Number(value);
}

export default function RegistrationFormScreen(): React.ReactElement {
  const { tournamentId } = useLocalSearchParams<{ tournamentId: string }>();
  const router = useRouter();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [existing, setExisting] = useState<RegistrationDetail | null>(null);
  const [fields, setFields] = useState<RegistrationFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [battingStyle, setBattingStyle] = useState<BattingStyle | null>(null);
  const [battingRating, setBattingRating] = useState<string | null>(null);
  const [bowlingStyle, setBowlingStyle] = useState<BowlingStyle | null>(null);
  const [bowlingRating, setBowlingRating] = useState<string | null>(null);
  const [fieldingRating, setFieldingRating] = useState<string | null>(null);
  const [fieldingPosition, setFieldingPosition] = useState('');
  const [custom, setCustom] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getTournament(tournamentId),
      getMyRegistration(tournamentId),
      listRegistrationFields(tournamentId),
    ])
      .then(([t, reg, fieldDefs]) => {
        if (cancelled) return;
        setTournament(t);
        setFields(fieldDefs);
        if (reg) {
          setExisting(reg);
          setBattingStyle(reg.battingStyle);
          setBattingRating(reg.battingRating === null ? null : String(reg.battingRating));
          setBowlingStyle(reg.bowlingStyle);
          setBowlingRating(reg.bowlingRating === null ? null : String(reg.bowlingRating));
          setFieldingRating(reg.fieldingRating === null ? null : String(reg.fieldingRating));
          setFieldingPosition(reg.fieldingPosition ?? '');
        }
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : 'Could not load registration.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const isOpen = tournament?.state === 'REGISTRATION_OPEN';

  async function onSubmit(): Promise<void> {
    if (!tournamentId) return;
    const missing = fields.find((f) => f.required && !custom[f.key]);
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: SubmitRegistrationRequest = {
        battingStyle,
        battingRating: ratingValue(battingRating),
        bowlingStyle,
        bowlingRating: ratingValue(bowlingRating),
        fieldingRating: ratingValue(fieldingRating),
        fieldingPosition: fieldingPosition.trim() || null,
        customFields: fields.length > 0 ? custom : null,
      };
      const reg = await submitRegistration(tournamentId, payload);
      setExisting(reg);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not submit registration.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-6 py-6" keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} className="mb-3">
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>
        <Text className="font-sans-bold text-3xl text-on-surface">Registration</Text>
        {tournament ? (
          <Text className="mt-1 font-sans text-base text-on-surface-variant">{tournament.name}</Text>
        ) : null}

        {existing ? (
          <View className={`mt-5 gap-1 rounded-xl p-4 ${STATUS_STYLES[existing.status]}`}>
            <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
              Your status
            </Text>
            <Text className="font-sans-bold text-xl text-on-surface">
              {REGISTRATION_STATUS_LABELS[existing.status]}
            </Text>
            {existing.status === RegistrationStatus.Declined ? (
              <Text className="font-sans text-sm text-on-error-container">
                {REGISTRATION_DECLINED_MESSAGE}
              </Text>
            ) : null}
          </View>
        ) : null}

        {done ? (
          <View className="mt-4 rounded-lg bg-secondary-container px-4 py-3">
            <Text className="font-sans text-sm text-on-secondary-container">
              Registration submitted. You are now In Waitlist — your Center Sevak will review it.
            </Text>
          </View>
        ) : null}

        {!isOpen ? (
          <View className="mt-5 rounded-lg bg-surface-container-high px-4 py-3">
            <Text className="font-sans text-sm text-on-surface-variant">
              Registration is not open for this tournament right now.
            </Text>
          </View>
        ) : (
          <View className="mt-6 gap-5">
            <OptionSelector
              label="Batting Style"
              options={BATTING_OPTIONS}
              value={battingStyle}
              onChange={setBattingStyle}
            />
            <OptionSelector
              label="Batting Rating"
              options={RATING_OPTIONS}
              value={battingRating}
              onChange={setBattingRating}
            />
            <OptionSelector
              label="Bowling Style"
              options={BOWLING_OPTIONS}
              value={bowlingStyle}
              onChange={setBowlingStyle}
            />
            <OptionSelector
              label="Bowling Rating"
              options={RATING_OPTIONS}
              value={bowlingRating}
              onChange={setBowlingRating}
            />
            <OptionSelector
              label="Fielding Rating"
              options={RATING_OPTIONS}
              value={fieldingRating}
              onChange={setFieldingRating}
            />
            <FormField
              label="Fielding Position"
              value={fieldingPosition}
              onChangeText={setFieldingPosition}
              placeholder="e.g. Slip, Point, Wicket Keeper"
            />

            {fields.map((field) => (
              <CustomFieldInput
                key={field.id}
                field={field}
                value={custom[field.key]}
                onChange={(v) => setCustom((prev) => ({ ...prev, [field.key]: v }))}
              />
            ))}

            {error ? (
              <View className="rounded-lg bg-error-container px-4 py-3">
                <Text className="font-sans text-sm text-on-error-container">{error}</Text>
              </View>
            ) : null}

            <Button
              onPress={() => void onSubmit()}
              disabled={submitting}
              className="mt-2 h-14"
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-sans-medium text-sm uppercase tracking-wider text-on-primary">
                  {existing ? 'Update Registration' : 'Submit Registration'}
                </Text>
              )}
            </Button>
          </View>
        )}

        {!isOpen && error ? (
          <View className="mt-4 rounded-lg bg-error-container px-4 py-3">
            <Text className="font-sans text-sm text-on-error-container">{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: RegistrationFieldDefinition;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}): React.ReactElement {
  if (field.fieldType === 'BOOLEAN') {
    return (
      <CheckboxRow
        label={field.label}
        value={value === true}
        onValueChange={(next) => onChange(next)}
      />
    );
  }
  if (field.fieldType === 'SELECT') {
    const options: SelectorOption<string>[] = (field.options ?? []).map((opt) => ({
      value: opt,
      label: opt,
    }));
    return (
      <OptionSelector
        label={`${field.label}${field.required ? ' *' : ''}`}
        options={options}
        value={typeof value === 'string' ? value : null}
        onChange={onChange}
      />
    );
  }
  return (
    <FormField
      label={`${field.label}${field.required ? ' *' : ''}`}
      value={typeof value === 'string' ? value : ''}
      onChangeText={onChange}
      keyboardType={field.fieldType === 'NUMBER' ? 'number-pad' : 'default'}
    />
  );
}
