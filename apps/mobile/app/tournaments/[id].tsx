import { Ionicons } from '@expo/vector-icons';
import {
  type TournamentDetail,
  type RegistrationDetail,
  canShowTournamentFeesTracker,
  canShowRegistrationVerificationQueue,
  BallType,
  TOURNAMENT_SCORER_COUNT,
  UserRole,
  formatTournamentFeeCad,
} from '@acc/types';
import { Redirect, useLocalSearchParams, usePathname, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

import { BallTypeIcon } from '../../src/components/ui/BallTypeIcon';
import { Button } from '../../src/components/ui/Button';
import {
  TournamentDetailInfoRow,
  TournamentDetailSectionCard,
} from '../../src/components/ui/TournamentDetailSectionCard';
import { ScreenHeader } from '../../src/components/ui/ScreenHeader';
import { Text } from '../../src/components/ui/Text';
import { TournamentPosterBanner } from '../../src/components/ui/TournamentPosterBanner';
import { StatusPill } from '../../src/components/ui/StatusPill';
import { TournamentVenueCardContent } from '../../src/components/ui/TournamentVenueCard';
import { FIELD_ORANGE } from '../../src/components/ui/fieldStyles';
import { ApiRequestError, getMyRegistration, getRegistrationVerificationQueue, getTournament } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import {
  formatRegistrationOpensLabel,
  formatTournamentCalendarDate,
  formatTournamentDateTimeLabel,
  formatTournamentLeatherSpanLabel,
  formatTournamentMatchDay,
  sortTournamentDates,
  tournamentStatusPill,
} from '../../src/lib/tournament-display';
import { TournamentGroupsTab } from '../../src/components/tournament/TournamentGroupsTab';
import {
  DETAIL_ACTION_GRID_BUTTON_CLASS,
  DETAIL_ACTION_GRID_LABEL_CLASS,
  TournamentDetailActionButtonGrid,
} from '../../src/components/tournament/TournamentDetailActionButtonGrid';
import { RegistrationStatusIndicator } from '../../src/components/tournament/RegistrationStatusIndicator';
import { TournamentLeaderboardTab } from '../../src/components/tournament/TournamentLeaderboardTab';
import { TournamentStatsTab } from '../../src/components/tournament/TournamentStatsTab';
import { TournamentMatchesTab } from '../../src/components/tournament/TournamentMatchesTab';
import { TournamentPointsTableTab } from '../../src/components/tournament/TournamentPointsTableTab';
import { TournamentTeamsTab } from '../../src/components/tournament/TournamentTeamsTab';
import {
  buildTournamentDetailTabs,
  getTournamentDetailTabLabel,
  parseTournamentDetailTab,
  TOURNAMENT_DETAIL_TAB,
  TOURNAMENT_DETAIL_TABS,
  type TournamentDetailTab,
} from '../../src/lib/tournament-detail-tabs';
import { resolveRegistrationCta } from '../../src/lib/tournament-registration-cta';
import {
  isRoleScopedTournamentPath,
  isRootTournamentDetailPath,
  resolveRoleTabBarRoot,
  roleTournamentsListHref,
  tournamentDetailHref,
} from '../../src/lib/tournament-detail-route';

function TournamentRegistrationFeeRows({
  tournament,
}: {
  tournament: TournamentDetail;
}): React.ReactElement | null {
  if (tournament.ballType === BallType.Leather) {
    const fullLabel = formatTournamentFeeCad(tournament.feeFullTime);
    const partLabel = formatTournamentFeeCad(tournament.feePartTime);
    if (!fullLabel && !partLabel) {
      return null;
    }
    return (
      <>
        {fullLabel ? (
          <TournamentDetailInfoRow label="Full-time Player Fees" value={fullLabel} />
        ) : null}
        {partLabel ? (
          <TournamentDetailInfoRow label="Part-time Player Fees" value={partLabel} />
        ) : null}
      </>
    );
  }

  const feeLabel = formatTournamentFeeCad(tournament.feeFullTime);
  return feeLabel ? <TournamentDetailInfoRow label="Tournament Fees" value={feeLabel} /> : null;
}

export default function TournamentDetailScreen(): React.ReactElement {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useAuth();

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
        status === 'authenticated'
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
        : ([
            TOURNAMENT_DETAIL_TAB.Details,
            TOURNAMENT_DETAIL_TAB.TournamentMatches,
            TOURNAMENT_DETAIL_TAB.Teams,
            TOURNAMENT_DETAIL_TAB.PointsTable,
            TOURNAMENT_DETAIL_TAB.Leaderboard,
          ] as TournamentDetailTab[]),
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
    if (
      (tab === TOURNAMENT_DETAIL_TAB.TournamentMatches ||
        tab === TOURNAMENT_DETAIL_TAB.Teams ||
        tab === TOURNAMENT_DETAIL_TAB.Groups) &&
      id &&
      tournament
    ) {
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
      leatherRegistrationEligible: tournament.canRegisterForLeatherTournament,
      formatOpensLabel: formatRegistrationOpensLabel,
    });
  }, [myRegistration?.status, registrationChecked, status, tournament, user?.role]);

  const pairedDetailActions = useMemo(() => {
    if (!tournament) {
      return [];
    }

    const gridButtonClass = DETAIL_ACTION_GRID_BUTTON_CLASS;
    const gridLabelClass = DETAIL_ACTION_GRID_LABEL_CLASS;
    const items: ReactElement[] = [];

    if (tournament.canUploadSkillVideo ?? tournament.canUploadPlayerVideo) {
      items.push(
        <Button
          key="upload-video"
          variant="amber"
          className={gridButtonClass}
          textClassName={gridLabelClass}
          label={
            (tournament.hasSkillVideo ?? tournament.hasPlayerVideo)
              ? 'Replace Video'
              : 'Upload Video'
          }
          onPress={() => router.push(`/tournaments/${tournament.id}/upload-video`)}
        />,
      );
    }

    if (showVerifyPlayers && verifyQueueChecked && verifyActionCount > 0) {
      items.push(
        <Button
          key="verify-players"
          variant="amber"
          className={gridButtonClass}
          textClassName={gridLabelClass}
          label={`Verify Players (${verifyActionCount})`}
          onPress={() => router.push(`/registrations/${tournament.id}/queue`)}
        />,
      );
    }

    if (showFeesTracker) {
      items.push(
        <Button
          key="fees-tracker"
          className={`${gridButtonClass} bg-secondary-container`}
          onPress={() => router.push(`/tournaments/${tournament.id}/fees`)}
        >
          <View className="flex-row items-center justify-center gap-1.5">
            <Ionicons name="cash-outline" size={18} color={colors.secondary} />
            <Text
              className={`font-sans-semibold text-on-secondary-container ${gridLabelClass}`}
            >
              Fees Tracker
            </Text>
          </View>
        </Button>,
      );
    }

    if (tournament.canManageLeatherInvites) {
      items.push(
        <Button
          key="leather-invite"
          variant="amber"
          className={gridButtonClass}
          textClassName={gridLabelClass}
          label="New Invite"
          onPress={() => router.push(`/tournaments/${tournament.id}/leather-invites`)}
        />,
      );
    }

    if (tournament.canManageTournamentScorers) {
      items.push(
        <View key="assign-scorers" className="gap-1">
          <Button
            variant="amber"
            className={gridButtonClass}
            textClassName={gridLabelClass}
            label={
              tournament.tournamentScorerCount > 0 ? 'Manage Scorers' : 'Assign Scorers'
            }
            onPress={() => router.push(`/tournaments/${tournament.id}/assign-scorers`)}
          />
          {tournament.tournamentScorerCount > 0 ? (
            <Text className="text-center font-sans text-xs text-on-surface-variant">
              {tournament.tournamentScorerCount} of {TOURNAMENT_SCORER_COUNT} scorers assigned
            </Text>
          ) : null}
        </View>,
      );
    }

    if (tournament.canViewRegisteredPlayersList) {
      items.push(
        <Button
          key="registered-players"
          className={`${gridButtonClass} bg-secondary-container`}
          onPress={() => router.push(`/tournaments/${tournament.id}/registered-players`)}
        >
          <Text
            className={`font-sans-semibold text-on-secondary-container ${gridLabelClass}`}
          >
            {tournament.ballType === BallType.Leather
              ? 'View Registered Players'
              : 'Registered Players List'}
          </Text>
        </Button>,
      );
    }

    if (tournament.canViewFavouritePlayers) {
      items.push(
        <Button
          key="favourite-players"
          variant="outline"
          className={`${gridButtonClass} border-primary`}
          textClassName={`font-sans-semibold text-primary ${gridLabelClass}`}
          label="Favourite Players"
          onPress={() => router.push(`/tournaments/${tournament.id}/favourite-players`)}
        />,
      );
    }

    return items;
  }, [
    router,
    showFeesTracker,
    showVerifyPlayers,
    tournament,
    verifyActionCount,
    verifyQueueChecked,
  ]);

  const showRoleTabBar = isRoleScopedTournamentPath(pathname);

  const handleBack = useCallback(() => {
    if (isRoleScopedTournamentPath(pathname)) {
      const listHref = roleTournamentsListHref(user);
      if (listHref) {
        router.replace(listHref);
        return;
      }
    }
    router.back();
  }, [pathname, router, user]);

  if (id && user && isRootTournamentDetailPath(pathname) && resolveRoleTabBarRoot(user)) {
    const rawTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
    const tab = rawTab ? parseTournamentDetailTab(rawTab, TOURNAMENT_DETAIL_TABS) : undefined;
    return <Redirect href={tournamentDetailHref(user, id, tab)} />;
  }

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
        <ScreenHeader onBack={handleBack} />
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
        <ScreenHeader onBack={handleBack} />

        <ScrollView
          contentContainerClassName={showRoleTabBar ? 'pb-36' : 'pb-28'}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-4">
            <TournamentPosterBanner
              posterUrl={tournament.posterUrl}
              name={tournament.name}
            />
          </View>

          <View className="flex-row items-start justify-between gap-3 px-4 pt-4">
            <View className="min-w-0 flex-1 flex-row items-start gap-2">
              <Text
                className="shrink font-sans-bold text-2xl text-on-surface"
                numberOfLines={3}
              >
                {tournament.name}
              </Text>
              {tournament.canEdit ? (
                <Pressable
                  onPress={() => router.push(`/tournaments/${tournament.id}/edit`)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Edit tournament"
                  className="mt-1 shrink-0 active:opacity-70"
                >
                  <Ionicons name="pencil" size={20} color={FIELD_ORANGE} />
                </Pressable>
              ) : null}
            </View>
            <View className="shrink-0 items-end gap-2">
              <BallTypeIcon ballType={tournament.ballType} size={28} />
              <StatusPill {...tournamentStatusPill(tournament)} />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-5 border-b border-outline-variant"
            contentContainerClassName="px-4"
          >
            {visibleTabs.map((tabKey) => (
              <Pressable
                key={tabKey}
                onPress={() => selectTab(tabKey)}
                className={`mr-5 pb-3 -mb-px ${tab === tabKey ? 'border-b-2 border-primary' : ''}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === tabKey }}
              >
                <Text
                  className={`font-sans-semibold text-sm ${
                    tab === tabKey ? 'text-primary' : 'text-on-surface-variant'
                  }`}
                >
                  {getTournamentDetailTabLabel(tabKey)}
                </Text>
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
                    <TournamentRegistrationFeeRows tournament={tournament} />
                  </TournamentDetailSectionCard>
                ) : (
                  <TournamentDetailSectionCard
                    title="Registration Details"
                    icon={<Ionicons name="clipboard-outline" size={20} color={FIELD_ORANGE} />}
                  >
                    <Text className="font-sans text-base text-on-surface-variant">
                      No registration window set
                    </Text>
                    <TournamentRegistrationFeeRows tournament={tournament} />
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
                    <Text className="font-sans text-sm text-on-surface-variant">
                      {tournament.ballType === BallType.Leather ? 'Tournament Span' : 'Match Days'}
                    </Text>
                    {tournament.ballType === BallType.Leather ? (
                      <Text className="font-sans-semibold text-base text-on-surface">
                        {formatTournamentLeatherSpanLabel(tournament.startAt, tournament.endAt)}
                      </Text>
                    ) : tournament.dates.length > 0 ? (
                      <View className="flex-row flex-wrap gap-2">
                        {sortTournamentDates(tournament.dates).map((date) => (
                          <View
                            key={date}
                            className="rounded-control border border-primary/20 bg-primary-50 px-3 py-1.5"
                          >
                            <Text className="font-sans-semibold text-sm text-secondary">
                              {formatTournamentMatchDay(date)}
                            </Text>
                          </View>
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

                <TournamentDetailActionButtonGrid items={pairedDetailActions} />
              </>
            ) : null}

            {tab === TOURNAMENT_DETAIL_TAB.TournamentMatches && id ? (
              <TournamentMatchesTab
                tournamentId={id}
                active={tab === TOURNAMENT_DETAIL_TAB.TournamentMatches}
                teamCount={tournament.teamCount}
                ballType={tournament.ballType}
                teams={tournament.teams}
                groups={tournament.groups}
                tournamentType={tournament.type}
                canScheduleMatches={tournament.canScheduleMatches}
                matchSchedulingFormat={tournament.matchSchedulingFormat}
                hasKnockoutBracket={tournament.hasKnockoutBracket}
                tournamentName={tournament.name}
                viewerRegistrationStatus={
                  registrationChecked ? (myRegistration?.status ?? null) : null
                }
              />
            ) : null}
            {tab === 'Teams' && id ? (
              <TournamentTeamsTab
                tournamentId={id}
                numberOfTeams={tournament.numberOfTeams}
                myTeamId={tournament.myTeamId}
                onTeamsChanged={() => void load({ silent: true })}
                teams={tournament.teams.map((team) => ({
                  id: team.id,
                  tournamentId: tournament.id,
                  name: team.name,
                  logoUrl: team.logoUrl,
                  memberCount: team.memberCount,
                  groupId: team.groupId,
                  groupName: team.groupName,
                  hasMatches: team.hasMatches,
                }))}
              />
            ) : null}
            {tab === 'Groups' && id && tournament ? (
              <TournamentGroupsTab
                tournamentId={id}
                groups={tournament.groups}
                allTeams={tournament.teams.map((team) => ({
                  id: team.id,
                  tournamentId: id,
                  name: team.name,
                  logoUrl: team.logoUrl,
                  memberCount: team.memberCount,
                  groupId: team.groupId,
                  groupName: team.groupName,
                  hasMatches: team.hasMatches,
                }))}
                onGroupsChanged={() => load({ silent: true })}
              />
            ) : null}
            {tab === 'Points Table' && id && tournament ? (
              <TournamentPointsTableTab
                tournamentId={id}
                active={tab === 'Points Table'}
                matchSchedulingFormat={tournament.matchSchedulingFormat}
                groupCount={tournament.groupCount}
              />
            ) : null}
            {tab === TOURNAMENT_DETAIL_TAB.Stats && id ? (
              <TournamentStatsTab tournamentId={id} active={tab === TOURNAMENT_DETAIL_TAB.Stats} />
            ) : null}
            {tab === 'Leaderboard' && id ? (
              <TournamentLeaderboardTab tournamentId={id} active={tab === 'Leaderboard'} />
            ) : null}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
