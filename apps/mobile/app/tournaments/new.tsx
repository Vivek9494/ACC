import {
  BallType,
  type CitySelection,
  type CloneSuggestion,
  type CreateTournamentRequest,
  TOURNAMENT_FORMAT_LABELS,
  TournamentFormat,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../src/components/ui/Button';
import { Text } from '../../src/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckboxRow } from '../../src/components/CheckboxRow';
import { FormField } from '../../src/components/FormField';
import { OptionSelector, type SelectorOption } from '../../src/components/OptionSelector';
import { ApiRequestError, createTournament, getCloneSuggestion } from '../../src/lib/api';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENT_YEAR = new Date().getUTCFullYear();

const BALL_OPTIONS: SelectorOption<BallType>[] = [
  { value: BallType.Tennis, label: 'Tennis Ball' },
  { value: BallType.Leather, label: 'Leather Ball' },
];

const CITY_OPTIONS: SelectorOption<CitySelection>[] = [
  { value: 'ALL', label: 'All the Centers' },
  { value: 'MULTI', label: 'Multi-cities' },
  { value: 'SINGLE', label: 'Single city' },
];

const FORMAT_OPTIONS: SelectorOption<TournamentFormat>[] = Object.values(TournamentFormat).map(
  (value) => ({ value, label: TOURNAMENT_FORMAT_LABELS[value] }),
);

const YEAR_OPTIONS: SelectorOption<string>[] = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2].map(
  (y) => ({ value: String(y), label: String(y) }),
);

