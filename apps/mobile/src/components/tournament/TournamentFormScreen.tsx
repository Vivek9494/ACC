import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import {
  BallType,
  CitySelection,
  DEFAULT_TOURNAMENT_FORMAT,
  KNOCKOUT_TEAM_COUNT_MESSAGES,
  TOURNAMENT_FIELD_LIMITS,
  TournamentType,
  buildKnockoutTeamCountOptions,
  canConfigureKnockoutTeamCount,
  isMediaStorageKey,
  parseOptionalTournamentFee,
  resolveTournamentFormDates,
  resolvesToAplOnCreate,
  sanitizeTournamentFeeInput,
  startOfTodayForDatePicker,
  type CreateTournamentRequest,
  deferredMaxOversPerBowler,
  type TournamentDetail,
  type TournamentTypeDefinitionCatalogEntry,
  type UpdateTournamentRequest,
  UserRole,
} from '@acc/types';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
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
import { Button } from '../ui/Button';
import { KeyboardAwareFormScrollView } from '../ui/KeyboardAwareFormScrollView';
import { Checkbox } from '../ui/Checkbox';
import { DateField } from '../ui/DateField';
import { FIELD_ORANGE, labelClassName } from '../ui/fieldStyles';
import { MultiSelect, MultiSelectChips } from '../ui/MultiSelect';
import { ScreenHeader } from '../ui/ScreenHeader';
import { RadioGroup } from '../ui/RadioGroup';
import { Select, type SelectOption } from '../ui/Select';
import { SuccessDialog } from '../ui/SuccessDialog';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';
import { TimeField } from '../ui/TimeField';
import { TournamentDatesField } from '../ui/TournamentDatesField';
import { TournamentLeatherDateRangeField } from '../ui/TournamentLeatherDateRangeField';
import { TournamentLocationField } from '../ui/TournamentLocationField';
import { TournamentPosterField } from '../ui/TournamentPosterField';
import {
  ApiRequestError,
  createTournament,
  getProfile,
  getTournamentEditForm,
  listTournamentTypeCatalog,
  updateTournament,
} from '../../lib/api';
import { uploadTournamentPoster } from '../../lib/imageUpload';
import { isLocalImageUri, type PickedImageFile } from '../../lib/imagePicker';
import { useAuth } from '../../lib/auth-context';
import { tournamentDetailHref } from '../../lib/tournament-detail-route';
import { resolveVenueDisplayTimezone } from '../../lib/venue-time';
import { canCreateTournament } from '../../lib/can-create-tournament';
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

  const [profileLoading, setProfileLoading] = useState(!isEditMode);
  const [editLoading, setEditLoading] = useState(isEditMode);
  const [defaultProvinceId, setDefaultProvinceId] = useState<string | null>(null);
  const [tournamentProvinceId, setTournamentProvinceId] = useState<string | null>(null);
  const [selectedCenterIds, setSelectedCenterIds] = useState<string[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [minTeamCount, setMinTeamCount] = useState(0);
  const [datesWithMatches, setDatesWithMatches] = useState<string[]>([]);
  const [scopeLabel, setScopeLabel] = useState('');
  const [centerLabels, setCenterLabels] = useState<string[]>([]);

  const [poster, setPoster] = useState<TournamentPosterSelection | null>(null);
  const [posterUploading, setPosterUploading] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [year, setYear] = useState<string | null>(String(CURRENT_YEAR));
  const [tournamentDates, setTournamentDates] = useState<string[]>([]);
  const [leatherFromDate, setLeatherFromDate] = useState('');
  const [leatherEndDate, setLeatherEndDate] = useState('');
  const [tournamentTimezone, setTournamentTimezone] = useState<string | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [ballType, setBallType] = useState<BallType | null>(null);
  const [citySelection, setCitySelection] = useState<CitySelection | null>(null);
  const [tournamentTypeDefinitionId, setTournamentTypeDefinitionId] = useState<string | null>(
    null,
  );
  const [tournamentTypeCatalog, setTournamentTypeCatalog] = useState<
    TournamentTypeDefinitionCatalogEntry[]
  >([]);
  const [tournamentTypesLoading, setTournamentTypesLoading] = useState(false);
  const [numberOfTeams, setNumberOfTeams] = useState<string | null>(null);
  const [knockoutTeamCount, setKnockoutTeamCount] = useState<string | null>(null);
  const [editTournamentType, setEditTournamentType] = useState<TournamentType | null>(null);
  const [editGroupCount, setEditGroupCount] = useState(0);
  const [hasKnockoutBracket, setHasKnockoutBracket] = useState(false);
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
  const [videoUploadStartDate, setVideoUploadStartDate] = useState('');
  const [videoUploadStartTime, setVideoUploadStartTime] = useState('');
  const [videoUploadEndDate, setVideoUploadEndDate] = useState('');
  const [videoUploadEndTime, setVideoUploadEndTime] = useState('');

  const [feeFullTime, setFeeFullTime] = useState('');
  const [feePartTime, setFeePartTime] = useState('');

  const [fieldErrors, setFieldErrors] = useState<TournamentFormFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [savedTournamentId, setSavedTournamentId] = useState<string | null>(null);
  const savedTournamentIdRef = useRef<string | null>(null);
  const successNavigatedRef = useRef(false);
  /** Prevents edit load from overwriting in-progress form edits when load re-runs. */
  const editFormHydratedForTournamentIdRef = useRef<string | null>(null);
  const initialLeatherFromDateRef = useRef('');
  const initialLeatherEndDateRef = useRef('');
  const initialVideoUploadStartDateRef = useRef('');

  const scrollRef = useRef<ScrollView>(null);
  const fieldOffsets = useRef<Partial<Record<TournamentFormFieldKey, number>>>({});

  const layoutField = useCallback(
    (key: TournamentFormFieldKey) => (event: LayoutChangeEvent) => {
      registerTournamentFieldLayout(fieldOffsets, key, event);
    },
    [],
  );

  const scrollToField = useCallback((key: TournamentFormFieldKey) => {
    const scrollKey =
      key === 'leatherFromDate' || key === 'leatherEndDate' ? 'tournamentDates' : key;
    const y = fieldOffsets.current[scrollKey];
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

  const scopeOptions = useMemo((): SelectOption[] => {
    const typeOptions = tournamentTypeCatalog.map((type) => ({
      value: type.id,
      label: type.name,
    }));
    return [...typeOptions, { value: CitySelection.Multi, label: 'Multi-centers' }];
  }, [tournamentTypeCatalog]);

  const scopeSelectValue =
    citySelection === CitySelection.Multi
      ? CitySelection.Multi
      : tournamentTypeDefinitionId;

  const isTennisBall = ballType === BallType.Tennis;
  const isLeatherBall = ballType === BallType.Leather;
  const venueTimezone = resolveVenueDisplayTimezone(tournamentTimezone).timezone;
  const leatherDateMinimum = useMemo(
    () => startOfTodayForDatePicker(venueTimezone),
    [venueTimezone],
  );

  function datesForSubmit(): string[] {
    return resolveTournamentFormDates({
      ballType,
      tournamentDates,
      leatherFromDate,
      leatherEndDate,
    });
  }
  const isMultiCenters = isTennisBall && citySelection === CitySelection.Multi;
  const showKnockoutTeamCountField = isEditMode
    ? editTournamentType === TournamentType.APL
    : resolvesToAplOnCreate(ballType, citySelection);
  const configuredTotalTeams = numberOfTeams ? Number(numberOfTeams) : 0;
  const knockoutPrerequisitesMet = canConfigureKnockoutTeamCount(
    isEditMode ? editGroupCount : 0,
    configuredTotalTeams,
  );
  const knockoutTeamCountOptions = useMemo(
    () =>
      buildKnockoutTeamCountOptions(
        isEditMode ? editGroupCount : 0,
        configuredTotalTeams,
      ),
    [configuredTotalTeams, editGroupCount, isEditMode],
  );
  const knockoutFieldLocked = isEditMode && hasKnockoutBracket;
  const knockoutFieldDisabled =
    !isEditMode || !knockoutPrerequisitesMet || knockoutFieldLocked;
  const knockoutDisabledHint = !isEditMode || !knockoutPrerequisitesMet
    ? KNOCKOUT_TEAM_COUNT_MESSAGES.prerequisites
    : null;

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
      setTournamentProvinceId((current) => current ?? profile.provinceId);
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
    if (isEditMode || !isTennisBall || !tournamentProvinceId) {
      setTournamentTypeCatalog([]);
      setTournamentTypesLoading(false);
      return;
    }
    let cancelled = false;
    setTournamentTypesLoading(true);
    listTournamentTypeCatalog(tournamentProvinceId, BallType.Tennis)
      .then((rows) => {
        if (!cancelled) {
          setTournamentTypeCatalog(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTournamentTypeCatalog([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTournamentTypesLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isEditMode, isTennisBall, tournamentProvinceId]);

  useEffect(() => {
    if (
      tournamentTypeDefinitionId &&
      !tournamentTypeCatalog.some((type) => type.id === tournamentTypeDefinitionId)
    ) {
      setTournamentTypeDefinitionId(null);
      if (citySelection === CitySelection.Apl) {
        setCitySelection(null);
        setSelectedCenterIds([]);
      }
    }
  }, [tournamentTypeCatalog, tournamentTypeDefinitionId, citySelection]);

  const loadEditForm = useCallback(async (options?: { silent?: boolean }) => {
    if (!tournamentId) {
      setAccessDenied(true);
      setEditLoading(false);
      return;
    }

    if (!options?.silent) {
      setEditLoading(true);
    }
    try {
      const data = await getTournamentEditForm(tournamentId);
      const hydrated = hydrateTournamentFormFromEditData(data);
      // Server-driven constraints — refresh even when skipping full re-hydration.
      setMinTeamCount(hydrated.minTeamCount);
      setDatesWithMatches(hydrated.datesWithMatches);
      if (editFormHydratedForTournamentIdRef.current !== tournamentId) {
        editFormHydratedForTournamentIdRef.current = tournamentId;
        setPoster(hydrated.poster);
        setName(hydrated.name);
        setYear(hydrated.year);
        setTournamentDates(hydrated.tournamentDates);
        setLeatherFromDate(hydrated.leatherFromDate);
        setLeatherEndDate(hydrated.leatherEndDate);
        initialLeatherFromDateRef.current = hydrated.leatherFromDate;
        initialLeatherEndDateRef.current = hydrated.leatherEndDate;
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
        setVideoUploadStartDate(hydrated.videoUploadStartDate);
        setVideoUploadStartTime(hydrated.videoUploadStartTime);
        setVideoUploadEndDate(hydrated.videoUploadEndDate);
        setVideoUploadEndTime(hydrated.videoUploadEndTime);
        initialVideoUploadStartDateRef.current = hydrated.videoUploadStartDate;
        setFeeFullTime(hydrated.feeFullTime);
        setFeePartTime(hydrated.feePartTime);
        setScopeLabel(hydrated.scopeLabel);
        setTournamentProvinceId(hydrated.provinceId);
        setCenterLabels(hydrated.centerLabels);
        setEditTournamentType(hydrated.tournamentType);
        setEditGroupCount(hydrated.groupCount);
        setKnockoutTeamCount(hydrated.knockoutTeamCount);
        setHasKnockoutBracket(hydrated.hasKnockoutBracket);
      }
      setTournamentTimezone(data.timezone);
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
      if (!options?.silent) {
        setEditLoading(false);
      }
    }
  }, [tournamentId]);

  useFocusEffect(
    useCallback(() => {
      if (!isEditMode || status === 'loading') {
        return;
      }
      void loadEditForm({ silent: true });
    }, [isEditMode, loadEditForm, status]),
  );

  useEffect(() => {
    editFormHydratedForTournamentIdRef.current = null;
    initialLeatherFromDateRef.current = '';
    initialLeatherEndDateRef.current = '';
    initialVideoUploadStartDateRef.current = '';
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
      setVideoUploadStartDate('');
      setVideoUploadStartTime('');
      setVideoUploadEndDate('');
      setVideoUploadEndTime('');
      clearVideoUploadFieldErrors();
    }
  }

  function clearVideoUploadFieldErrors(): void {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.videoUploadStartDate;
      delete next.videoUploadStartTime;
      delete next.videoUploadEndDate;
      delete next.videoUploadEndTime;
      return next;
    });
  }

  function clearCenterPicker(): void {
    setSelectedCenterIds([]);
    clearFieldError('centers');
  }

  function onScopeChange(value: string): void {
    clearFieldError('citySelection');
    if (value === CitySelection.Multi) {
      setCitySelection(CitySelection.Multi);
      setTournamentTypeDefinitionId(null);
      clearCenterPicker();
      return;
    }
    setCitySelection(CitySelection.Apl);
    setTournamentTypeDefinitionId(value);
    const selectedType = tournamentTypeCatalog.find((type) => type.id === value);
    setSelectedCenterIds(selectedType?.centerIds ?? []);
    clearFieldError('centers');
  }

  function onTournamentProvinceChange(next: string): void {
    setTournamentProvinceId(next);
    setSelectedCenterIds([]);
    setCitySelection(null);
    setTournamentTypeDefinitionId(null);
    clearFieldError('province');
    clearFieldError('centers');
    clearFieldError('citySelection');
  }

  function onBallTypeChange(value: BallType): void {
    setBallType(value);
    clearFieldError('ballType');
    setTournamentDates([]);
    setLeatherFromDate('');
    setLeatherEndDate('');
    clearFieldError('tournamentDates');
    if (value === BallType.Leather) {
      setCitySelection(null);
      setTournamentTypeDefinitionId(null);
      setTournamentTypeCatalog([]);
      clearFieldError('citySelection');
      clearCenterPicker();
      setHasAuctionDate(false);
      setAuctionDate('');
      setImpactPlayerEnabled(false);
      setVideoRequired(false);
      setVideoUploadStartDate('');
      setVideoUploadStartTime('');
      setVideoUploadEndDate('');
      setVideoUploadEndTime('');
      setLocationAddress('');
      setLatitude(null);
      setLongitude(null);
      clearFieldError('tournamentLocation');
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.auctionDate;
        delete next.videoUploadStartDate;
        delete next.videoUploadStartTime;
        delete next.videoUploadEndDate;
        delete next.videoUploadEndTime;
        return next;
      });
    }
    if (value === BallType.Tennis) {
      setFeePartTime('');
    }
  }

  function feesForSubmit(): { feeFullTime: number | null; feePartTime: number | null } {
    const full = parseOptionalTournamentFee(feeFullTime);
    if (isLeatherBall) {
      return {
        feeFullTime: full,
        feePartTime: parseOptionalTournamentFee(feePartTime),
      };
    }
    return {
      feeFullTime: full,
      feePartTime: null,
    };
  }

  function tennisOptionsForSubmit(): {
    impactPlayerEnabled: boolean;
    videoRequired: boolean;
    videoUploadStartAt: string | null;
    videoUploadEndDate: string | null;
    auctionAt: string | null;
  } {
    if (!isTennisBall) {
      return {
        impactPlayerEnabled: false,
        videoRequired: false,
        videoUploadStartAt: null,
        videoUploadEndDate: null,
        auctionAt: null,
      };
    }
    const videoUploadStartAt =
      videoRequired && videoUploadStartDate && videoUploadStartTime
        ? combineLocalDateAndTimeToIso(videoUploadStartDate, videoUploadStartTime)
        : null;
    const videoUploadEndAt =
      videoRequired && videoUploadEndDate && videoUploadEndTime
        ? combineLocalDateAndTimeToIso(videoUploadEndDate, videoUploadEndTime)
        : null;
    return {
      impactPlayerEnabled,
      videoRequired,
      videoUploadStartAt,
      videoUploadEndDate: videoUploadEndAt,
      auctionAt: hasAuctionDate && auctionDate ? dateOnlyToUtcIso(auctionDate) : null,
    };
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
    const uploaded = await uploadTournamentPoster(uploadUri, selection.sizeBytes ?? 0);
    setPoster({
      ...selection,
      remoteUrl: uploaded.storageKey,
      uri: uploaded.posterUrl || selection.uri,
    });
    setPosterError(null);
    clearFieldError('poster');
    return uploaded.storageKey;
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
          leatherFromDate,
          leatherEndDate,
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
          hasAuctionDate: isTennisBall && hasAuctionDate,
          auctionDate: isTennisBall ? auctionDate : '',
          videoRequired: isTennisBall && videoRequired,
          videoUploadStartDate: isTennisBall ? videoUploadStartDate : '',
          videoUploadStartTime: isTennisBall ? videoUploadStartTime : '',
          videoUploadEndDate: isTennisBall ? videoUploadEndDate : '',
          videoUploadEndTime: isTennisBall ? videoUploadEndTime : '',
          venueTimezone,
          locationAddress,
          latitude,
          longitude,
          initialLeatherFromDate: initialLeatherFromDateRef.current,
          initialLeatherEndDate: initialLeatherEndDateRef.current,
          initialVideoUploadStartDate: initialVideoUploadStartDateRef.current,
          minTeamCount,
          datesWithMatches,
          tournamentType: editTournamentType ?? TournamentType.ACC,
          groupCount: editGroupCount,
          knockoutTeamCount,
          hasKnockoutBracket,
        })
      : validateTournamentForm({
          hasPoster: posterAttached,
          posterUri: poster?.uri ?? poster?.remoteUrl ?? null,
          posterPickError: posterAttached ? null : posterError,
          defaultProvinceId,
          name,
          year,
          tournamentDates,
          leatherFromDate,
          leatherEndDate,
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
          hasAuctionDate: isTennisBall && hasAuctionDate,
          auctionDate: isTennisBall ? auctionDate : '',
          videoRequired: isTennisBall && videoRequired,
          videoUploadStartDate: isTennisBall ? videoUploadStartDate : '',
          videoUploadStartTime: isTennisBall ? videoUploadStartTime : '',
          videoUploadEndDate: isTennisBall ? videoUploadEndDate : '',
          videoUploadEndTime: isTennisBall ? videoUploadEndTime : '',
          venueTimezone,
          locationAddress,
          latitude,
          longitude,
          centerSevakCenterIds:
            user?.role === UserRole.CenterSevak ? (user.centerSevakCenterIds ?? []) : undefined,
        });

    setFieldErrors(errors);
    const firstError = firstTournamentFormFieldError(errors);
    if (firstError) {
      setFormError(null);
      scrollToField(firstError);
      return;
    }

    if (!ballType || !year || !numberOfTeams || !posterAttached || !poster || !tournamentProvinceId) {
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
      let posterStorageKey: string | undefined =
        attachedPoster.remoteUrl && isMediaStorageKey(attachedPoster.remoteUrl)
          ? attachedPoster.remoteUrl
          : undefined;

      const needsPosterUpload = !posterStorageKey && isLocalImageUri(attachedPoster.uri);
      if (needsPosterUpload) {
        setPosterUploading(true);
        try {
          const uploadedKey = await uploadPosterSelection(attachedPoster);
          if (!uploadedKey) {
            applyPosterUploadError(new Error('Poster upload returned no URL'));
            scrollToField('poster');
            return;
          }
          posterStorageKey = uploadedKey;
        } catch (err) {
          applyPosterUploadError(err);
          scrollToField('poster');
          return;
        } finally {
          setPosterUploading(false);
        }
      }

      if (!isEditMode && !posterStorageKey) {
        applyPosterUploadError(new Error('Poster upload returned no URL'));
        scrollToField('poster');
        return;
      }

      if (!isEditMode && posterStorageKey && !isMediaStorageKey(posterStorageKey)) {
        applyPosterUploadError(new Error('Poster upload returned an invalid storage key'));
        scrollToField('poster');
        return;
      }

      if (__DEV__) {
        console.log('[AddTournament] poster upload complete', {
          posterUrl: posterStorageKey ?? '(unchanged)',
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

      const tennisOptions = tennisOptionsForSubmit();
      const fees = feesForSubmit();

      if (isEditMode) {
        if (!tournamentId) {
          return;
        }

        const updatePayload: UpdateTournamentRequest = {
          name: name.trim(),
          ...(posterStorageKey !== undefined ? { posterUrl: posterStorageKey } : {}),
          numberOfTeams: Number(numberOfTeams),
          playersPerTeam: playersPerTeam.trim() ? Number(playersPerTeam) : undefined,
          substitutesAllowed: DEFAULT_SUBSTITUTES_ALLOWED,
          ...(isTennisBall
            ? {
                locationAddress: locationAddress.trim() || null,
                latitude,
                longitude,
              }
            : {}),
          dates: datesForSubmit(),
          format: DEFAULT_TOURNAMENT_FORMAT,
          impactPlayerEnabled: tennisOptions.impactPlayerEnabled,
          videoRequired: tennisOptions.videoRequired,
          videoUploadStartAt: tennisOptions.videoUploadStartAt,
          videoUploadEndDate: tennisOptions.videoUploadEndDate,
          registrationOpenAt,
          registrationCloseAt,
          auctionAt: tennisOptions.auctionAt,
          feeFullTime: fees.feeFullTime,
          feePartTime: fees.feePartTime,
          provinceId: tournamentProvinceId ?? undefined,
          ...(editTournamentType === TournamentType.APL && !knockoutFieldLocked
            ? {
                knockoutTeamCount: knockoutTeamCount
                  ? Number(knockoutTeamCount)
                  : null,
              }
            : {}),
        };

        const updated = await updateTournament(tournamentId, updatePayload);
        initialLeatherFromDateRef.current = leatherFromDate;
        initialLeatherEndDateRef.current = leatherEndDate;
        initialVideoUploadStartDateRef.current = videoUploadStartDate;
        savedTournamentIdRef.current = updated.id;
        setSavedTournamentId(updated.id);
        successNavigatedRef.current = false;
        setShowSuccessDialog(true);
        return;
      }

      const payload: CreateTournamentRequest = {
        name: name.trim(),
        year: Number(year),
        posterUrl: posterStorageKey!,
        maxOversPerBowler: deferredMaxOversPerBowler(ballType),
        numberOfTeams: Number(numberOfTeams),
        playersPerTeam: playersPerTeam.trim() ? Number(playersPerTeam) : undefined,
        substitutesAllowed: DEFAULT_SUBSTITUTES_ALLOWED,
        ...(isTennisBall
          ? {
              locationAddress: locationAddress.trim() || null,
              latitude,
              longitude,
            }
          : {
              locationAddress: null,
              latitude: null,
              longitude: null,
            }),
        dates: datesForSubmit(),
        ballType,
        format: DEFAULT_TOURNAMENT_FORMAT,
        impactPlayerEnabled: tennisOptions.impactPlayerEnabled,
        videoRequired: tennisOptions.videoRequired,
        videoUploadStartAt: tennisOptions.videoUploadStartAt,
        videoUploadEndDate: tennisOptions.videoUploadEndDate,
        registrationOpenAt,
        registrationCloseAt,
        auctionAt: tennisOptions.auctionAt,
        feeFullTime: fees.feeFullTime,
        feePartTime: fees.feePartTime,
        provinceId: tournamentProvinceId as string,
        ...(ballType === BallType.Tennis && citySelection
          ? {
              citySelection,
              ...(citySelection === CitySelection.Multi
                ? { centerIds: selectedCenterIds }
                : tournamentTypeDefinitionId
                  ? { tournamentTypeDefinitionId }
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

    router.replace(tournamentDetailHref(user, tournamentIdToOpen));
  }, [router, savedTournamentId, user]);

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
        <ScreenHeader
          title={isEditMode ? 'Edit Tournament' : 'Add Tournament'}
          subtitle={
            isEditMode
              ? 'Update tournament details. Ball type and scope cannot be changed.'
              : 'Fill in the details to create a new tournament event.'
          }
          onBack={() => router.back()}
        />

        <KeyboardAwareFormScrollView
          ref={scrollRef}
          contentContainerClassName="px-4 pt-2"
          extraBottomPadding={32}
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

            {ballType ? (
            <View onLayout={layoutField('tournamentDates')}>
            {isLeatherBall ? (
              <TournamentLeatherDateRangeField
                fromDate={leatherFromDate}
                endDate={leatherEndDate}
                minimumFromDate={leatherDateMinimum}
                onFromDateChange={(value) => {
                  setLeatherFromDate(value);
                  clearFieldError('leatherFromDate');
                  clearFieldError('leatherEndDate');
                  clearFieldError('tournamentDates');
                }}
                onEndDateChange={(value) => {
                  setLeatherEndDate(value);
                  clearFieldError('leatherFromDate');
                  clearFieldError('leatherEndDate');
                  clearFieldError('tournamentDates');
                }}
                fromError={fieldErrors.leatherFromDate}
                endError={fieldErrors.leatherEndDate}
                spanError={fieldErrors.tournamentDates}
              />
            ) : (
              <TournamentDatesField
                values={tournamentDates}
                onChange={(next) => {
                  setTournamentDates(next);
                  clearFieldError('tournamentDates');
                }}
                error={fieldErrors.tournamentDates}
              />
            )}
            </View>
            ) : null}

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

            {isEditMode && ballType === BallType.Tennis ? (
              citySelection === CitySelection.Multi ? (
                <View className="flex-row gap-3">
                  <View className="min-w-0 flex-1">
                    <View className="gap-1">
                      <Text className={labelClassName('brand')}>Tournament For</Text>
                      <View className="rounded-control border border-outline-variant bg-surface-container-low px-4 py-3">
                        <Text className="font-sans text-base text-on-surface-variant">
                          {scopeLabel}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View className="min-w-0 flex-1">
                    <View className="gap-1">
                      <Text className={labelClassName('brand')}>Centers</Text>
                      <View className="rounded-control border border-outline-variant bg-surface-container-low px-4 py-3">
                        <Text
                          className="font-sans text-base text-on-surface-variant"
                          numberOfLines={1}
                        >
                          {centerLabels.length === 0
                            ? '—'
                            : centerLabels.length === 1
                              ? centerLabels[0]
                              : `${centerLabels.length} centers selected`}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="gap-1">
                  <Text className={labelClassName('brand')}>Tournament For</Text>
                  <View className="rounded-control border border-outline-variant bg-surface-container-low px-4 py-3">
                    <Text className="font-sans text-base text-on-surface-variant">{scopeLabel}</Text>
                  </View>
                </View>
              )
            ) : null}

            {!isEditMode && isTennisBall ? (
              isMultiCenters ? (
                <View className="gap-2">
                  <View className="flex-row gap-3">
                    <View className="min-w-0 flex-1" onLayout={layoutField('citySelection')}>
                      <Select
                        label="Tournament For"
                        placeholder="Select scope"
                        value={scopeSelectValue}
                        options={scopeOptions}
                        loading={tournamentTypesLoading}
                        onChange={(value) => onScopeChange(value)}
                        error={fieldErrors.citySelection}
                      />
                    </View>
                    <View className="min-w-0 flex-1" onLayout={layoutField('centers')}>
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
                        showChips={false}
                      />
                    </View>
                  </View>
                  <MultiSelectChips
                    values={selectedCenterIds}
                    options={centerOptions}
                    onChange={(next) => {
                      setSelectedCenterIds(next);
                      clearFieldError('centers');
                    }}
                  />
                </View>
              ) : (
                <View onLayout={layoutField('citySelection')}>
                  <Select
                    label="Tournament For"
                    placeholder="Select scope"
                    value={scopeSelectValue}
                    options={scopeOptions}
                    loading={tournamentTypesLoading}
                    onChange={(value) => onScopeChange(value)}
                    error={fieldErrors.citySelection}
                  />
                </View>
              )
            ) : null}

            {isTennisBall ? (
              <View onLayout={layoutField('tournamentLocation')}>
                <TournamentLocationField
                  address={locationAddress}
                  latitude={latitude}
                  longitude={longitude}
                  onAddressChange={(value) => {
                    setLocationAddress(value);
                    clearFieldError('tournamentLocation');
                  }}
                  onCoordinatesChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                    clearFieldError('tournamentLocation');
                  }}
                  error={fieldErrors.tournamentLocation}
                />
              </View>
            ) : null}

            <View className="flex-row gap-3">
              <View className="min-w-0 flex-1" onLayout={layoutField('numberOfTeams')}>
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
              <View className="min-w-0 flex-1" onLayout={layoutField('playersPerTeam')}>
                <TextInput
                  label="Players per Team"
                  value={playersPerTeam}
                  onChangeText={(text) => {
                    setPlayersPerTeam(text.replace(/\D/g, ''));
                    clearFieldError('playersPerTeam');
                  }}
                  keyboardType="number-pad"
                  placeholder="e.g. 28"
                  error={fieldErrors.playersPerTeam}
                />
              </View>
            </View>

            {showKnockoutTeamCountField ? (
              <View onLayout={layoutField('knockoutTeamCount')}>
                {knockoutFieldLocked ? (
                  <View className="gap-1">
                    <Text className={labelClassName('brand')}>Knockout Teams</Text>
                    <View className="rounded-control border border-outline-variant bg-surface-container-low px-4 py-3">
                      <Text className="font-sans text-base text-on-surface-variant">
                        {knockoutTeamCount ?? 'Not set'}
                      </Text>
                    </View>
                    <Text className="font-sans text-sm text-on-surface-variant">
                      {KNOCKOUT_TEAM_COUNT_MESSAGES.locked}
                    </Text>
                  </View>
                ) : (
                  <View className="gap-1">
                    <Select
                      label="Knockout Teams"
                      placeholder="Select knockout team count"
                      value={knockoutTeamCount}
                      options={knockoutTeamCountOptions}
                      onChange={(value) => {
                        setKnockoutTeamCount(value);
                        clearFieldError('knockoutTeamCount');
                      }}
                      disabled={knockoutFieldDisabled}
                      error={fieldErrors.knockoutTeamCount}
                    />
                    {knockoutFieldDisabled && knockoutDisabledHint ? (
                      <Text className="font-sans text-sm text-on-surface-variant">
                        {knockoutDisabledHint}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}

            <Checkbox checked={hasRegistrationWindow} onChange={onRegistrationToggle}>
              <Text className="font-sans text-base text-on-surface">
                Have Registration Open and Close Date?
              </Text>
            </Checkbox>

            {hasRegistrationWindow ? (
              <View className="gap-4 pl-1">
                <View className="flex-row gap-3">
                  <View
                    className="min-w-0 flex-[3]"
                    onLayout={layoutField('registrationOpenDate')}
                  >
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
                  <View
                    className="min-w-0 flex-[2]"
                    onLayout={layoutField('registrationOpenTime')}
                  >
                    <TimeField
                      label="Open Time"
                      value={registrationOpenTime}
                      onChange={(value) => {
                        setRegistrationOpenTime(value);
                        clearRegistrationFieldErrors();
                      }}
                      error={fieldErrors.registrationOpenTime}
                    />
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <View
                    className="min-w-0 flex-[3]"
                    onLayout={layoutField('registrationCloseDate')}
                  >
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
                  <View
                    className="min-w-0 flex-[2]"
                    onLayout={layoutField('registrationCloseTime')}
                  >
                    <TimeField
                      label="Close Time"
                      value={registrationCloseTime}
                      onChange={(value) => {
                        setRegistrationCloseTime(value);
                        clearRegistrationFieldErrors();
                      }}
                      error={fieldErrors.registrationCloseTime}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {isLeatherBall ? (
              <View className="flex-row gap-3">
                <View className="min-w-0 flex-1">
                  <TextInput
                    label="Full-time Player Fees"
                    value={feeFullTime}
                    onChangeText={(text) => setFeeFullTime(sanitizeTournamentFeeInput(text))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    leadingIcon={
                      <Text className="font-sans-semibold text-base text-on-surface">$</Text>
                    }
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <TextInput
                    label="Part-time Player Fees"
                    value={feePartTime}
                    onChangeText={(text) => setFeePartTime(sanitizeTournamentFeeInput(text))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    leadingIcon={
                      <Text className="font-sans-semibold text-base text-on-surface">$</Text>
                    }
                  />
                </View>
              </View>
            ) : isTennisBall ? (
              <TextInput
                label="Tournament Fees"
                value={feeFullTime}
                onChangeText={(text) => setFeeFullTime(sanitizeTournamentFeeInput(text))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                leadingIcon={
                  <Text className="font-sans-semibold text-base text-on-surface">$</Text>
                }
              />
            ) : null}

            {isTennisBall ? (
              <>
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
                  <View className="gap-4 pl-1">
                    <View className="flex-row gap-3">
                      <View
                        className="min-w-0 flex-[3]"
                        onLayout={layoutField('videoUploadStartDate')}
                      >
                        <DateField
                          label="Upload Start Date"
                          value={videoUploadStartDate}
                          onChange={(value) => {
                            setVideoUploadStartDate(value);
                            clearVideoUploadFieldErrors();
                          }}
                          enforceSignupAgeMax={false}
                          error={fieldErrors.videoUploadStartDate}
                        />
                      </View>
                      <View
                        className="min-w-0 flex-[2]"
                        onLayout={layoutField('videoUploadStartTime')}
                      >
                        <TimeField
                          label="Upload Start Time"
                          value={videoUploadStartTime}
                          onChange={(value) => {
                            setVideoUploadStartTime(value);
                            clearVideoUploadFieldErrors();
                          }}
                          error={fieldErrors.videoUploadStartTime}
                        />
                      </View>
                    </View>
                    <View className="flex-row gap-3">
                      <View
                        className="min-w-0 flex-[3]"
                        onLayout={layoutField('videoUploadEndDate')}
                      >
                        <DateField
                          label="Upload End Date"
                          value={videoUploadEndDate}
                          onChange={(value) => {
                            setVideoUploadEndDate(value);
                            clearVideoUploadFieldErrors();
                          }}
                          enforceSignupAgeMax={false}
                          error={fieldErrors.videoUploadEndDate}
                        />
                      </View>
                      <View
                        className="min-w-0 flex-[2]"
                        onLayout={layoutField('videoUploadEndTime')}
                      >
                        <TimeField
                          label="Upload End Time"
                          value={videoUploadEndTime}
                          onChange={(value) => {
                            setVideoUploadEndTime(value);
                            clearVideoUploadFieldErrors();
                          }}
                          error={fieldErrors.videoUploadEndTime}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
              </>
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
        </KeyboardAwareFormScrollView>
      </View>

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
