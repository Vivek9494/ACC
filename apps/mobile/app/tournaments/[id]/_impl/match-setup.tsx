import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import {
  BallType,
  HomeAway,
  HOME_AWAY_LABELS,
  MATCH_OVERS_PER_INNINGS_OPTIONS,
  MATCH_SCHEDULING_FORMAT_LABELS,
  MATCH_SETUP_FORM_MESSAGES,
  MatchSchedulingFormat,
  MatchType,
  clampPowerplaySelection,
  defaultMatchTypeForSchedulingFormat,
  isKnockoutMatchType,
  maxOversPerBowlerOptionsForInnings,
  normalizeTeamPairKey,
  powerplayOversOptionsForInnings,
  type RoundRobinMatchSetupContext,
  validateBattingPowerplayOvers,
  validatePowerplayOvers,
  type CreateMatchRequest,
  type GroupSummary,
  type MatchDetail,
  type TeamSummary,
  type TournamentDetail,
  calendarDateFromUtcMidnightIso,
  isDateOnlyBeforeTodayInZone,
  startOfTodayForDatePicker,
  tournamentSupportsGroups,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../../../../src/components/ui/KeyboardAwareFormScrollView';
import { Checkbox } from '../../../../src/components/ui/Checkbox';
import { DateField } from '../../../../src/components/ui/DateField';
import { FIELD_ORANGE, FIELD_LABEL_TEXT_CLASS } from '../../../../src/components/ui/fieldStyles';
import { MatchTypeSelect } from '../../../../src/components/ui/MatchTypeSelect';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { Select } from '../../../../src/components/ui/Select';
import { PillTabBar } from '../../../../src/components/ui/PillTabBar';
import { SuccessDialog } from '../../../../src/components/ui/SuccessDialog';
import { Text } from '../../../../src/components/ui/Text';
import { TextInput } from '../../../../src/components/ui/TextInput';
import { TimeField } from '../../../../src/components/ui/TimeField';
import { TournamentLocationField } from '../../../../src/components/ui/TournamentLocationField';
import { RoundRobinSetupInfoCard } from '../../../../src/components/tournament/RoundRobinSetupInfoCard';
import {
  ApiRequestError,
  createMatch,
  getMatch,
  getRoundRobinMatchSetupContext,
  getTournament,
  listGroups,
  updateMatch,
} from '../../../../src/lib/api';
import { formatTournamentMatchDay, sortTournamentDates } from '../../../../src/lib/tournament-display';
import { parseIsoDateLocal } from '../../../../src/lib/tournament-datetime';
import { useAuth } from '../../../../src/lib/auth-context';
import {
  canScheduleTournamentMatchesAsOrganizer,
} from '../../../../src/lib/can-schedule-matches';
import { TOURNAMENT_DETAIL_TAB } from '../../../../src/lib/tournament-detail-tabs';
import { tournamentDetailHref } from '../../../../src/lib/tournament-detail-route';
import { resolveVenueDisplayTimezone } from '../../../../src/lib/venue-time';
import type { SelectOption } from '../../../../src/components/ui/Select';

function parseSchedulingFormat(value: string | string[] | undefined): MatchSchedulingFormat {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && Object.values(MatchSchedulingFormat).includes(raw as MatchSchedulingFormat)) {
    return raw as MatchSchedulingFormat;
  }
  return MatchSchedulingFormat.Manual;
}

function combineMatchStartIso(matchDate: string, matchTime: string): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(matchDate);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(matchTime);
  if (!dateMatch || !timeMatch) {
    throw new Error('Invalid date or time');
  }
  const local = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0,
  );
  return local.toISOString();
}

function extractLocalTimeHm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function resolveMatchGroupId(
  match: Pick<MatchDetail, 'groupId' | 'homeTeamId' | 'awayTeamId'>,
  teams: TournamentDetail['teams'],
): string | null {
  if (match.groupId) {
    return match.groupId;
  }
  for (const teamId of [match.homeTeamId, match.awayTeamId]) {
    if (!teamId) {
      continue;
    }
    const team = teams.find((row) => row.id === teamId);
    if (team?.groupId) {
      return team.groupId;
    }
  }
  return null;
}

