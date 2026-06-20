import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import {
  BallType,
  CitySelection,
  DEFAULT_TOURNAMENT_FORMAT,
  TOURNAMENT_FIELD_LIMITS,
  type CreateTournamentRequest,
  deferredMaxOversPerBowler,
  type TournamentDetail,
  type UpdateTournamentRequest,
} from '@acc/types';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BallTypeIcon } from '../ui/BallTypeIcon';
import { BottomTabBar } from '../ui/BottomTabBar';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { DateField } from '../ui/DateField';
import { FIELD_ORANGE, labelClassName } from '../ui/fieldStyles';
import { MultiSelect } from '../ui/MultiSelect';
import { ProfileMenu } from '../ui/ProfileMenu';
import { RadioGroup } from '../ui/RadioGroup';
import { Select, type SelectOption } from '../ui/Select';
import { SuccessDialog } from '../ui/SuccessDialog';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { TimeField } from '../ui/TimeField';
import { TournamentDatesField } from '../ui/TournamentDatesField';
import { TournamentLocationField } from '../ui/TournamentLocationField';
import { TournamentPosterField } from '../ui/TournamentPosterField';
import {
  ApiRequestError,
  createTournament,
  getProfile,
  getTournamentEditForm,
  updateTournament,
  uploadTournamentPoster,
} from '../../lib/api';
import type { PickedImageFile } from '../../lib/imagePicker';
import { useAuth } from '../../lib/auth-context';
import { canCreateTournament } from '../../lib/can-create-tournament';
import { useRoleTabConfig } from '../../lib/role-tab-config';
import { useSignupGeography } from '../../lib/signup-geography';
import {
  combineLocalDateAndTimeToIso,
  dateOnlyToUtcIso,
} from '../../lib/tournament-datetime';
import {
  hydrateTournamentFormFromEditData,
} from '../../lib/tournament-form-hydration';
import {
  DEFAULT_PLAYERS_PER_TEAM,
  DEFAULT_SUBSTITUTES_ALLOWED,
  firstTournamentFormFieldError,
  mapApiErrorsToTournamentFields,
  registerTournamentFieldLayout,
  validateTournamentForm,
  validateUpdateTournamentFormValues,
  type TournamentFormFieldErrors,
  type TournamentFormFieldKey,
} from '../../lib/tournament-form-validation';
import {
  ensureUploadablePosterUri,
  posterFromPickedFile,
  posterSelectionDebug,
  type TournamentPosterSelection,
} from '../../lib/tournament-poster';

const CURRENT_YEAR = new Date().getFullYear();

function buildYearOptions(): SelectOption[] {
  const years: number[] = [];
  for (let y = CURRENT_YEAR - 1; y <= CURRENT_YEAR + 2; y += 1) {
    years.push(y);
  }
  return years.map((y) => ({ value: String(y), label: String(y) }));
}

export interface TournamentFormScreenProps {
  mode: 'create' | 'edit';
  tournamentId?: string;
}

