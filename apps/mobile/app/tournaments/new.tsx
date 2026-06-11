import { Ionicons } from '@expo/vector-icons';
import {
  BallType,
  CitySelection,
  DEFAULT_TOURNAMENT_FORMAT,
  type CreateTournamentRequest,
  deferredMaxOversPerBowler,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BallTypeIcon } from '../../src/components/ui/BallTypeIcon';
import { BottomTabBar } from '../../src/components/ui/BottomTabBar';
import { Button } from '../../src/components/ui/Button';
import { Checkbox } from '../../src/components/ui/Checkbox';
import { DateField } from '../../src/components/ui/DateField';
import { FIELD_ORANGE } from '../../src/components/ui/fieldStyles';
import { MultiSelect } from '../../src/components/ui/MultiSelect';
import { ProfileMenu } from '../../src/components/ui/ProfileMenu';
import { RadioGroup } from '../../src/components/ui/RadioGroup';
import { Select, type SelectOption } from '../../src/components/ui/Select';
import { SuccessDialog } from '../../src/components/ui/SuccessDialog';
import { Text } from '../../src/components/ui/Text';
import { TextInput } from '../../src/components/ui/TextInput';
import { TimeField } from '../../src/components/ui/TimeField';
import { TournamentPosterField } from '../../src/components/ui/TournamentPosterField';
import {
  ApiRequestError,
  createTournament,
  getProfile,
  uploadTournamentPoster,
} from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { canCreateTournament } from '../../src/lib/can-create-tournament';
import { useRoleTabConfig } from '../../src/lib/role-tab-config';
import { useSignupGeography } from '../../src/lib/signup-geography';
import {
  combineLocalDateAndTimeToIso,
  dateOnlyToUtcIso,
} from '../../src/lib/tournament-datetime';
import {
  DEFAULT_PLAYERS_PER_TEAM,
  DEFAULT_SUBSTITUTES_ALLOWED,
  validateTournamentForm,
  type TournamentFieldErrors,
} from '../../src/lib/tournament-form-validation';

const CURRENT_YEAR = new Date().getFullYear();

function buildYearOptions(): SelectOption[] {
  const years: number[] = [];
  for (let y = CURRENT_YEAR - 1; y <= CURRENT_YEAR + 2; y += 1) {
    years.push(y);
  }
  return years.map((y) => ({ value: String(y), label: String(y) }));
}

function isLocalPosterUri(uri: string): boolean {
  return !uri.startsWith('http://') && !uri.startsWith('https://');
}

function parseIsoDateLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