function buildGroupSelectOptions(input: {
  groups: GroupSummary[];
  tournamentGroups: GroupSummary[];
  selectedGroupId: string | null;
  selectedGroupName: string | null;
}): SelectOption[] {
  const byId = new Map<string, SelectOption>();
  for (const group of [...input.groups, ...input.tournamentGroups]) {
    byId.set(group.id, { value: group.id, label: group.name });
  }
  if (input.selectedGroupId && !byId.has(input.selectedGroupId)) {
    byId.set(input.selectedGroupId, {
      value: input.selectedGroupId,
      label: input.selectedGroupName ?? 'Saved group',
    });
  }
  return [...byId.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function appendTeamOptionIfMissing(
  options: SelectOption[],
  teamId: string | null,
  teamName: string | null,
): SelectOption[] {
  if (!teamId || options.some((option) => option.value === teamId)) {
    return options;
  }
  return [...options, { value: teamId, label: teamName ?? 'Unknown team' }];
}

export default function MatchSetupScreen(): React.ReactElement {
  const { id: tournamentId, format: formatParam, matchId: matchIdParam } = useLocalSearchParams<{
    id: string;
    format?: string;
    matchId?: string;
  }>();
  const isEditMode = Boolean(matchIdParam?.trim());
  const router = useRouter();
  const { user } = useAuth();
  const schedulingFormat = parseSchedulingFormat(formatParam);
  const formatLabel = MATCH_SCHEDULING_FORMAT_LABELS[schedulingFormat];
  const isRoundRobin = schedulingFormat === MatchSchedulingFormat.RoundRobin;
  const isManual = schedulingFormat === MatchSchedulingFormat.Manual;

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [roundRobinContext, setRoundRobinContext] = useState<RoundRobinMatchSetupContext | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const [groupId, setGroupId] = useState<string | null>(null);
  const [matchType, setMatchType] = useState<string | null>(() =>
    defaultMatchTypeForSchedulingFormat(schedulingFormat),
  );
  const [teamAId, setTeamAId] = useState<string | null>(null);
  const [teamBId, setTeamBId] = useState<string | null>(null);
  const [opponentIsAccTeam, setOpponentIsAccTeam] = useState(false);
  const [teamBExternalName, setTeamBExternalName] = useState('');
  const [homeAway, setHomeAway] = useState<HomeAway | null>(null);
  const [groundAddress, setGroundAddress] = useState('');
  const [groundLat, setGroundLat] = useState<number | null>(null);
  const [groundLng, setGroundLng] = useState<number | null>(null);
  const [oversPerInnings, setOversPerInnings] = useState<number | null>(null);
  const [maxOversPerBowler, setMaxOversPerBowler] = useState<number | null>(null);
  const [powerplayOvers, setPowerplayOvers] = useState<number | null>(null);
  const [battingPowerplayOvers, setBattingPowerplayOvers] = useState<number | null>(null);
  const [matchDate, setMatchDate] = useState<string | null>(null);
  const [matchTime, setMatchTime] = useState('');
  const [reportingTime, setReportingTime] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  /** Prevents edit-mode load from overwriting in-progress form edits when load re-runs. */
  const editFormHydratedForMatchIdRef = useRef<string | null>(null);
  /** Saved match date on edit load — allows keeping an unchanged past date (DP2). */
  const initialMatchDateRef = useRef<string | null>(null);
  /** Tracks group selection for edit — only reset teams when the user picks a different group. */
  const groupIdRef = useRef<string | null>(null);
  /** Saved group/team labels from match load — keep edit dropdowns populated. */
  const [savedGroupLabel, setSavedGroupLabel] = useState<string | null>(null);
  const [savedTeamAName, setSavedTeamAName] = useState<string | null>(null);
  const [savedTeamBName, setSavedTeamBName] = useState<string | null>(null);

  const isKnockoutMatch = isKnockoutMatchType(matchType);

  const showGroupField =
    !isRoundRobin &&
    !isKnockoutMatch &&
    tournament != null &&
    tournamentSupportsGroups({
      type: tournament.type,
      matchSchedulingFormat: tournament.matchSchedulingFormat,
      groupCount: tournament.groupCount,
    });

  const isTennisBall = tournament?.ballType === BallType.Tennis;
  const isLeatherBall = tournament?.ballType === BallType.Leather;
  const isCaptainOnlyScheduler =
    Boolean(
      tournament?.canScheduleMatches &&
        isLeatherBall &&
        !canScheduleTournamentMatchesAsOrganizer(user),
    ) && (tournament?.viewerLeaderTeamIds?.length ?? 0) > 0;
  const captainTeamIds = useMemo(
    () => tournament?.viewerLeaderTeamIds ?? [],
    [tournament?.viewerLeaderTeamIds],
  );
  const captainTeamId = captainTeamIds[0] ?? null;
  const showLeatherOpponentFields = isLeatherBall && !isRoundRobin;
  const showReportingTime = isLeatherBall && !isRoundRobin;

  const load = useCallback(async () => {
    if (!tournamentId) {
      setLoadError('Tournament not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const detail = await getTournament(tournamentId);
      setTournament(detail);
      const resolvedSchedulingFormat =
        detail.matchSchedulingFormat ?? schedulingFormat;
      const isGroupKnockout = tournamentSupportsGroups({
        type: detail.type,
        matchSchedulingFormat: detail.matchSchedulingFormat,
        groupCount: detail.groupCount,
      });
      if (isGroupKnockout) {
        const tournamentGroups = detail.groups ?? [];
        setGroups(
          tournamentGroups.length > 0 ? tournamentGroups : await listGroups(tournamentId),
        );
      } else {
        setGroups([]);
      }
      if (resolvedSchedulingFormat === MatchSchedulingFormat.RoundRobin) {
        setRoundRobinContext(await getRoundRobinMatchSetupContext(tournamentId));
      } else {
        setRoundRobinContext(null);
      }

      if (isEditMode && matchIdParam) {
        const existing = await getMatch(matchIdParam);
        if (existing.tournamentId !== tournamentId) {
          setLoadError('Match not found.');
          setTournament(null);
          return;
        }
        if (editFormHydratedForMatchIdRef.current !== matchIdParam) {
          editFormHydratedForMatchIdRef.current = matchIdParam;
          setMatchType(existing.matchType);
          const resolvedGroupId = isKnockoutMatchType(existing.matchType)
            ? null
            : resolveMatchGroupId(existing, detail.teams);
          setSavedGroupLabel(
            isKnockoutMatchType(existing.matchType)
              ? null
              : existing.groupName ??
                  detail.groups.find((group) => group.id === resolvedGroupId)?.name ??
                  detail.teams.find((team) => team.groupId === resolvedGroupId)?.groupName ??
                  null,
          );
          setSavedTeamAName(existing.homeTeamName);
          setSavedTeamBName(existing.awayTeamName);
          setTeamAId(existing.homeTeamId);
          setTeamBId(existing.awayTeamId);
          setOpponentIsAccTeam(Boolean(existing.awayTeamId));
          setTeamBExternalName(existing.externalOpponentName ?? '');
          setHomeAway(existing.homeAway ?? null);
          setGroupId(resolvedGroupId);
          groupIdRef.current = resolvedGroupId;
          setGroundAddress(existing.groundLocation ?? '');
          setGroundLat(existing.geofenceLat);
          setGroundLng(existing.geofenceLng);
          setOversPerInnings(existing.oversPerInnings);
          setMaxOversPerBowler(existing.maxOversPerBowler);
          setPowerplayOvers(existing.powerplayOvers);
          setBattingPowerplayOvers(existing.battingPowerplayOvers);
          if (existing.matchDate) {
            const loadedDate = calendarDateFromUtcMidnightIso(existing.matchDate);
            initialMatchDateRef.current = loadedDate;
            setMatchDate(loadedDate);
          } else {
            initialMatchDateRef.current = null;
          }
          if (existing.startTime) {
            setMatchTime(extractLocalTimeHm(existing.startTime));
          }
          if (existing.reportingTime) {
            setReportingTime(extractLocalTimeHm(existing.reportingTime));
          }
        }
      }
    } catch (err) {
      setTournament(null);
      setLoadError(err instanceof ApiRequestError ? err.message : 'Could not load tournament.');
    } finally {
      setLoading(false);
    }
  }, [isEditMode, matchIdParam, schedulingFormat, tournamentId]);

  useEffect(() => {
    editFormHydratedForMatchIdRef.current = null;
    initialMatchDateRef.current = null;
    groupIdRef.current = null;
    setSavedGroupLabel(null);
    setSavedTeamAName(null);
    setSavedTeamBName(null);
  }, [matchIdParam]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isCaptainOnlyScheduler && captainTeamId && !isEditMode) {
      setTeamAId(captainTeamId);
    }
  }, [captainTeamId, isCaptainOnlyScheduler, isEditMode]);

  const availableTeams = useMemo((): TeamSummary[] => {
    const teams = (tournament?.teams ?? []).map((team) => ({
      id: team.id,
      tournamentId: tournament?.id ?? '',
      name: team.name,
      logoUrl: team.logoUrl,
      memberCount: team.memberCount,
      groupId: team.groupId,
      groupName: team.groupName,
      hasMatches: team.hasMatches,
    }));
    if (!showGroupField || !groupId) {
      return teams;
    }
    return teams.filter(
      (team) => team.groupId === groupId || team.id === teamAId || team.id === teamBId,
    );
  }, [groupId, showGroupField, teamAId, teamBId, tournament]);

  const groupOptions = useMemo(
    () =>
      buildGroupSelectOptions({
        groups,
        tournamentGroups: tournament?.groups ?? [],
        selectedGroupId: groupId,
        selectedGroupName: savedGroupLabel,
      }),
    [groupId, groups, savedGroupLabel, tournament?.groups],
  );

  const teamOptions = useMemo(() => {
    let options = availableTeams.map((team) => ({ value: team.id, label: team.name }));
    options = appendTeamOptionIfMissing(options, teamAId, savedTeamAName);
    options = appendTeamOptionIfMissing(options, teamBId, savedTeamBName);
    return options;
  }, [availableTeams, savedTeamAName, savedTeamBName, teamAId, teamBId]);
  const teamAOptions = isCaptainOnlyScheduler
    ? teamOptions.filter((option) => captainTeamIds.includes(option.value))
    : teamOptions;
  const teamBOptions = useMemo(() => {
    const base = teamOptions.filter((option) => option.value !== teamAId);
    if (!isRoundRobin || !teamAId || !roundRobinContext) {
      return base;
    }
    const alreadyScheduled = new Set<string>();
    for (const key of roundRobinContext.existingPairKeys) {
      const [first, second] = key.split(':');
      if (first === teamAId) {
        alreadyScheduled.add(second);
      }
      if (second === teamAId) {
        alreadyScheduled.add(first);
      }
    }
    return base
      .filter((option) => !alreadyScheduled.has(option.value))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [isRoundRobin, roundRobinContext, teamAId, teamOptions]);

  const matchDateOptions = useMemo(
    () =>
      sortTournamentDates(tournament?.dates ?? []).map((date) => ({
        value: date,
        label: formatTournamentMatchDay(date),
      })),
    [tournament?.dates],
  );

  const venueTimezone = resolveVenueDisplayTimezone(tournament?.timezone).timezone;

  const matchDateMinimum = useMemo(
    () => startOfTodayForDatePicker(venueTimezone),
    [venueTimezone],
  );

  const leatherSpanMaxDate = useMemo(() => {
    if (!tournament?.endAt) {
      return undefined;
    }
    const dateOnly = calendarDateFromUtcMidnightIso(tournament.endAt);
    return parseIsoDateLocal(dateOnly) ?? undefined;
  }, [tournament?.endAt]);

  const oversOptions = MATCH_OVERS_PER_INNINGS_OPTIONS.map((option) => ({
    value: String(option.value),
    label: option.label,
  }));

  const oversPerBowlerOptions = useMemo(() => {
    if (oversPerInnings == null) {
      return [];
    }
    return maxOversPerBowlerOptionsForInnings(oversPerInnings).map((value) => ({
      value: String(value),
      label: `Max ${value} Overs`,
    }));
  }, [oversPerInnings]);

  const powerplayOptions = useMemo(() => {
    if (oversPerInnings == null) {
      return [];
    }
    return powerplayOversOptionsForInnings(oversPerInnings).map((value) => ({
      value: String(value),
      label: value === 0 ? '0 (none)' : `${value} Overs`,
    }));
  }, [oversPerInnings]);

  function clearField(key: string): void {
    setFieldErrors((current) => {
      if (!(key in current)) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function handleOversChange(value: string): void {
    const parsed = Number(value);
    const nextOvers = Number.isFinite(parsed) ? parsed : null;
    setOversPerInnings(nextOvers);
    setMaxOversPerBowler(null);
    setPowerplayOvers((current) => clampPowerplaySelection(current, nextOvers));
    setBattingPowerplayOvers((current) => clampPowerplaySelection(current, nextOvers));
    clearField('oversPerInnings');
    clearField('maxOversPerBowler');
    clearField('powerplayOvers');
    clearField('battingPowerplayOvers');
  }

  async function handleSubmit(): Promise<void> {
    if (!tournamentId || !tournament) {
      setSubmitError('Tournament not found.');
      return;
    }

    const errors: Record<string, string> = {};
    const requiresGroup = showGroupField && !isKnockoutMatchType(matchType);
    if (!matchType) {
      errors.matchType = MATCH_SETUP_FORM_MESSAGES.matchType.required;
    }
    if (requiresGroup && !groupId) {
      errors.groupId = MATCH_SETUP_FORM_MESSAGES.group.required;
    }
    if (!teamAId) {
      errors.teamAId = MATCH_SETUP_FORM_MESSAGES.teamA.required;
    } else if (isCaptainOnlyScheduler && !captainTeamIds.includes(teamAId)) {
      errors.teamAId = 'You can only schedule matches for your own team';
    }
    if (isLeatherBall && !isRoundRobin) {
      if (opponentIsAccTeam) {
        if (!teamBId) {
          errors.teamBId = MATCH_SETUP_FORM_MESSAGES.teamB.required;
        }
        if (teamAId && teamBId && teamAId === teamBId) {
          errors.teamBId = MATCH_SETUP_FORM_MESSAGES.teamsDistinct.duplicate;
        }
      } else if (!teamBExternalName.trim()) {
        errors.externalOpponentName = MATCH_SETUP_FORM_MESSAGES.externalOpponentName.required;
      }
    } else {
      if (!teamBId) {
        errors.teamBId = MATCH_SETUP_FORM_MESSAGES.teamB.required;
      }
      if (teamAId && teamBId && teamAId === teamBId) {
        errors.teamBId = MATCH_SETUP_FORM_MESSAGES.teamsDistinct.duplicate;
      }
      if (
        isRoundRobin &&
        teamAId &&
        teamBId &&
        roundRobinContext?.existingPairKeys.includes(normalizeTeamPairKey(teamAId, teamBId)) &&
        !(isEditMode && matchIdParam)
      ) {
        errors.teamBId = MATCH_SETUP_FORM_MESSAGES.duplicatePairing.duplicate;
      }
    }
    if (isLeatherBall) {
      if (!groundAddress.trim()) {
        errors.groundLocation = MATCH_SETUP_FORM_MESSAGES.ground.required;
      }
      if (groundLat == null || groundLng == null) {
        errors.groundLocation = MATCH_SETUP_FORM_MESSAGES.coordinates.required;
      }
    }
    if (oversPerInnings == null) {
      errors.oversPerInnings = MATCH_SETUP_FORM_MESSAGES.overs.required;
    }
    if (maxOversPerBowler == null) {
      errors.maxOversPerBowler = MATCH_SETUP_FORM_MESSAGES.oversPerBowler.required;
    }
    if (oversPerInnings != null && powerplayOvers != null) {
      const powerplayError = validatePowerplayOvers(oversPerInnings, powerplayOvers);
      if (powerplayError) {
        errors.powerplayOvers = powerplayError;
      }
    }
    if (isTennisBall && oversPerInnings != null && battingPowerplayOvers != null) {
      const battingError = validateBattingPowerplayOvers(oversPerInnings, battingPowerplayOvers);
      if (battingError) {
        errors.battingPowerplayOvers = battingError;
      }
    }
    if (!matchDate) {
      errors.matchDate = MATCH_SETUP_FORM_MESSAGES.matchDate.required;
    } else if (
      isDateOnlyBeforeTodayInZone(matchDate, venueTimezone) &&
      matchDate !== initialMatchDateRef.current
    ) {
      errors.matchDate = MATCH_SETUP_FORM_MESSAGES.matchDate.past;
    }
    if (!matchTime.trim()) {
      errors.matchTime = MATCH_SETUP_FORM_MESSAGES.matchTime.required;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError('Please complete all required fields below.');
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setSubmitting(true);

    try {
      const body: CreateMatchRequest = {
        homeTeamId: teamAId,
        awayTeamId: showLeatherOpponentFields && !opponentIsAccTeam ? null : teamBId,
        externalOpponentName:
          showLeatherOpponentFields && !opponentIsAccTeam ? teamBExternalName.trim() : null,
        groupId: requiresGroup ? groupId : null,
        matchType: matchType as MatchType,
        ...(isLeatherBall
          ? {
              groundLocation: groundAddress.trim(),
              geofenceLat: groundLat,
              geofenceLng: groundLng,
            }
          : {}),
        oversPerInnings,
        maxOversPerBowler,
        ...(powerplayOvers != null ? { powerplayOvers } : {}),
        ...(isTennisBall && battingPowerplayOvers != null ? { battingPowerplayOvers } : {}),
        matchDate,
        startTime: combineMatchStartIso(matchDate!, matchTime.trim()),
        ...(showReportingTime && reportingTime.trim()
          ? { reportingTime: combineMatchStartIso(matchDate!, reportingTime.trim()) }
          : {}),
        ...(showReportingTime ? { homeAway } : {}),
      };
      await (isEditMode && matchIdParam
        ? updateMatch(matchIdParam, body)
        : createMatch(tournamentId, body));
      setShowSuccessDialog(true);
    } catch (err) {
      if (err instanceof ApiRequestError && err.error.fields) {
        const apiFields = { ...err.error.fields };
        if (isKnockoutMatchType(matchType)) {
          delete apiFields.groupId;
        }
        setFieldErrors(apiFields);
        const visibleMessages = Object.values(apiFields);
        setSubmitError(
          visibleMessages.length > 0
            ? visibleMessages[0]!
            : err.message || 'Could not save match.',
        );
      } else {
        setSubmitError(
          err instanceof ApiRequestError
            ? err.message
            : isEditMode
              ? 'Could not update match.'
              : 'Could not schedule match.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuccessDismiss(): void {
    setShowSuccessDialog(false);
    if (tournamentId) {
      router.replace(
        tournamentDetailHref(user, tournamentId, TOURNAMENT_DETAIL_TAB.TournamentMatches),
      );
    } else {
      router.back();
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  if (loadError || !tournament) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-on-surface-variant">
            {loadError ?? 'Tournament not found.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader onBack={() => router.back()} />

      <KeyboardAwareFormScrollView
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        contentContainerClassName="gap-5 px-4 pt-2"
        extraBottomPadding={32}
        footer={
          <SafeAreaView
            edges={['bottom']}
            className="border-t border-outline-variant/20 bg-background px-4 pt-3"
          >
            <Button
              disabled={submitting}
              onPress={() => void handleSubmit()}
              className="h-14 w-full flex-row gap-2"
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textInverse} />
              <Text className="font-sans-semibold text-base text-on-primary">
                {submitting
                  ? isEditMode
                    ? 'Saving…'
                    : 'Scheduling…'
                  : isEditMode
                    ? 'Save Changes'
                    : 'Schedule Match'}
              </Text>
            </Button>
          </SafeAreaView>
        }
      >
          <View>
            {isEditMode ? (
              <>
                <Text className="font-sans-bold text-2xl text-on-surface">Edit Match Setup</Text>
                <Text className="mt-2 font-sans text-sm text-on-surface-variant">
                  Update the match details below and save your changes.
                </Text>
              </>
            ) : isRoundRobin ? (
              <>
                <Text className="font-sans-bold text-2xl text-on-surface">New Match Setup</Text>
                <Text className="mt-2 font-sans text-base text-on-surface-variant">
                  Tournament: {tournament.name} {formatLabel}
                </Text>
              </>
            ) : isManual ? (
              <>
                <Text className="font-sans-bold text-2xl text-on-surface">New Match Setup</Text>
                <Text className="mt-2 font-sans text-sm text-on-surface-variant">
                  Configure the manual match details below to proceed.
                </Text>
              </>
            ) : (
              <>
                <Text className="font-sans-bold text-2xl text-on-surface">Match Setup</Text>
                <Text className="mt-2 font-sans text-base text-on-surface-variant">
                  Configure details for the upcoming {formatLabel} fixture.
                </Text>
              </>
            )}
          </View>

          <View className="gap-4">
          <MatchTypeSelect
            value={matchType}
            onChange={(value) => {
              setMatchType(value);
              clearField('matchType');
              if (isKnockoutMatchType(value)) {
                setGroupId(null);
                groupIdRef.current = null;
                clearField('groupId');
              }
            }}
            error={fieldErrors.matchType}
          />

          {showGroupField ? (
            <Select
              label="Group Name"
              placeholder="Select group"
              value={groupId}
              options={groupOptions}
              onChange={(value) => {
                const previousGroupId = groupIdRef.current;
                setGroupId(value);
                groupIdRef.current = value;
                if (value !== previousGroupId) {
                  if (!isCaptainOnlyScheduler) {
                    setTeamAId(null);
                  }
                  setTeamBId(null);
                }
                clearField('groupId');
              }}
              error={fieldErrors.groupId}
            />
          ) : null}

          <Select
            label="Team A"
            placeholder="Select Team A"
            value={teamAId}
            options={teamAOptions}
            disabled={isCaptainOnlyScheduler}
            onChange={(value) => {
              if (isCaptainOnlyScheduler) {
                return;
              }
              setTeamAId(value);
              setTeamBId(null);
              clearField('teamAId');
              clearField('teamBId');
            }}
            error={fieldErrors.teamAId}
          />

          {showLeatherOpponentFields ? (
            <Checkbox
              checked={opponentIsAccTeam}
              onChange={(checked) => {
                setOpponentIsAccTeam(checked);
                setTeamBId(null);
                setTeamBExternalName('');
                clearField('teamBId');
                clearField('externalOpponentName');
              }}
            >
              <Text className={FIELD_LABEL_TEXT_CLASS}>
                Does Opposite team is ASC team?
              </Text>
            </Checkbox>
          ) : null}

          {showLeatherOpponentFields && !opponentIsAccTeam ? (
            <TextInput
              label="Enter Team B name"
              placeholder="Enter Team B name"
              value={teamBExternalName}
              onChangeText={(value) => {
                setTeamBExternalName(value);
                clearField('externalOpponentName');
              }}
              error={fieldErrors.externalOpponentName}
            />
          ) : (
            <Select
              label="Team B"
              placeholder="Select Team B"
              value={teamBId}
              options={teamBOptions}
              onChange={(value) => {
                setTeamBId(value);
                clearField('teamBId');
              }}
              error={fieldErrors.teamBId}
            />
          )}

          {isLeatherBall ? (
            <>
              <TournamentLocationField
                label="Ground Location"
                address={groundAddress}
                latitude={groundLat}
                longitude={groundLng}
                onAddressChange={(value) => {
                  setGroundAddress(value);
                  clearField('groundLocation');
                }}
                onCoordinatesChange={(lat, lng) => {
                  setGroundLat(lat);
                  setGroundLng(lng);
                  clearField('groundLocation');
                }}
              />
              {fieldErrors.groundLocation ? (
                <Text className="-mt-3 font-sans text-sm text-primary">
                  {fieldErrors.groundLocation}
                </Text>
              ) : null}
            </>
          ) : null}

          {showReportingTime ? (
            <View className="gap-2">
              <Text className={FIELD_LABEL_TEXT_CLASS}>Home / Away</Text>
              <PillTabBar
                accessibilityLabel="Home or Away ground setup responsibility"
                options={[
                  { value: HomeAway.Home, label: HOME_AWAY_LABELS.HOME },
                  { value: HomeAway.Away, label: HOME_AWAY_LABELS.AWAY },
                ]}
                value={homeAway}
                onChange={setHomeAway}
              />
              <Text className="font-sans text-sm text-on-surface-variant">
                Optional — indicates which side sets up stumps and boundary cones.
              </Text>
            </View>
          ) : null}

          {isLeatherBall || isTennisBall ? (
            <View className="flex-row items-start gap-3">
              <View className="min-w-0 flex-1">
                <Select
                  label="Overs"
                  placeholder="Select overs"
                  value={oversPerInnings != null ? String(oversPerInnings) : null}
                  options={oversOptions}
                  onChange={handleOversChange}
                  error={fieldErrors.oversPerInnings}
                />
              </View>
              <View className="min-w-0 flex-1">
                <Select
                  label="Powerplay Overs"
                  placeholder={
                    oversPerInnings != null ? 'Select powerplay overs' : 'Select overs first'
                  }
                  value={powerplayOvers != null ? String(powerplayOvers) : null}
                  options={powerplayOptions}
                  onChange={(value) => {
                    const parsed = Number(value);
                    setPowerplayOvers(Number.isFinite(parsed) ? parsed : null);
                    clearField('powerplayOvers');
                  }}
                  error={fieldErrors.powerplayOvers}
                />
              </View>
            </View>
          ) : (
            <Select
              label="Overs"
              placeholder="Select overs"
              value={oversPerInnings != null ? String(oversPerInnings) : null}
              options={oversOptions}
              onChange={handleOversChange}
              error={fieldErrors.oversPerInnings}
            />
          )}

          <Select
            label="Overs per Bowler"
            placeholder={oversPerInnings != null ? 'Select max overs' : 'Select overs first'}
            value={maxOversPerBowler != null ? String(maxOversPerBowler) : null}
            options={oversPerBowlerOptions}
            onChange={(value) => {
              const parsed = Number(value);
              setMaxOversPerBowler(Number.isFinite(parsed) ? parsed : null);
              clearField('maxOversPerBowler');
            }}
            error={fieldErrors.maxOversPerBowler}
          />

          {isTennisBall ? (
            <Select
              label="Batting Powerplay Overs"
              placeholder={
                oversPerInnings != null ? 'Select batting powerplay overs' : 'Select overs first'
              }
              value={battingPowerplayOvers != null ? String(battingPowerplayOvers) : null}
              options={powerplayOptions}
              onChange={(value) => {
                const parsed = Number(value);
                setBattingPowerplayOvers(Number.isFinite(parsed) ? parsed : null);
                clearField('battingPowerplayOvers');
              }}
              error={fieldErrors.battingPowerplayOvers}
            />
          ) : null}

          <View className="flex-row items-start gap-3">
            <View className="min-w-0 flex-1">
              {isLeatherBall ? (
                <DateField
                  label="Match Date"
                  value={matchDate ?? ''}
                  onChange={(value) => {
                    setMatchDate(value);
                    clearField('matchDate');
                  }}
                  enforceSignupAgeMax={false}
                  minimumDate={matchDateMinimum}
                  maximumDate={leatherSpanMaxDate}
                  error={fieldErrors.matchDate}
                />
              ) : (
                <Select
                  label="Match Date"
                  placeholder="Select match day"
                  value={matchDate}
                  options={matchDateOptions}
                  onChange={(value) => {
                    setMatchDate(value);
                    clearField('matchDate');
                  }}
                  error={fieldErrors.matchDate}
                />
              )}
            </View>
            <View className="min-w-0 flex-1">
              <TimeField
                label="Match Time"
                value={matchTime}
                onChange={(value) => {
                  setMatchTime(value);
                  clearField('matchTime');
                }}
                error={fieldErrors.matchTime}
              />
            </View>
          </View>

          {showReportingTime ? (
            <TimeField
              label="Reporting Time"
              value={reportingTime}
              onChange={(value) => {
                setReportingTime(value);
                clearField('reportingTime');
              }}
              error={fieldErrors.reportingTime}
            />
          ) : null}

          {isRoundRobin && roundRobinContext ? (
            <RoundRobinSetupInfoCard context={roundRobinContext} />
          ) : null}
          </View>

          {submitError ? (
            <Text className="font-sans text-sm text-primary">{submitError}</Text>
          ) : null}
      </KeyboardAwareFormScrollView>

      {submitting ? (
        <View className="absolute inset-0 items-center justify-center bg-black/10">
          <ActivityIndicator color={FIELD_ORANGE} size="large" />
        </View>
      ) : null}

      <SuccessDialog
        visible={showSuccessDialog}
        title={isEditMode ? 'Match Updated' : 'Match Scheduled'}
        message={
          isEditMode
            ? 'Your changes have been saved.'
            : 'Your match has been added to the tournament schedule.'
        }
        onDismiss={handleSuccessDismiss}
        continueLabel="Continue"
        autoDismissMs={0}
      />
    </SafeAreaView>
  );
}