export function TournamentFormScreen({
  mode,
  tournamentId,
}: TournamentFormScreenProps): React.ReactElement {
  const isEditMode = mode === 'edit';
  const router = useRouter();
  const { user, status } = useAuth();
  const tabConfig = useRoleTabConfig('index');

  const [profileLoading, setProfileLoading] = useState(!isEditMode);
  const [editLoading, setEditLoading] = useState(isEditMode);
  const [defaultProvinceId, setDefaultProvinceId] = useState<string | null>(null);
  const [tournamentProvinceId, setTournamentProvinceId] = useState<string | null>(null);
  const [selectedCenterIds, setSelectedCenterIds] = useState<string[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [minTeamCount, setMinTeamCount] = useState(0);
  const [datesWithMatches, setDatesWithMatches] = useState<string[]>([]);
  const [scopeLabel, setScopeLabel] = useState('');
  const [provinceLabel, setProvinceLabel] = useState<string | null>(null);
  const [centerLabels, setCenterLabels] = useState<string[]>([]);

  const [poster, setPoster] = useState<TournamentPosterSelection | null>(null);
  const [posterUploading, setPosterUploading] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [year, setYear] = useState<string | null>(String(CURRENT_YEAR));
  const [tournamentDates, setTournamentDates] = useState<string[]>([]);
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [ballType, setBallType] = useState<BallType | null>(null);
  const [citySelection, setCitySelection] = useState<CitySelection | null>(null);
  const [numberOfTeams, setNumberOfTeams] = useState<string | null>(null);
  const [playersPerTeam, setPlayersPerTeam] = useState('');

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

  const [fieldErrors, setFieldErrors] = useState<TournamentFormFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [savedTournamentId, setSavedTournamentId] = useState<string | null>(null);
  const savedTournamentIdRef = useRef<string | null>(null);
  const successNavigatedRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  const fieldOffsets = useRef<Partial<Record<TournamentFormFieldKey, number>>>({});

  const layoutField = useCallback(
    (key: TournamentFormFieldKey) => (event: LayoutChangeEvent) => {
      registerTournamentFieldLayout(fieldOffsets, key, event);
    },
    [],
  );

  const scrollToField = useCallback((key: TournamentFormFieldKey) => {
    const y = fieldOffsets.current[key];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    }
  }, []);

  const yearOptions = useMemo(() => buildYearOptions(), []);

  const numberOfTeamsOptions = useMemo((): SelectOption[] => {
    const options: SelectOption[] = [];
    const minTeams = isEditMode
      ? Math.max(TOURNAMENT_FIELD_LIMITS.numberOfTeams.min, minTeamCount)
      : TOURNAMENT_FIELD_LIMITS.numberOfTeams.min;
    for (
      let count = minTeams;
      count <= TOURNAMENT_FIELD_LIMITS.numberOfTeams.max;
      count += 1
    ) {
      options.push({ value: String(count), label: String(count) });
    }
    return options;
  }, [isEditMode, minTeamCount]);

  const ballTypeOptions = useMemo(
    () => [
      {
        value: BallType.Tennis,
        label: 'Tennis Ball',
        icon: <BallTypeIcon ballType={BallType.Tennis} size={20} />,
      },
      {
        value: BallType.Leather,
        label: 'Leather Ball',
        icon: <BallTypeIcon ballType={BallType.Leather} size={20} />,
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

  const loadEditForm = useCallback(async () => {
    if (!tournamentId) {
      setAccessDenied(true);
      setEditLoading(false);
      return;
    }

    setEditLoading(true);
    try {
      const data = await getTournamentEditForm(tournamentId);
      const hydrated = hydrateTournamentFormFromEditData(data);
      setPoster(hydrated.poster);
      setName(hydrated.name);
      setYear(hydrated.year);
      setTournamentDates(hydrated.tournamentDates);
      setLocationAddress(hydrated.locationAddress);
      setLatitude(hydrated.latitude);
      setLongitude(hydrated.longitude);
      setBallType(hydrated.ballType);
      setCitySelection(hydrated.citySelection);
      setNumberOfTeams(hydrated.numberOfTeams);
      setPlayersPerTeam(hydrated.playersPerTeam);
      setHasRegistrationWindow(hydrated.hasRegistrationWindow);
      setRegistrationOpenDate(hydrated.registrationOpenDate);
      setRegistrationOpenTime(hydrated.registrationOpenTime);
      setRegistrationCloseDate(hydrated.registrationCloseDate);
      setRegistrationCloseTime(hydrated.registrationCloseTime);
      setHasAuctionDate(hydrated.hasAuctionDate);
      setAuctionDate(hydrated.auctionDate);
      setImpactPlayerEnabled(hydrated.impactPlayerEnabled);
      setVideoRequired(hydrated.videoRequired);
      setVideoUploadEndDate(hydrated.videoUploadEndDate);
      setMinTeamCount(hydrated.minTeamCount);
      setDatesWithMatches(hydrated.datesWithMatches);
      setScopeLabel(hydrated.scopeLabel);
      setProvinceLabel(hydrated.provinceLabel);
      setCenterLabels(hydrated.centerLabels);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 403) {
        setAccessDenied(true);
      } else {
        setFormError(
          err instanceof ApiRequestError
            ? err.message
            : 'Could not load the tournament for editing.',
        );
      }
    } finally {
      setEditLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }
    if (isEditMode) {
      void loadEditForm();
      return;
    }
    if (!canCreateTournament(user)) {
      setAccessDenied(true);
      setProfileLoading(false);
      return;
    }
    void loadProfile();
  }, [isEditMode, loadEditForm, loadProfile, status, user]);

  function clearFieldError(key: keyof TournamentFormFieldErrors): void {
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
  }

  function clearRegistrationFieldErrors(): void {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.registrationOpenDate;
      delete next.registrationOpenTime;
      delete next.registrationCloseDate;
      delete next.registrationCloseTime;
      return next;
    });
  }

  function applyPosterUploadError(err: unknown): void {
    if (err instanceof ApiRequestError) {
      const fieldMessage = err.error.fields?.poster;
      const message =
        fieldMessage ??
        (Array.isArray(err.error.message) ? err.error.message.join(', ') : err.error.message);
      setPosterError(message);
      setFieldErrors((prev) => ({ ...prev, poster: message }));
      return;
    }
    const message = 'Could not upload the poster. Please try again.';
    setPosterError(message);
    setFieldErrors((prev) => ({ ...prev, poster: message }));
  }

  async function uploadPosterSelection(
    selection: TournamentPosterSelection,
  ): Promise<string | null> {
    const uploadUri = await ensureUploadablePosterUri(selection.uri);
    const remoteUrl = await uploadTournamentPoster(uploadUri);
    setPoster({ ...selection, remoteUrl });
    setPosterError(null);
    clearFieldError('poster');
    return remoteUrl;
  }

  async function onPosterPicked(file: PickedImageFile): Promise<void> {
    const selection = posterFromPickedFile(file);
    setPoster(selection);
    setPosterError(null);
    clearFieldError('poster');
    setPosterUploading(true);

    try {
      await uploadPosterSelection(selection);
    } catch (err) {
      applyPosterUploadError(err);
    } finally {
      setPosterUploading(false);
    }
  }

  async function onSubmit(): Promise<void> {
    if (posterUploading) {
      setFieldErrors((prev) => ({
        ...prev,
        poster: 'Poster upload in progress. Please wait.',
      }));
      scrollToField('poster');
      return;
    }

    const posterAttached = Boolean(poster?.uri || poster?.remoteUrl);

    if (__DEV__) {
      console.log('[AddTournament] poster on submit', posterSelectionDebug(poster));
    }

    const errors = isEditMode
      ? validateUpdateTournamentFormValues({
          hasPoster: posterAttached,
          posterUri: poster?.uri ?? poster?.remoteUrl ?? null,
          posterPickError: posterAttached ? null : posterError,
          defaultProvinceId,
          name,
          year,
          tournamentDates,
          ballType,
          citySelection,
          tournamentProvinceId,
          selectedCenterIds,
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
          minTeamCount,
          datesWithMatches,
        })
      : validateTournamentForm({
          hasPoster: posterAttached,
          posterUri: poster?.uri ?? poster?.remoteUrl ?? null,
          posterPickError: posterAttached ? null : posterError,
          defaultProvinceId,
          name,
          year,
          tournamentDates,
          ballType,
          citySelection,
          tournamentProvinceId,
          selectedCenterIds,
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
        });

    setFieldErrors(errors);
    const firstError = firstTournamentFormFieldError(errors);
    if (firstError) {
      setFormError(null);
      scrollToField(firstError);
      return;
    }

    if (!ballType || !year || !numberOfTeams || !posterAttached || !poster) {
      return;
    }
    if (ballType === BallType.Tennis && !citySelection) {
      return;
    }

    const attachedPoster = poster;

    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      let posterUrl = attachedPoster.remoteUrl;
      if (!posterUrl) {
        setPosterUploading(true);
        try {
          posterUrl = await uploadPosterSelection(attachedPoster);
        } catch (err) {
          applyPosterUploadError(err);
          scrollToField('poster');
          return;
        } finally {
          setPosterUploading(false);
        }
      }

      if (!posterUrl) {
        applyPosterUploadError(new Error('Poster upload returned no URL'));
        scrollToField('poster');
        return;
      }

      if (__DEV__) {
        console.log('[AddTournament] poster upload complete', {
          posterUrl,
          ...posterSelectionDebug(attachedPoster),
        });
      }

      const registrationOpenAt =
        hasRegistrationWindow && registrationOpenDate && registrationOpenTime
          ? combineLocalDateAndTimeToIso(registrationOpenDate, registrationOpenTime)
          : null;
      const registrationCloseAt =
        hasRegistrationWindow && registrationCloseDate && registrationCloseTime
          ? combineLocalDateAndTimeToIso(registrationCloseDate, registrationCloseTime)
          : null;

      if (isEditMode) {
        if (!tournamentId) {
          return;
        }

        const updatePayload: UpdateTournamentRequest = {
          name: name.trim(),
          posterUrl,
          numberOfTeams: Number(numberOfTeams),
          playersPerTeam: playersPerTeam.trim()
            ? Number(playersPerTeam)
            : DEFAULT_PLAYERS_PER_TEAM,
          substitutesAllowed: DEFAULT_SUBSTITUTES_ALLOWED,
          locationAddress: locationAddress.trim() || null,
          latitude,
          longitude,
          dates: tournamentDates,
          format: DEFAULT_TOURNAMENT_FORMAT,
          impactPlayerEnabled,
          videoRequired,
          videoUploadEndDate:
            videoRequired && videoUploadEndDate ? dateOnlyToUtcIso(videoUploadEndDate) : null,
          registrationOpenAt,
          registrationCloseAt,
          auctionAt: hasAuctionDate && auctionDate ? dateOnlyToUtcIso(auctionDate) : null,
        };

        const updated = await updateTournament(tournamentId, updatePayload);
        savedTournamentIdRef.current = updated.id;
        setSavedTournamentId(updated.id);
        successNavigatedRef.current = false;
        setShowSuccessDialog(true);
        return;
      }

      const payload: CreateTournamentRequest = {
        name: name.trim(),
        year: Number(year),
        posterUrl,
        maxOversPerBowler: deferredMaxOversPerBowler(ballType),
        numberOfTeams: Number(numberOfTeams),
        ...(playersPerTeam.trim() ? { playersPerTeam: Number(playersPerTeam) } : {}),
        substitutesAllowed: DEFAULT_SUBSTITUTES_ALLOWED,
        locationAddress: locationAddress.trim() || null,
        latitude,
        longitude,
        dates: tournamentDates,
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

      const created: TournamentDetail = await createTournament(payload);
      if (!created.id) {
        setFormError('Tournament was created but the server did not return an id.');
        return;
      }

      if (__DEV__) {
        console.log('[AddTournament] created tournament', {
          id: created.id,
          name: created.name,
        });
      }

      savedTournamentIdRef.current = created.id;
      setSavedTournamentId(created.id);
      successNavigatedRef.current = false;
      setShowSuccessDialog(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const mapped = mapApiErrorsToTournamentFields(err);
        if (Object.keys(mapped).length > 0) {
          setFieldErrors((prev) => ({ ...prev, ...mapped }));
          const apiFirst = firstTournamentFormFieldError(mapped);
          if (apiFirst) {
            scrollToField(apiFirst);
          }
          return;
        }
      }
      setFormError(
        err instanceof ApiRequestError
          ? err.message
          : isEditMode
            ? 'Could not update the tournament.'
            : 'Could not create the tournament.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const onSuccessDismiss = useCallback((): void => {
    if (successNavigatedRef.current) {
      return;
    }

    const tournamentIdToOpen = savedTournamentIdRef.current ?? savedTournamentId;
    if (!tournamentIdToOpen) {
      if (__DEV__) {
        console.error('[AddTournament] success dismiss without tournament id');
      }
      setShowSuccessDialog(false);
      return;
    }

    successNavigatedRef.current = true;
    setShowSuccessDialog(false);

    if (__DEV__) {
      console.log('[TournamentForm] navigating to tournament details', {
        tournamentId: tournamentIdToOpen,
      });
    }

    const detailsHref = {
      pathname: '/tournaments/[id]',
      params: { id: tournamentIdToOpen },
    } satisfies Href;
    router.replace(detailsHref);
  }, [router, savedTournamentId]);

  if (status === 'loading' || profileLoading || editLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  if (accessDenied) {
    return (
      <SafeAreaView className="flex-1 bg-background px-6">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-center font-sans text-base text-on-surface-variant">
            {isEditMode
              ? 'You do not have permission to edit this tournament.'
              : 'You do not have permission to create tournaments.'}
          </Text>
          <Button onPress={() => router.back()} label="Go back" className="h-12 px-8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
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
              <Text className="font-sans-bold text-xl text-on-surface">
                {isEditMode ? 'Edit Tournament' : 'Add Tournament'}
              </Text>
            </View>
            <Text className="pl-[52px] font-sans text-sm text-on-surface-variant">
              {isEditMode
                ? 'Update tournament details. Ball type and scope cannot be changed.'
                : 'Fill in the details to create a new tournament event.'}
            </Text>
          </View>
          <ProfileMenu />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerClassName="px-4 pb-8 pt-2"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-5">
            <View onLayout={layoutField('poster')}>
              <TournamentPosterField
                uri={poster?.uri ?? null}
                uploading={posterUploading}
                onFilePicked={(file) => onPosterPicked(file)}
                onPickError={(message) => {
                  setPoster(null);
                  setPosterError(message);
                  setFieldErrors((prev) => ({ ...prev, poster: message }));
                }}
                error={fieldErrors.poster}
              />
            </View>

            <View onLayout={layoutField('name')}>
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
            </View>

            <View onLayout={layoutField('year')}>
            {isEditMode ? (
              <View className="gap-1">
                <Text className={labelClassName('brand')}>Tournament Year</Text>
                <View className="rounded-control border border-outline-variant bg-surface-container-low px-4 py-3">
                  <Text className="font-sans text-base text-on-surface-variant">{year}</Text>
                </View>
              </View>
            ) : (
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
            )}
            </View>

            <View onLayout={layoutField('tournamentDates')}>
            <TournamentDatesField
              values={tournamentDates}
              onChange={(next) => {
                setTournamentDates(next);
                clearFieldError('tournamentDates');
              }}
              error={fieldErrors.tournamentDates}
            />
            </View>

            <TournamentLocationField
              address={locationAddress}
              latitude={latitude}
              longitude={longitude}
              onAddressChange={setLocationAddress}
              onCoordinatesChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
            />

            <View onLayout={layoutField('ballType')}>
            {isEditMode ? (
              <View className="gap-1">
                <Text className={labelClassName('brand')}>Ball Type</Text>
                <View className="rounded-control border border-outline-variant bg-surface-container-low px-4 py-3">
                  <Text className="font-sans text-base text-on-surface-variant">
                    {ballType === BallType.Tennis ? 'Tennis Ball' : 'Leather Ball'}
                  </Text>
                </View>
              </View>
            ) : (
            <RadioGroup
              label="Ball Type"
              options={ballTypeOptions}
              value={ballType}
              onChange={onBallTypeChange}
              error={fieldErrors.ballType}
              indicatorOnly
              horizontal
            />
            )}
            </View>

            {isEditMode && ballType === BallType.Tennis ? (
              <View className="gap-3">
                <View className="gap-1">
                  <Text className={labelClassName('brand')}>Tournament For</Text>
                  <View className="rounded-control border border-outline-variant bg-surface-container-low px-4 py-3">
                    <Text className="font-sans text-base text-on-surface-variant">{scopeLabel}</Text>
                  </View>
                </View>
                {provinceLabel ? (
                  <View className="gap-1">
                    <Text className={labelClassName('brand')}>Province</Text>
                    <View className="rounded-control border border-outline-variant bg-surface-container-low px-4 py-3">
                      <Text className="font-sans text-base text-on-surface-variant">
                        {provinceLabel}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {centerLabels.length > 0 ? (
                  <View className="gap-1">
                    <Text className={labelClassName('brand')}>Centers</Text>
                    <View className="rounded-control border border-outline-variant bg-surface-container-low px-4 py-3">
                      <Text className="font-sans text-base text-on-surface-variant">
                        {centerLabels.join(', ')}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {!isEditMode && isTennisBall ? (
              <View onLayout={layoutField('citySelection')}>
              <Select
                label="Tournament For"
                placeholder="Select scope"
                value={citySelection}
                options={scopeOptions}
                onChange={(value) => onScopeChange(value as CitySelection)}
                error={fieldErrors.citySelection}
              />
              </View>
            ) : null}

            {!isEditMode && isMultiCenters ? (
              <View className="gap-4">
                <View onLayout={layoutField('province')}>
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
                </View>
                <View onLayout={layoutField('centers')}>
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
              </View>
            ) : null}

            <View className="gap-4">
              <View onLayout={layoutField('numberOfTeams')}>
              <Select
                label="Number of Teams"
                placeholder="Select number of teams"
                value={numberOfTeams}
                options={numberOfTeamsOptions}
                onChange={(value) => {
                  setNumberOfTeams(value);
                  clearFieldError('numberOfTeams');
                }}
                error={fieldErrors.numberOfTeams}
              />
              </View>
              <View onLayout={layoutField('playersPerTeam')}>
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
            </View>

            <Checkbox checked={hasRegistrationWindow} onChange={onRegistrationToggle}>
              <Text className="font-sans text-base text-on-surface">
                Have Registration Open and Close Date?
              </Text>
            </Checkbox>

            {hasRegistrationWindow ? (
              <View className="gap-4 pl-1">
                <View onLayout={layoutField('registrationOpenDate')}>
                <DateField
                  label="Registration Open Date"
                  value={registrationOpenDate}
                  onChange={(value) => {
                    setRegistrationOpenDate(value);
                    clearRegistrationFieldErrors();
                  }}
                  enforceSignupAgeMax={false}
                  error={fieldErrors.registrationOpenDate}
                />
                </View>
                <View onLayout={layoutField('registrationOpenTime')}>
                <TimeField
                  label="Registration Open Time"
                  value={registrationOpenTime}
                  onChange={(value) => {
                    setRegistrationOpenTime(value);
                    clearRegistrationFieldErrors();
                  }}
                  error={fieldErrors.registrationOpenTime}
                />
                </View>
                <View onLayout={layoutField('registrationCloseDate')}>
                <DateField
                  label="Registration Close Date"
                  value={registrationCloseDate}
                  onChange={(value) => {
                    setRegistrationCloseDate(value);
                    clearRegistrationFieldErrors();
                  }}
                  enforceSignupAgeMax={false}
                  error={fieldErrors.registrationCloseDate}
                />
                </View>
                <View onLayout={layoutField('registrationCloseTime')}>
                <TimeField
                  label="Registration Close Time"
                  value={registrationCloseTime}
                  onChange={(value) => {
                    setRegistrationCloseTime(value);
                    clearRegistrationFieldErrors();
                  }}
                  error={fieldErrors.registrationCloseTime}
                />
                </View>
              </View>
            ) : null}

            <Checkbox checked={hasAuctionDate} onChange={onAuctionToggle}>
              <Text className="font-sans text-base text-on-surface">Have Auction Date?</Text>
            </Checkbox>

            {hasAuctionDate ? (
              <View onLayout={layoutField('auctionDate')}>
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
              </View>
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
              <View onLayout={layoutField('videoUploadEndDate')}>
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
              </View>
            ) : null}

            {formError ? (
              <View className="rounded-lg bg-primary-50 px-4 py-3">
                <Text className="font-sans text-sm text-primary">{formError}</Text>
              </View>
            ) : null}

            <Button
              onPress={() => void onSubmit()}
              disabled={submitting}
              className="mt-2 h-14 w-full"
              label={submitting ? undefined : isEditMode ? 'Save Changes' : 'Add Tournament'}
            >
              {submitting ? <ActivityIndicator color={colors.textInverse} /> : null}
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
        title={isEditMode ? 'Tournament Updated' : 'Tournament Created'}
        message={
          isEditMode
            ? 'Your tournament has been updated successfully.'
            : 'Your tournament has been created successfully.'
        }
        onDismiss={onSuccessDismiss}
      />
    </SafeAreaView>
  );
}