export default function AddTournamentScreen(): React.ReactElement {
  const router = useRouter();
  const { user, status } = useAuth();
  const tabConfig = useRoleTabConfig('index');

  const [profileLoading, setProfileLoading] = useState(true);
  const [defaultProvinceId, setDefaultProvinceId] = useState<string | null>(null);
  const [tournamentProvinceId, setTournamentProvinceId] = useState<string | null>(null);
  const [selectedCenterIds, setSelectedCenterIds] = useState<string[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);

  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [posterError, setPosterError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [year, setYear] = useState<string | null>(String(CURRENT_YEAR));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [ballType, setBallType] = useState<BallType | null>(null);
  const [citySelection, setCitySelection] = useState<CitySelection | null>(null);
  const [oversPerInnings, setOversPerInnings] = useState('');
  const [numberOfTeams, setNumberOfTeams] = useState('');
  const [playersPerTeam, setPlayersPerTeam] = useState(String(DEFAULT_PLAYERS_PER_TEAM));

  const [hasRegistrationWindow, setHasRegistrationWindow] = useState(false);
  const [registrationOpenDate, setRegistrationOpenDate] = useState('');
  const [registrationOpenTime, setRegistrationOpenTime] = useState('');
  const [registrationCloseDate, setRegistrationCloseDate] = useState('');
  const [registrationCloseTime, setRegistrationCloseTime] = useState('');

  const [hasAuctionDate, setHasAuctionDate] = useState(false);
  const [auctionDate, setAuctionDate] = useState('');

  const [impactPlayerEnabled, setImpactPlayerEnabled] = useState(false);
  const [videoRequired, setVideoRequired] = useState(false);
  const [videoUploadEndDate, setVideoUploadEndDate] = useState('');

  const [fieldErrors, setFieldErrors] = useState<TournamentFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const yearOptions = useMemo(() => buildYearOptions(), []);
  const startDateParsed = startDate ? parseIsoDateLocal(startDate) : null;
  const endMinimumDate = startDateParsed ?? undefined;

  const ballTypeOptions = useMemo(
    () => [
      {
        value: BallType.Tennis,
        label: 'Tennis Ball',
        icon: <BallTypeIcon ballType={BallType.Tennis} size={28} />,
      },
      {
        value: BallType.Leather,
        label: 'Leather Ball',
        icon: <BallTypeIcon ballType={BallType.Leather} size={28} />,
      },
    ],
    [],
  );

  const scopeOptions = useMemo(
    (): SelectOption[] => [
      { value: CitySelection.All, label: 'All the Centers' },
      { value: CitySelection.Multi, label: 'Multi-centers' },
    ],
    [],
  );

  const isTennisBall = ballType === BallType.Tennis;
  const isMultiCenters = isTennisBall && citySelection === CitySelection.Multi;

  const { provinces, centers, provinceField, centerField } =
    useSignupGeography(isMultiCenters ? tournamentProvinceId : null);

  const provinceOptions = useMemo(
    () => (provinces ?? []).map((p) => ({ value: p.id, label: p.name })),
    [provinces],
  );

  const centerOptions = useMemo(
    () => (centers ?? []).map((c) => ({ value: c.id, label: c.name })),
    [centers],
  );

  const provinceSelectError =
    fieldErrors.province ??
    (provinceField.errorType === 'network' || provinceField.errorType === 'empty'
      ? provinceField.errorMessage
      : null);

  const centersSelectError =
    fieldErrors.centers ??
    (tournamentProvinceId &&
    (centerField.errorType === 'network' || centerField.errorType === 'empty')
      ? centerField.errorMessage
      : null);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const profile = await getProfile();
      setDefaultProvinceId(profile.provinceId);
    } catch {
      setFormError('Could not load your profile. Pull to retry from dashboard.');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isMultiCenters || centers.length === 0) {
      return;
    }
    setSelectedCenterIds((prev) => prev.filter((id) => centers.some((center) => center.id === id)));
  }, [centers, isMultiCenters]);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }
    if (!canCreateTournament(user)) {
      setAccessDenied(true);
      setProfileLoading(false);
      return;
    }
    void loadProfile();
  }, [loadProfile, status, user]);

  function clearFieldError(key: keyof TournamentFieldErrors): void {
    setFieldErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function onRegistrationToggle(checked: boolean): void {
    setHasRegistrationWindow(checked);
    if (!checked) {
      setRegistrationOpenDate('');
      setRegistrationOpenTime('');
      setRegistrationCloseDate('');
      setRegistrationCloseTime('');
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.registrationOpenDate;
        delete next.registrationOpenTime;
        delete next.registrationCloseDate;
        delete next.registrationCloseTime;
        return next;
      });
    }
  }

  function onAuctionToggle(checked: boolean): void {
    setHasAuctionDate(checked);
    if (!checked) {
      setAuctionDate('');
      clearFieldError('auctionDate');
    }
  }

  function onVideoToggle(checked: boolean): void {
    setVideoRequired(checked);
    if (!checked) {
      setVideoUploadEndDate('');
      clearFieldError('videoUploadEndDate');
    }
  }

  function clearGeographyPickers(): void {
    setTournamentProvinceId(null);
    setSelectedCenterIds([]);
    clearFieldError('province');
    clearFieldError('centers');
  }

  function onScopeChange(value: CitySelection): void {
    setCitySelection(value);
    clearFieldError('citySelection');
    if (value !== CitySelection.Multi) {
      clearGeographyPickers();
    }
  }

  function onTournamentProvinceChange(next: string): void {
    setTournamentProvinceId(next);
    setSelectedCenterIds([]);
    clearFieldError('province');
    clearFieldError('centers');
  }

  function onBallTypeChange(value: BallType): void {
    setBallType(value);
    clearFieldError('ballType');
    if (value === BallType.Leather) {
      setCitySelection(null);
      clearFieldError('citySelection');
      clearGeographyPickers();
    }
    if (!oversPerInnings.trim()) {
      setOversPerInnings(value === BallType.Leather ? '25' : '20');
    }
    if (!numberOfTeams.trim()) {
      setNumberOfTeams(value === BallType.Leather ? '4' : '8');
    }
  }

  async function onSubmit(): Promise<void> {
    const errors = validateTournamentForm({
      name,
      year,
      startDate,
      endDate,
      ballType,
      citySelection,
      tournamentProvinceId,
      selectedCenterIds,
      defaultProvinceId,
      oversPerInnings,
      numberOfTeams,
      playersPerTeam,
      hasRegistrationWindow,
      registrationOpenDate,
      registrationOpenTime,
      registrationCloseDate,
      registrationCloseTime,
      hasAuctionDate,
      auctionDate,
      videoRequired,
      videoUploadEndDate,
      posterError,
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    if (!ballType || !year) {
      return;
    }
    if (ballType === BallType.Tennis && !citySelection) {
      return;
    }

    const startIso = dateOnlyToUtcIso(startDate);
    const endIso = dateOnlyToUtcIso(endDate);
    if (!startIso || !endIso) {
      return;
    }

    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      let posterUrl: string | null = null;
      if (posterUri) {
        if (isLocalPosterUri(posterUri)) {
          posterUrl = await uploadTournamentPoster(posterUri);
        } else {
          posterUrl = posterUri;
        }
      }

      const registrationOpenAt =
        hasRegistrationWindow && registrationOpenDate && registrationOpenTime
          ? combineLocalDateAndTimeToIso(registrationOpenDate, registrationOpenTime)
          : null;
      const registrationCloseAt =
        hasRegistrationWindow && registrationCloseDate && registrationCloseTime
          ? combineLocalDateAndTimeToIso(registrationCloseDate, registrationCloseTime)
          : null;

      const payload: CreateTournamentRequest = {
        name: name.trim(),
        year: Number(year),
        posterUrl,
        oversPerInnings: Number(oversPerInnings),
        maxOversPerBowler: deferredMaxOversPerBowler(ballType),
        numberOfTeams: Number(numberOfTeams),
        playersPerTeam: Number(playersPerTeam),
        substitutesAllowed: DEFAULT_SUBSTITUTES_ALLOWED,
        location: location.trim() || null,
        startAt: startIso,
        endAt: endIso,
        ballType,
        format: DEFAULT_TOURNAMENT_FORMAT,
        impactPlayerEnabled,
        videoRequired,
        videoUploadEndDate:
          videoRequired && videoUploadEndDate ? dateOnlyToUtcIso(videoUploadEndDate) : null,
        registrationOpenAt,
        registrationCloseAt,
        auctionAt: hasAuctionDate && auctionDate ? dateOnlyToUtcIso(auctionDate) : null,
        ...(ballType === BallType.Tennis && citySelection
          ? {
              citySelection,
              provinceId:
                citySelection === CitySelection.Multi
                  ? (tournamentProvinceId as string)
                  : (defaultProvinceId as string),
              ...(citySelection === CitySelection.Multi
                ? { centerIds: selectedCenterIds }
                : {}),
            }
          : {}),
      };

      await createTournament(payload);
      setShowSuccessDialog(true);
    } catch (err) {
      setFormError(
        err instanceof ApiRequestError ? err.message : 'Could not create the tournament.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function onSuccessDismiss(): void {
    setShowSuccessDialog(false);
    router.replace('/tournaments');
  }

  if (status === 'loading' || profileLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  if (accessDenied) {
    return (
      <SafeAreaView className="flex-1 bg-surface px-6">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-center font-sans text-base text-on-surface-variant">
            You do not have permission to create tournaments.
          </Text>
          <Button onPress={() => router.back()} label="Go back" className="h-12 px-8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-1">
        <View className="flex-row items-start justify-between px-4 py-3">
          <View className="min-w-0 flex-1 gap-1 pr-3">
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => router.back()}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
              </Pressable>
              <Text className="font-sans-bold text-xl text-on-surface">Add Tournament</Text>
            </View>
            <Text className="pl-[52px] font-sans text-sm text-on-surface-variant">
              Fill in the details to create a new tournament event.
            </Text>
          </View>
          <ProfileMenu />
        </View>

        <ScrollView
          contentContainerClassName="px-4 pb-8 pt-2"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-5">
            <TournamentPosterField
              uri={posterUri}
              onChange={(uri) => {
                setPosterUri(uri);
                clearFieldError('poster');
              }}
              onValidationError={(message) => {
                setPosterError(message);
                if (message) {
                  setFieldErrors((prev) => ({ ...prev, poster: message }));
                } else {
                  clearFieldError('poster');
                }
              }}
              error={fieldErrors.poster}
            />

            <TextInput
              label="Tournament Name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                clearFieldError('name');
              }}
              placeholder="e.g. Hariprabodham Premiere League"
              error={fieldErrors.name}
            />

            <Select
              label="Tournament Year"
              value={year}
              options={yearOptions}
              onChange={(value) => {
                setYear(value);
                clearFieldError('year');
              }}
              error={fieldErrors.year}
            />

            <DateField
              label="Tournament Start Date"
              value={startDate}
              onChange={(value) => {
                setStartDate(value);
                clearFieldError('startDate');
                clearFieldError('endDate');
              }}
              enforceSignupAgeMax={false}
              error={fieldErrors.startDate}
            />

            <DateField
              label="Tournament End Date"
              value={endDate}
              onChange={(value) => {
                setEndDate(value);
                clearFieldError('endDate');
              }}
              enforceSignupAgeMax={false}
              minimumDate={endMinimumDate}
              error={fieldErrors.endDate}
            />

            <TextInput
              label="Tournament Location"
              value={location}
              onChangeText={setLocation}
              placeholder="Search venue or city..."
              leadingIcon={<Ionicons name="location-outline" size={20} color={FIELD_ORANGE} />}
            />

            <RadioGroup
              label="Ball Type"
              options={ballTypeOptions}
              value={ballType}
              onChange={onBallTypeChange}
              error={fieldErrors.ballType}
            />

            {isTennisBall ? (
              <Select
                label="Tournament For"
                placeholder="Select scope"
                value={citySelection}
                options={scopeOptions}
                onChange={(value) => onScopeChange(value as CitySelection)}
                error={fieldErrors.citySelection}
              />
            ) : null}

            {isMultiCenters ? (
              <View className="gap-4">
                <Select
                  label="Province"
                  placeholder="Select province"
                  value={tournamentProvinceId}
                  options={provinceOptions}
                  onChange={onTournamentProvinceChange}
                  loading={provinceField.loading}
                  error={provinceSelectError}
                  emptyMessage="No provinces available."
                  onRetry={provinceField.retry}
                />
                <MultiSelect
                  label="Centers"
                  placeholder="Select centers"
                  values={selectedCenterIds}
                  options={centerOptions}
                  onChange={(next) => {
                    setSelectedCenterIds(next);
                    clearFieldError('centers');
                  }}
                  disabled={!tournamentProvinceId}
                  loading={Boolean(tournamentProvinceId) && centerField.loading}
                  error={centersSelectError}
                  emptyMessage="No centers available in this province."
                  onRetry={centerField.retry}
                />
              </View>
            ) : null}

            <View className="gap-4">
              <Text className="font-sans-bold text-sm uppercase tracking-wider text-primary">
                Match Setup
              </Text>
              <TextInput
                label="Overs per Innings"
                value={oversPerInnings}
                onChangeText={(text) => {
                  setOversPerInnings(text.replace(/\D/g, ''));
                  clearFieldError('oversPerInnings');
                }}
                keyboardType="number-pad"
                placeholder="e.g. 25"
                error={fieldErrors.oversPerInnings}
              />
              <TextInput
                label="Number of Teams"
                value={numberOfTeams}
                onChangeText={(text) => {
                  setNumberOfTeams(text.replace(/\D/g, ''));
                  clearFieldError('numberOfTeams');
                }}
                keyboardType="number-pad"
                placeholder="e.g. 8"
                error={fieldErrors.numberOfTeams}
              />
              <TextInput
                label="Players per Team"
                value={playersPerTeam}
                onChangeText={(text) => {
                  setPlayersPerTeam(text.replace(/\D/g, ''));
                  clearFieldError('playersPerTeam');
                }}
                keyboardType="number-pad"
                placeholder="e.g. 15"
                error={fieldErrors.playersPerTeam}
              />
            </View>

            <Checkbox checked={hasRegistrationWindow} onChange={onRegistrationToggle}>
              <Text className="font-sans text-base text-on-surface">
                Have Registration Open and Close Date?
              </Text>
            </Checkbox>

            {hasRegistrationWindow ? (
              <View className="gap-4 pl-1">
                <DateField
                  label="Registration Open Date"
                  value={registrationOpenDate}
                  onChange={(value) => {
                    setRegistrationOpenDate(value);
                    clearFieldError('registrationOpenDate');
                  }}
                  enforceSignupAgeMax={false}
                  error={fieldErrors.registrationOpenDate}
                />
                <TimeField
                  label="Registration Open Time"
                  value={registrationOpenTime}
                  onChange={(value) => {
                    setRegistrationOpenTime(value);
                    clearFieldError('registrationOpenTime');
                  }}
                  error={fieldErrors.registrationOpenTime}
                />
                <DateField
                  label="Registration Close Date"
                  value={registrationCloseDate}
                  onChange={(value) => {
                    setRegistrationCloseDate(value);
                    clearFieldError('registrationCloseDate');
                  }}
                  enforceSignupAgeMax={false}
                  error={fieldErrors.registrationCloseDate}
                />
                <TimeField
                  label="Registration Close Time"
                  value={registrationCloseTime}
                  onChange={(value) => {
                    setRegistrationCloseTime(value);
                    clearFieldError('registrationCloseTime');
                  }}
                  error={fieldErrors.registrationCloseTime}
                />
              </View>
            ) : null}

            <Checkbox checked={hasAuctionDate} onChange={onAuctionToggle}>
              <Text className="font-sans text-base text-on-surface">Have Auction Date?</Text>
            </Checkbox>

            {hasAuctionDate ? (
              <DateField
                label="Auction Date"
                value={auctionDate}
                onChange={(value) => {
                  setAuctionDate(value);
                  clearFieldError('auctionDate');
                }}
                enforceSignupAgeMax={false}
                error={fieldErrors.auctionDate}
              />
            ) : null}

            <Checkbox checked={impactPlayerEnabled} onChange={setImpactPlayerEnabled}>
              <Text className="font-sans text-base text-on-surface">
                Impact Player — Enable strategic player substitution during the match
              </Text>
            </Checkbox>

            <Checkbox checked={videoRequired} onChange={onVideoToggle}>
              <Text className="font-sans text-base text-on-surface">
                Video Required? — Request players to upload their batting/bowling short video
              </Text>
            </Checkbox>

            {videoRequired ? (
              <DateField
                label="Video Upload End Date"
                value={videoUploadEndDate}
                onChange={(value) => {
                  setVideoUploadEndDate(value);
                  clearFieldError('videoUploadEndDate');
                }}
                enforceSignupAgeMax={false}
                error={fieldErrors.videoUploadEndDate}
              />
            ) : null}

            {formError ? (
              <View className="rounded-lg bg-error-container px-4 py-3">
                <Text className="font-sans text-sm text-on-error-container">{formError}</Text>
              </View>
            ) : null}

            <Button
              onPress={() => void onSubmit()}
              disabled={submitting}
              className="mt-2 h-14 w-full"
              label={submitting ? undefined : 'Add Tournament'}
            >
              {submitting ? <ActivityIndicator color="#ffffff" /> : null}
            </Button>
          </View>
        </ScrollView>
      </View>

      <BottomTabBar
        tabs={tabConfig.tabs}
        activeKey={tabConfig.activeKey}
        onTabPress={tabConfig.onTabPress}
      />

      <SuccessDialog
        visible={showSuccessDialog}
        title="Tournament Created"
        message="Your tournament has been created successfully."
        onDismiss={onSuccessDismiss}
      />
    </SafeAreaView>
  );
}
