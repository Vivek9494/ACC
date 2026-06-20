import { Ionicons } from '@expo/vector-icons';
import { type TournamentDetail, UserRole, type RegistrationDetail, canShowTournamentFeesTracker, canShowRegistrationVerificationQueue } from '@acc/types';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

import { BallTypeIcon } from '../../src/components/ui/BallTypeIcon';
import { BottomTabBar } from '../../src/components/ui/BottomTabBar';
import { Button } from '../../src/components/ui/Button';
import {
  TournamentDetailInfoRow,
  TournamentDetailSectionCard,
} from '../../src/components/ui/TournamentDetailSectionCard';
import { ProfileMenu } from '../../src/components/ui/ProfileMenu';
import { Text } from '../../src/components/ui/Text';
import { TournamentPosterBanner } from '../../src/components/ui/TournamentPosterBanner';
import { TournamentVenueCardContent } from '../../src/components/ui/TournamentVenueCard';
import { FIELD_ORANGE } from '../../src/components/ui/fieldStyles';
import { ApiRequestError, getMyRegistration, getRegistrationVerificationQueue, getTournament } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import { useRoleTabConfig } from '../../src/lib/role-tab-config';
import {
  formatRegistrationOpensLabel,
  formatTournamentCalendarDate,
  formatTournamentDateTimeLabel,
  formatTournamentMatchDay,
  sortTournamentDates,
} from '../../src/lib/tournament-display';
import { TournamentGroupsTab } from '../../src/components/tournament/TournamentGroupsTab';
import { RegistrationStatusIndicator } from '../../src/components/tournament/RegistrationStatusIndicator';
import { TournamentLeaderboardTab } from '../../src/components/tournament/TournamentLeaderboardTab';
import { TournamentMatchesTab } from '../../src/components/tournament/TournamentMatchesTab';
import { TournamentPointsTableTab } from '../../src/components/tournament/TournamentPointsTableTab';
import { TournamentTeamsTab } from '../../src/components/tournament/TournamentTeamsTab';
import {
  buildTournamentDetailTabs,
  parseTournamentDetailTab,
  type TournamentDetailTab,
} from '../../src/lib/tournament-detail-tabs';
import { resolveRegistrationCta } from '../../src/lib/tournament-registration-cta';

