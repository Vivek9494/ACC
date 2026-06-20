import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import {
  BallType,
  MATCH_OVERS_PER_INNINGS_OPTIONS,
  MATCH_SCHEDULING_FORMAT_LABELS,
  MATCH_SETUP_FORM_MESSAGES,
  MatchSchedulingFormat,
  MatchType,
  clampPowerplaySelection,
  defaultMatchTypeForSchedulingFormat,
  maxOversPerBowlerOptionsForInnings,
  normalizeTeamPairKey,
  powerplayOversOptionsForInnings,
  type RoundRobinMatchSetupContext,
  validateBattingPowerplayOvers,
  validatePowerplayOvers,
  type CreateMatchRequest,
  type GroupSummary,
  type TeamSummary,
  type TournamentDetail,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { BottomTabBar } from '../../../src/components/ui/BottomTabBar';
import { Checkbox } from '../../../src/components/ui/Checkbox';
import { FIELD_ORANGE, INPUT_SHADOW_STYLE } from '../../../src/components/ui/fieldStyles';
import { MatchTypeSelect } from '../../../src/components/ui/MatchTypeSelect';
import { ProfileMenu } from '../../../src/components/ui/ProfileMenu';
import { Select } from '../../../src/components/ui/Select';
import { SuccessDialog } from '../../../src/components/ui/SuccessDialog';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { TimeField } from '../../../src/components/ui/TimeField';
import { TournamentLocationField } from '../../../src/components/ui/TournamentLocationField';
import { RoundRobinSetupInfoCard } from '../../../src/components/tournament/RoundRobinSetupInfoCard';
import {
  ApiRequestError,
  createMatch,
  getRoundRobinMatchSetupContext,
  getTournament,
  listGroups,
} from '../../../src/lib/api';
import { formatTournamentMatchDay, sortTournamentDates } from '../../../src/lib/tournament-display';
import { useRoleTabConfig } from '../../../src/lib/role-tab-config';

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

export default function MatchSetupScreen(): React.ReactElement {
  const { id: tournamentId, format: formatParam } = useLocalSearchParams<{
    id: string;
    format?: string;
  }>();
  const router = useRouter();
  const schedulingFormat = parseSchedulingFormat(formatParam);
  const formatLabel = MATCH_SCHEDULING_FORMAT_LABELS[schedulingFormat];
  const isRoundRobin = schedulingFormat === MatchSchedulingFormat.RoundRobin;
  const isManual = schedulingFormat === MatchSchedulingFormat.Manual;
  const tabConfig = useRoleTabConfig('matches');

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

  const showGroupField =
    !isRoundRobin &&
    tournament?.matchSchedulingFormat === MatchSchedulingFormat.GroupStageKnockout;

  const isTennisBall = tournament?.ballType === BallType.Tennis;
  const isLeatherBall = tournament?.ballType === BallType.Leather;
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
      if (detail.matchSchedulingFormat === MatchSchedulingFormat.GroupStageKnockout) {
        setGroups(await listGroups(tournamentId));
      } else {
        setGroups([]);
      }
      if (schedulingFormat === MatchSchedulingFormat.RoundRobin) {
        setRoundRobinContext(await getRoundRobinMatchSetupContext(tournamentId));
      } else {
        setRoundRobinContext(null);
      }
    } catch (err) {
      setTournament(null);
      setLoadError(err instanceof ApiRequestError ? err.message : 'Could not load tournament.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, schedulingFormat]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableTeams = useMemo((): TeamSummary[] => {
    const teams = (tournament?.teams ?? []).map((team) => ({
      id: team.id,
      tournamentId: tournament?.id ?? '',
      name: team.name,
      logoUrl: team.logoUrl,
      memberCount: team.memberCount,
      groupId: team.groupId,
      groupName: team.groupName,
    }));
    if (!showGroupField || !groupId) {
      return teams;
    }
    return teams.filter((team) => team.groupId === groupId);
  }, [groupId, showGroupField, tournament]);

  const teamOptions = availableTeams.map((team) => ({ value: team.id, label: team.name }));
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

  const groupOptions = groups.map((group) => ({ value: group.id, label: group.name }));

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

  async function handleSubmit(): Promise<void> {
    if (!tournamentId || !tournament) {
      setSubmitError('Tournament not found.');
      return;
    }

    const errors: Record<string, string> = {};
    if (!matchType) {
      errors.matchType = MATCH_SETUP_FORM_MESSAGES.matchType.required;
    }
    if (showGroupField && !groupId) {
      errors.groupId = MATCH_SETUP_FORM_MESSAGES.group.required;
    }
    if (!teamAId) {
      errors.teamAId = MATCH_SETUP_FORM_MESSAGES.teamA.required;
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
        roundRobinContext?.existingPairKeys.includes(normalizeTeamPairKey(teamAId, teamBId))
      ) {
        errors.teamBId = MATCH_SETUP_FORM_MESSAGES.duplicatePairing.duplicate;
      }
    }
    if (!groundAddress.trim()) {
      errors.groundLocation = MATCH_SETUP_FORM_MESSAGES.ground.required;
    }
    if (groundLat == null || groundLng == null) {
      errors.groundLocation = MATCH_SETUP_FORM_MESSAGES.coordinates.required;
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
    }
    if (!matchTime.trim()) {
      errors.matchTime = MATCH_SETUP_FORM_MESSAGES.matchTime.required;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
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
        groupId: showGroupField ? groupId : null,
        matchType: matchType as MatchType,
        groundLocation: groundAddress.trim(),
        geofenceLat: groundLat,
        geofenceLng: groundLng,
        oversPerInnings,
        maxOversPerBowler,
        ...(powerplayOvers != null ? { powerplayOvers } : {}),
        ...(isTennisBall && battingPowerplayOvers != null ? { battingPowerplayOvers } : {}),
        matchDate,
        startTime: combineMatchStartIso(matchDate!, matchTime.trim()),
        ...(showReportingTime && reportingTime.trim()
          ? { reportingTime: combineMatchStartIso(matchDate!, reportingTime.trim()) }
          : {}),
      };
      await createMatch(tournamentId, body);
      setShowSuccessDialog(true);
    } catch (err) {
      if (err instanceof ApiRequestError && err.error.fields) {
        setFieldErrors(err.error.fields);
        setSubmitError(null);
      } else {
        setSubmitError(err instanceof ApiRequestError ? err.message : 'Could not schedule match.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuccessDismiss(): void {
    setShowSuccessDialog(false);
    if (tournamentId) {
      router.replace({
        pathname: '/tournaments/[id]',
        params: { id: tournamentId, tab: 'Matches' },
      });
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
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-black/5"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={FIELD_ORANGE} />
        </Pressable>
        <ProfileMenu />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName={`gap-5 px-4 pt-2 ${isManual ? 'pb-40' : 'pb-32'}`}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            {isRoundRobin ? (
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

          <View
            className={
              isManual
                ? 'gap-4 rounded-control border border-outline-variant bg-surface p-4'
                : 'gap-4'
            }
            style={isManual ? INPUT_SHADOW_STYLE : undefined}
          >
          <MatchTypeSelect
            value={matchType}
            onChange={(value) => {
              setMatchType(value);
              clearField('matchType');
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
                setGroupId(value);
                setTeamAId(null);
                setTeamBId(null);
                clearField('groupId');
              }}
              error={fieldErrors.groupId}
            />
          ) : null}

          <Select
            label="Team A"
            placeholder="Select Team A"
            value={teamAId}
            options={teamOptions}
            onChange={(value) => {
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
              <Text className="font-sans text-sm text-on-surface">
                Does Opposite team is ACC 0/3/6/9?
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
            <Text className="-mt-3 font-sans text-sm text-primary">{fieldErrors.groundLocation}</Text>
          ) : null}

          <Select
            label="Overs"
            placeholder="Select overs"
            value={oversPerInnings != null ? String(oversPerInnings) : null}
            options={oversOptions}
            onChange={(value) => {
              const parsed = Number(value);
              const nextOvers = Number.isFinite(parsed) ? parsed : null;
              setOversPerInnings(nextOvers);
              setMaxOversPerBowler(null);
              setPowerplayOvers((current) => clampPowerplaySelection(current, nextOvers));
              setBattingPowerplayOvers((current) =>
                clampPowerplaySelection(current, nextOvers),
              );
              clearField('oversPerInnings');
              clearField('maxOversPerBowler');
              clearField('powerplayOvers');
              clearField('battingPowerplayOvers');
            }}
            error={fieldErrors.oversPerInnings}
          />

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

          {isLeatherBall || isTennisBall ? (
            <Select
              label="Powerplay Overs"
              placeholder={oversPerInnings != null ? 'Select powerplay overs' : 'Select overs first'}
              value={powerplayOvers != null ? String(powerplayOvers) : null}
              options={powerplayOptions}
              onChange={(value) => {
                const parsed = Number(value);
                setPowerplayOvers(Number.isFinite(parsed) ? parsed : null);
                clearField('powerplayOvers');
              }}
              error={fieldErrors.powerplayOvers}
            />
          ) : null}

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

          <TimeField
            label="Match Time"
            value={matchTime}
            onChange={(value) => {
              setMatchTime(value);
              clearField('matchTime');
            }}
            error={fieldErrors.matchTime}
          />

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
        </ScrollView>

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
              {submitting ? 'Scheduling…' : 'Schedule Match'}
            </Text>
          </Button>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {isManual ? (
        <BottomTabBar
          tabs={tabConfig.tabs}
          activeKey={tabConfig.activeKey}
          onTabPress={tabConfig.onTabPress}
        />
      ) : null}

      {submitting ? (
        <View className="absolute inset-0 items-center justify-center bg-black/10">
          <ActivityIndicator color={FIELD_ORANGE} size="large" />
        </View>
      ) : null}

      <SuccessDialog
        visible={showSuccessDialog}
        title="Match Scheduled"
        message="Your match has been added to the tournament schedule."
        onDismiss={handleSuccessDismiss}
        continueLabel="Continue"
        autoDismissMs={0}
      />
    </SafeAreaView>
  );
}