/** Converts a yyyy-mm-dd field to an ISO 8601 UTC string (midnight). */
function toIso(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

export default function AddTournamentScreen(): React.ReactElement {
  const router = useRouter();

  const [name, setName] = useState('');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [posterUrl, setPosterUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [ballType, setBallType] = useState<BallType | null>(null);
  const [citySelection, setCitySelection] = useState<CitySelection | null>(null);
  const [oversPerInnings, setOversPerInnings] = useState('');
  const [maxOversPerBowler, setMaxOversPerBowler] = useState('');
  const [format, setFormat] = useState<TournamentFormat | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState('');
  const [registrationClose, setRegistrationClose] = useState('');
  const [impactPlayerEnabled, setImpactPlayerEnabled] = useState(false);
  const [videoRequired, setVideoRequired] = useState(false);
  const [videoUploadEndDate, setVideoUploadEndDate] = useState('');

  const [clone, setClone] = useState<CloneSuggestion | null>(null);
  const [cloneTeams, setCloneTeams] = useState(false);
  const [copyRoles, setCopyRoles] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isTennis = ballType === BallType.Tennis;

  // §6.2: when the name matches a past tournament, offer to clone team names.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setClone(null);
      return;
    }
    debounce.current = setTimeout(() => {
      getCloneSuggestion(trimmed)
        .then((suggestion) => setClone(suggestion))
        .catch(() => setClone(null));
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [name]);

  function validate(): string | null {
    if (!name.trim()) return 'Tournament name is required.';
    if (!/^\d{4}$/.test(year)) return 'Select a valid year.';
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      return 'Start and end dates must be YYYY-MM-DD.';
    }
    if (!ballType) return 'Select a ball type.';
    if (isTennis && !citySelection) return 'Select the tournament city coverage.';
    if (!/^\d+$/.test(oversPerInnings)) return 'Overs per innings must be a number.';
    if (!/^\d+$/.test(maxOversPerBowler)) return 'Max overs per bowler must be a number.';
    if (!format) return 'Select a tournament format.';
    if (registrationOpen && !DATE_RE.test(registrationOpen)) {
      return 'Registration open date must be YYYY-MM-DD.';
    }
    if (registrationClose && !DATE_RE.test(registrationClose)) {
      return 'Registration close date must be YYYY-MM-DD.';
    }
    if (videoRequired && !DATE_RE.test(videoUploadEndDate)) {
      return 'Video upload end date is required when Video Required is checked.';
    }
    return null;
  }

  async function onSubmit(): Promise<void> {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: CreateTournamentRequest = {
        name: name.trim(),
        year: Number(year),
        posterUrl: posterUrl.trim() || null,
        oversPerInnings: Number(oversPerInnings),
        maxOversPerBowler: Number(maxOversPerBowler),
        location: location.trim() || null,
        startAt: toIso(startDate),
        endAt: toIso(endDate),
        // Resolver ignores citySelection for Leather/ACC; default to SINGLE.
        ballType: ballType as BallType,
        citySelection: isTennis ? (citySelection as CitySelection) : 'SINGLE',
        format: format as TournamentFormat,
        impactPlayerEnabled,
        videoRequired,
        videoUploadEndDate: videoRequired ? toIso(videoUploadEndDate) : null,
        registrationOpenAt: registrationOpen ? toIso(registrationOpen) : null,
        registrationCloseAt: registrationClose ? toIso(registrationClose) : null,
        cloneFromTournamentId: clone && cloneTeams ? clone.tournamentId : null,
        copyRoleAssignments: clone && cloneTeams ? copyRoles : false,
      };
      const created = await createTournament(payload);
      router.replace(`/tournaments/${created.id}`);
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Could not create the tournament.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-6 py-6" keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} className="mb-3">
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>
        <Text className="font-sans-bold text-3xl text-on-surface">Add Tournament</Text>
        <Text className="mt-1 font-sans text-base text-on-surface-variant">
          Fill in the details to create a new tournament event.
        </Text>

        <View className="mt-6 gap-5">
          <FormField
            label="Tournament Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Atmiya Premier League"
          />

          {clone ? (
            <View className="gap-3 rounded-xl border border-tertiary bg-tertiary-container/20 p-4">
              <Text className="font-sans-semibold text-sm text-on-surface">
                A past tournament “{clone.name}” ({clone.year}) has {clone.teamNames.length} team
                {clone.teamNames.length === 1 ? '' : 's'}.
              </Text>
              <CheckboxRow
                label="Clone team names"
                description="Only names are copied — players are never cloned (§6.2)."
                value={cloneTeams}
                onValueChange={setCloneTeams}
              />
              {cloneTeams && clone.hasRoleAssignments ? (
                <CheckboxRow
                  label="Also copy Captain / VC / Manager"
                  value={copyRoles}
                  onValueChange={setCopyRoles}
                />
              ) : null}
            </View>
          ) : null}

          <OptionSelector label="Tournament Year" options={YEAR_OPTIONS} value={year} onChange={setYear} />

          <FormField
            label="Tournament Poster URL (optional)"
            value={posterUrl}
            onChangeText={setPosterUrl}
            autoCapitalize="none"
            placeholder="https://…"
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormField
                label="Start Date"
                value={startDate}
                onChangeText={setStartDate}
                keyboardType="numbers-and-punctuation"
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View className="flex-1">
              <FormField
                label="End Date"
                value={endDate}
                onChangeText={setEndDate}
                keyboardType="numbers-and-punctuation"
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>

          <FormField
            label="Tournament Location"
            value={location}
            onChangeText={setLocation}
            placeholder="Search venue or city…"
          />

          <OptionSelector
            label="Ball Type"
            options={BALL_OPTIONS}
            value={ballType}
            onChange={setBallType}
          />

          {isTennis ? (
            <OptionSelector
              label="Tournament For"
              options={CITY_OPTIONS}
              value={citySelection}
              onChange={setCitySelection}
            />
          ) : null}

          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormField
                label="Overs (per inning)"
                value={oversPerInnings}
                onChangeText={setOversPerInnings}
                keyboardType="number-pad"
                placeholder="25"
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Max overs / bowler"
                value={maxOversPerBowler}
                onChangeText={setMaxOversPerBowler}
                keyboardType="number-pad"
                placeholder="5"
              />
            </View>
          </View>

          <OptionSelector
            label="Tournament Format"
            options={FORMAT_OPTIONS}
            value={format}
            onChange={setFormat}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormField
                label="Registration Open"
                value={registrationOpen}
                onChangeText={setRegistrationOpen}
                keyboardType="numbers-and-punctuation"
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Registration Close"
                value={registrationClose}
                onChangeText={setRegistrationClose}
                keyboardType="numbers-and-punctuation"
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>

          <View className="gap-4 border-t border-outline-variant pt-5">
            <CheckboxRow
              label="Impact Player"
              description="Enable strategic player substitution during the match."
              value={impactPlayerEnabled}
              onValueChange={setImpactPlayerEnabled}
            />
            <CheckboxRow
              label="Video Required?"
              description="Request players to upload a batting/bowling/fielding video."
              value={videoRequired}
              onValueChange={setVideoRequired}
            />
            {videoRequired ? (
              <FormField
                label="Video Upload End Date"
                value={videoUploadEndDate}
                onChangeText={setVideoUploadEndDate}
                keyboardType="numbers-and-punctuation"
                placeholder="YYYY-MM-DD"
              />
            ) : null}
          </View>

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
                Create Tournament
              </Text>
            )}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