export default function TournamentDetailScreen(): React.ReactElement {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { user, status } = useAuth();
  const tabConfig = useRoleTabConfig('index');

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TournamentDetailTab>('Details');
  const [myRegistration, setMyRegistration] = useState<RegistrationDetail | null>(null);
  const [registrationChecked, setRegistrationChecked] = useState(false);
  const [verifyActionCount, setVerifyActionCount] = useState(0);
  const [verifyQueueChecked, setVerifyQueueChecked] = useState(false);

  const showVerifyPlayers =
    status === 'authenticated' &&
    tournament
      ? canShowRegistrationVerificationQueue(user, {
          ballType: tournament.ballType,
          hasRegistrationWindow: tournament.hasRegistrationWindow,
        })
      : false;
  const showFeesTracker =
    status === 'authenticated' && tournament ? canShowTournamentFeesTracker(user, tournament) : false;

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!id) {
      setError('Tournament not found.');
      setLoading(false);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const detail = await getTournament(id);
      setTournament(detail);

      const playerRegistrationPromise =
        status === 'authenticated' && user?.role === UserRole.Player
          ? getMyRegistration(id).catch(() => null)
          : Promise.resolve(null);

      const verificationQueuePromise =
        status === 'authenticated' &&
        canShowRegistrationVerificationQueue(user, {
          ballType: detail.ballType,
          hasRegistrationWindow: detail.hasRegistrationWindow,
        })
          ? getRegistrationVerificationQueue(id).catch(() => null)
          : Promise.resolve(null);

      const [mine, verificationQueue] = await Promise.all([
        playerRegistrationPromise,
        verificationQueuePromise,
      ]);

      setMyRegistration(mine);
      setVerifyActionCount(verificationQueue?.actionCount ?? 0);
    } catch (err) {
      setTournament(null);
      setMyRegistration(null);
      setVerifyActionCount(0);
      setError(err instanceof ApiRequestError ? err.message : 'Could not load tournament.');
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
      setRegistrationChecked(true);
      setVerifyQueueChecked(true);
    }
  }, [id, status, user]);

  const visibleTabs = useMemo(
    () =>
      tournament
        ? buildTournamentDetailTabs(tournament)
        : (['Details', 'Matches', 'Teams', 'Points Table', 'Leaderboard'] as TournamentDetailTab[]),
    [tournament],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const raw = Array.isArray(tabParam) ? tabParam[0] : tabParam;
    if (raw) {
      setTab(parseTournamentDetailTab(raw, visibleTabs));
    }
  }, [tabParam, visibleTabs]);

  useEffect(() => {
    if (tournament && !visibleTabs.includes(tab)) {
      setTab('Details');
    }
  }, [tournament, tab, visibleTabs]);

  useFocusEffect(
    useCallback(() => {
      if (id) {
        void load(tournament ? { silent: true } : undefined);
      }
    }, [id, load, tournament]),
  );

  useEffect(() => {
    if ((tab === 'Matches' || tab === 'Teams' || tab === 'Groups') && id && tournament) {
      void load({ silent: true });
    }
  }, [tab, id, load, tournament]);

  function selectTab(nextTab: TournamentDetailTab): void {
    setTab(nextTab);
    router.setParams({ tab: nextTab });
  }

  const registrationCta = useMemo(() => {
    if (!tournament || !registrationChecked) {
      return { kind: 'hidden' as const };
    }
    return resolveRegistrationCta({
      tournament,
      isAuthenticated: status === 'authenticated',
      userRole: user?.role,
      registrationStatus: myRegistration?.status ?? null,
      formatOpensLabel: formatRegistrationOpensLabel,
    });
  }, [myRegistration?.status, registrationChecked, status, tournament, user?.role]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  if (error || !tournament) {
    return (
      <SafeAreaView className="flex-1 bg-background">
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
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center font-sans text-base text-on-surface-variant">
            {error ?? 'Tournament not found.'}
          </Text>
          <Button onPress={() => void load()} label="Retry" className="mt-4 h-12 px-8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1">
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

        <ScrollView
          contentContainerClassName="pb-28"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-4">
            <TournamentPosterBanner
              posterUrl={tournament.posterUrl}
              name={tournament.name}
            />
          </View>

          <View className="flex-row items-start justify-between gap-3 px-4 pt-4">
            <Text className="flex-1 font-sans-bold text-2xl text-on-surface">
              {tournament.name}
            </Text>
            <BallTypeIcon ballType={tournament.ballType} size={28} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-5 border-b border-outline-variant"
            contentContainerClassName="px-4"
          >
            {visibleTabs.map((item) => (
              <Pressable
                key={item}
                onPress={() => selectTab(item)}
                className="mr-5 pb-3"
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item }}
              >
                <Text
                  className={`font-sans-semibold text-sm ${
                    tab === item ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  {item}
                </Text>
                {tab === item ? (
                  <View className="mt-2 h-0.5 rounded-full bg-primary" />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          <View className="gap-4 px-4 pt-5">
            {tab === 'Details' ? (
              <>
                {tournament.hasRegistrationWindow ? (
                  <TournamentDetailSectionCard
                    title="Registration Details"
                    icon={<Ionicons name="clipboard-outline" size={20} color={FIELD_ORANGE} />}
                  >
                    <TournamentDetailInfoRow
                      label="Open Date & Time"
                      value={formatTournamentDateTimeLabel(tournament.registrationOpenAt)}
                    />
                    <TournamentDetailInfoRow
                      label="Close Date & Time"
                      value={formatTournamentDateTimeLabel(tournament.registrationCloseAt)}
                    />
                  </TournamentDetailSectionCard>
                ) : (
                  <TournamentDetailSectionCard
                    title="Registration Details"
                    icon={<Ionicons name="clipboard-outline" size={20} color={FIELD_ORANGE} />}
                  >
                    <Text className="font-sans text-base text-on-surface-variant">
                      No registration window set
                    </Text>
                  </TournamentDetailSectionCard>
                )}

                <TournamentDetailSectionCard
                  title="Tournament Schedule"
                  icon={<Ionicons name="calendar-outline" size={20} color={FIELD_ORANGE} />}
                >
                  {tournament.auctionAt ? (
                    <TournamentDetailInfoRow
                      label="Auction Date"
                      value={formatTournamentCalendarDate(tournament.auctionAt)}
                    />
                  ) : null}
                  <View className="gap-1">
                    <Text className="font-sans text-sm text-on-surface-variant">Match Days</Text>
                    {tournament.dates.length > 0 ? (
                      <View className="gap-2">
                        {sortTournamentDates(tournament.dates).map((date) => (
                          <Text
                            key={date}
                            className="font-sans-semibold text-base text-on-surface"
                          >
                            {formatTournamentMatchDay(date)}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <Text className="font-sans-semibold text-base text-on-surface">—</Text>
                    )}
                  </View>
                </TournamentDetailSectionCard>

                <TournamentDetailSectionCard
                  title="Venue"
                  icon={<Ionicons name="location-outline" size={20} color={FIELD_ORANGE} />}
                >
                  <TournamentVenueCardContent tournament={tournament} />
                </TournamentDetailSectionCard>

                {registrationCta.kind === 'active' ? (
                  <Button
                    onPress={() => router.push(`/registrations/${tournament.id}/register`)}
                    className="mt-2 h-14 w-full"
                    label={registrationCta.label}
                  />
                ) : null}
                {registrationCta.kind === 'status' ? (
                  <RegistrationStatusIndicator
                    className="mt-2"
                    label={registrationCta.label}
                    variant={registrationCta.variant}
                  />
                ) : null}
                {registrationCta.kind === 'disabled' ? (
                  <View className="mt-2 gap-1">
                    <Button
                      disabled
                      className="h-14 w-full opacity-60"
                      label={registrationCta.label}
                    />
                    <Text className="text-center font-sans text-sm text-on-surface-variant">
                      {registrationCta.reason}
                    </Text>
                  </View>
                ) : null}

                {(tournament.canUploadSkillVideo ?? tournament.canUploadPlayerVideo) ? (
                  <Button
                    variant="amber"
                    className="mt-4 h-14 w-full"
                    label={
                      (tournament.hasSkillVideo ?? tournament.hasPlayerVideo)
                        ? 'Replace Video'
                        : 'Upload Video'
                    }
                    onPress={() => router.push(`/tournaments/${tournament.id}/upload-video`)}
                  />
                ) : null}

                {showVerifyPlayers && verifyQueueChecked && verifyActionCount > 0 ? (
                  <Button
                    variant="amber"
                    className="mt-4 h-14 w-full"
                    label={`Verify Players (${verifyActionCount})`}
                    onPress={() => router.push(`/registrations/${tournament.id}/queue`)}
                  />
                ) : null}

                {showFeesTracker ? (
                  <Button
                    className="mt-4 h-14 w-full flex-row gap-2 bg-secondary-container"
                    textClassName="font-sans-semibold text-on-secondary-container"
                    onPress={() => router.push(`/tournaments/${tournament.id}/fees`)}
                  >
                    <Ionicons name="cash-outline" size={22} color={colors.secondary} />
                    <Text className="font-sans-semibold text-base text-on-secondary-container">
                      ACC Fees Tracker
                    </Text>
                  </Button>
                ) : null}

                {tournament.canViewRegisteredPlayersList ? (
                  <Button
                    variant="amber"
                    className="mt-4 h-14 w-full bg-secondary-container"
                    textClassName="font-sans-semibold text-on-secondary-container"
                    label="Registered Players List"
                    onPress={() => router.push(`/tournaments/${tournament.id}/registered-players`)}
                  />
                ) : null}

                {tournament.canViewFavouritePlayers ? (
                  <Button
                    variant="outline"
                    className="mt-4 h-14 w-full border-primary"
                    textClassName="font-sans-semibold text-primary"
                    label="Favourite Players"
                    onPress={() => router.push(`/tournaments/${tournament.id}/favourite-players`)}
                  />
                ) : null}
              </>
            ) : null}

            {tab === 'Matches' && id ? (
              <TournamentMatchesTab
                tournamentId={id}
                active={tab === 'Matches'}
                teamCount={tournament.teamCount}
              />
            ) : null}
            {tab === 'Teams' && id ? (
              <TournamentTeamsTab
                tournamentId={id}
                numberOfTeams={tournament.numberOfTeams}
                myTeamId={tournament.myTeamId}
                teams={tournament.teams.map((team) => ({
                  id: team.id,
                  tournamentId: tournament.id,
                  name: team.name,
                  logoUrl: team.logoUrl,
                  memberCount: team.memberCount,
                  groupId: team.groupId,
                  groupName: team.groupName,
                }))}
              />
            ) : null}
            {tab === 'Groups' && id ? (
              <TournamentGroupsTab tournamentId={id} groups={tournament.groups} />
            ) : null}
            {tab === 'Points Table' && id && tournament ? (
              <TournamentPointsTableTab
                tournamentId={id}
                active={tab === 'Points Table'}
                matchSchedulingFormat={tournament.matchSchedulingFormat}
                groupCount={tournament.groupCount}
              />
            ) : null}
            {tab === 'Leaderboard' && id ? (
              <TournamentLeaderboardTab tournamentId={id} active={tab === 'Leaderboard'} />
            ) : null}
          </View>
        </ScrollView>
      </View>

      <BottomTabBar
        tabs={tabConfig.tabs}
        activeKey={tabConfig.activeKey}
        onTabPress={tabConfig.onTabPress}
      />
    </SafeAreaView>
  );
}
