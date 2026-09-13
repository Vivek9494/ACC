import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import {
  BallType,
  HomeAway,
  HOME_AWAY_LABELS,
  MATCH_OVERS_PER_INNINGS_OPTIONS,
  MatchType,
  UserRole,
  calendarDateFromUtcMidnightIso,
  formatUtcIsoDate,
  maxOversPerBowlerOptionsForInnings,
  powerplayOversOptionsForInnings,
  validateMaxOversPerBowler,
  validatePowerplayOvers,
  type TournamentDetail,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../../src/components/ui/Button';
import { DateField } from '../../../../src/components/ui/DateField';
import { KeyboardAwareFormScrollView } from '../../../../src/components/ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader';
import { Select } from '../../../../src/components/ui/Select';
import { Text } from '../../../../src/components/ui/Text';
import { TextInput } from '../../../../src/components/ui/TextInput';
import { TimeField } from '../../../../src/components/ui/TimeField';
import { TournamentLocationField } from '../../../../src/components/ui/TournamentLocationField';
import { ApiRequestError, createBackfillMatch, getTournament } from '../../../../src/lib/api';
import { useAuth } from '../../../../src/lib/auth-context';
import { tournamentDetailHref } from '../../../../src/lib/tournament-detail-route';
import { TOURNAMENT_DETAIL_TAB } from '../../../../src/lib/tournament-detail-tabs';
import type { SelectOption } from '../../../../src/components/ui/Select';

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

/**
 * Admin-only: schedule a past ACC vs external opponent match, skip polling,
 * then continue into existing XI / opponent-name / ball-by-ball scoring screens.
 * No backfill badge is shown anywhere after creation.
 */
export default function BackfillPastMatchScreen(): React.ReactElement {
  const { id: tournamentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [teamAId, setTeamAId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState('');
  const [homeAway, setHomeAway] = useState<HomeAway | null>(null);
  const [groundAddress, setGroundAddress] = useState('');
  const [groundLat, setGroundLat] = useState<number | null>(null);
  const [groundLng, setGroundLng] = useState<number | null>(null);
  const [oversPerInnings, setOversPerInnings] = useState<number | null>(25);
  const [maxOversPerBowler, setMaxOversPerBowler] = useState<number | null>(5);
  const [powerplayOvers, setPowerplayOvers] = useState<number | null>(null);
  const [matchDate, setMatchDate] = useState<string | null>(null);
  const [matchTime, setMatchTime] = useState('10:00');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === UserRole.Admin;

  const load = useCallback(async () => {
    if (!tournamentId) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const detail = await getTournament(tournamentId);
      setTournament(detail);
      if (detail.ballType !== BallType.Leather) {
        setLoadError('Past-match backfill is only available for Leather (ACC) tournaments.');
      }
      if (detail.locationAddress) {
        setGroundAddress(detail.locationAddress);
        setGroundLat(detail.latitude);
        setGroundLng(detail.longitude);
      }
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Could not load tournament.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const teamOptions: SelectOption[] = useMemo(
    () =>
      (tournament?.teams ?? []).map((team) => ({
        value: team.id,
        label: team.name,
      })),
    [tournament?.teams],
  );

  const oversOptions: SelectOption[] = useMemo(
    () =>
      MATCH_OVERS_PER_INNINGS_OPTIONS.map((option) => ({
        value: String(option.value),
        label: option.label,
      })),
    [],
  );

  const bowlerOversOptions: SelectOption[] = useMemo(() => {
    if (oversPerInnings == null) {
      return [];
    }
    return maxOversPerBowlerOptionsForInnings(oversPerInnings).map((n) => ({
      value: String(n),
      label: String(n),
    }));
  }, [oversPerInnings]);

  const powerplayOptions: SelectOption[] = useMemo(() => {
    if (oversPerInnings == null) {
      return [];
    }
    return [
      { value: '', label: 'None' },
      ...powerplayOversOptionsForInnings(oversPerInnings).map((n) => ({
        value: String(n),
        label: String(n),
      })),
    ];
  }, [oversPerInnings]);

  const homeAwayOptions: SelectOption[] = useMemo(
    () =>
      Object.values(HomeAway).map((value) => ({
        value,
        label: HOME_AWAY_LABELS[value],
      })),
    [],
  );

  const spanMinimum = useMemo(() => {
    if (!tournament?.startAt) {
      return undefined;
    }
    return new Date(`${calendarDateFromUtcMidnightIso(tournament.startAt) ?? formatUtcIsoDate(new Date(tournament.startAt))}T12:00:00`);
  }, [tournament?.startAt]);

  const spanMaximum = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    if (!tournament?.endAt) {
      // Backfill is past-only — never allow selecting today or later.
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    const end = new Date(
      `${calendarDateFromUtcMidnightIso(tournament.endAt) ?? formatUtcIsoDate(new Date(tournament.endAt))}T12:00:00`,
    );
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return end < yesterday ? end : yesterday;
  }, [tournament?.endAt]);

  function clearField(key: string): void {
    setFieldErrors((prev) => {
      if (!(key in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(): Promise<void> {
    if (!tournamentId || !tournament || !isAdmin) {
      return;
    }
    const errors: Record<string, string> = {};
    if (!teamAId) {
      errors.teamAId = 'Select ACC team';
    }
    if (!opponentName.trim()) {
      errors.externalOpponentName = 'Enter opponent team name';
    }
    if (!matchDate) {
      errors.matchDate = 'Match date is required';
    }
    if (!matchTime.trim()) {
      errors.matchTime = 'Match time is required';
    }
    if (oversPerInnings == null) {
      errors.oversPerInnings = 'Overs is required';
    }
    if (maxOversPerBowler == null) {
      errors.maxOversPerBowler = 'Overs per bowler is required';
    } else if (oversPerInnings != null) {
      const bowlerErr = validateMaxOversPerBowler(oversPerInnings, maxOversPerBowler);
      if (bowlerErr) {
        errors.maxOversPerBowler = bowlerErr;
      }
    }
    if (powerplayOvers != null && oversPerInnings != null) {
      const ppErr = validatePowerplayOvers(oversPerInnings, powerplayOvers);
      if (ppErr) {
        errors.powerplayOvers = ppErr;
      }
    }
    if (!groundAddress.trim() || groundLat == null || groundLng == null) {
      errors.groundLocation = 'Select a ground location';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const match = await createBackfillMatch(tournamentId, {
        homeTeamId: teamAId,
        awayTeamId: null,
        externalOpponentName: opponentName.trim(),
        matchType: MatchType.LeagueMatch,
        matchDate: matchDate!,
        startTime: combineMatchStartIso(matchDate!, matchTime.trim()),
        groundLocation: groundAddress.trim(),
        geofenceLat: groundLat,
        geofenceLng: groundLng,
        oversPerInnings: oversPerInnings!,
        maxOversPerBowler: maxOversPerBowler!,
        powerplayOvers: powerplayOvers ?? null,
        homeAway,
      });
      // Push (not replace) so Back still works across the admin tab stack → root matches stack.
      // Carry tournamentId for a fallback when the history stack is empty.
      if (!tournamentId) {
        setSubmitError('Tournament not found.');
        return;
      }
      router.push(
        `/matches/${match.id}/verify-playing-xi?teamId=${teamAId}&teamName=${encodeURIComponent(
          tournament.teams.find((t) => t.id === teamAId)?.name ?? 'ACC',
        )}&backfillNext=opponent&tournamentId=${encodeURIComponent(tournamentId)}`,
      );
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setSubmitError(err.message);
        if (err.error.fields) {
          setFieldErrors((prev) => ({ ...prev, ...err.error.fields }));
        }
      } else {
        setSubmitError('Could not create the backfill match.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack(): void {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (tournamentId) {
      router.replace(
        tournamentDetailHref(user, tournamentId, TOURNAMENT_DETAIL_TAB.TournamentMatches),
      );
    }
  }

  if (!isAdmin) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title="Backfill past match" showBack onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-on-surface-variant">
            Only an Admin can backfill a past match.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title="Backfill past match" showBack onBack={handleBack} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !tournament) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title="Backfill past match" showBack onBack={handleBack} />
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
      <ScreenHeader title="Backfill past match" showBack onBack={handleBack} />
      <KeyboardAwareFormScrollView
        contentContainerClassName="gap-4 px-4 pt-2"
        extraBottomPadding={32}
        footer={
          <SafeAreaView edges={['bottom']} className="border-t border-outline-variant px-4 py-3">
            {submitError ? (
              <Text className="mb-2 font-sans text-sm text-error">{submitError}</Text>
            ) : null}
            <Button
              disabled={submitting}
              onPress={() => void handleSubmit()}
              className="h-14 w-full flex-row gap-2"
            >
              <Ionicons name="create-outline" size={20} color={colors.textInverse} />
              <Text className="font-sans-semibold text-base text-on-primary">
                {submitting ? 'Creating…' : 'Create & select Playing XI'}
              </Text>
            </Button>
          </SafeAreaView>
        }
      >
        <View>
          <Text className="font-sans-bold text-2xl text-on-surface">Backfill past match</Text>
          <Text className="mt-2 font-sans text-sm text-on-surface-variant">
            Schedule a past ACC fixture, pick the Playing XI, enter opponent names, then score
            ball-by-ball with the normal scoring screen. Polling is skipped.
          </Text>
        </View>

        <Select
          label="ACC team"
          placeholder="Select team"
          value={teamAId}
          options={teamOptions}
          onChange={(value) => {
            setTeamAId(value);
            clearField('teamAId');
          }}
          error={fieldErrors.teamAId}
        />

        <TextInput
          label="Opponent team name"
          value={opponentName}
          onChangeText={(text) => {
            setOpponentName(text);
            clearField('externalOpponentName');
          }}
          placeholder="e.g. Men in Greens"
          error={fieldErrors.externalOpponentName}
        />

        <DateField
          label="Match date"
          value={matchDate ?? ''}
          onChange={(value) => {
            setMatchDate(value || null);
            clearField('matchDate');
          }}
          minimumDate={spanMinimum}
          maximumDate={spanMaximum}
          enforceSignupAgeMax={false}
          error={fieldErrors.matchDate}
        />

        <TimeField
          label="Match time"
          value={matchTime}
          onChange={(value) => {
            setMatchTime(value);
            clearField('matchTime');
          }}
          error={fieldErrors.matchTime}
        />

        <TournamentLocationField
          label="Ground"
          address={groundAddress}
          latitude={groundLat}
          longitude={groundLng}
          onAddressChange={(address) => {
            setGroundAddress(address);
            clearField('groundLocation');
          }}
          onCoordinatesChange={(lat, lng) => {
            setGroundLat(lat);
            setGroundLng(lng);
            clearField('groundLocation');
          }}
          error={fieldErrors.groundLocation}
        />

        <Select
          label="Overs per innings"
          value={oversPerInnings != null ? String(oversPerInnings) : null}
          options={oversOptions}
          onChange={(value) => {
            const next = value ? Number(value) : null;
            setOversPerInnings(next);
            setMaxOversPerBowler(next != null ? Math.min(5, Math.floor(next / 5) || 1) : null);
            clearField('oversPerInnings');
          }}
          error={fieldErrors.oversPerInnings}
        />

        <Select
          label="Overs per bowler"
          value={maxOversPerBowler != null ? String(maxOversPerBowler) : null}
          options={bowlerOversOptions}
          onChange={(value) => {
            setMaxOversPerBowler(value ? Number(value) : null);
            clearField('maxOversPerBowler');
          }}
          error={fieldErrors.maxOversPerBowler}
        />

        <Select
          label="Powerplay overs"
          value={powerplayOvers != null ? String(powerplayOvers) : ''}
          options={powerplayOptions}
          onChange={(value) => {
            setPowerplayOvers(value ? Number(value) : null);
            clearField('powerplayOvers');
          }}
          error={fieldErrors.powerplayOvers}
        />

        <Select
          label="Home / Away"
          placeholder="Optional"
          value={homeAway}
          options={homeAwayOptions}
          onChange={(value) => setHomeAway((value as HomeAway | null) ?? null)}
        />
      </KeyboardAwareFormScrollView>
    </SafeAreaView>
  );
}
