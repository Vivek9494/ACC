import {
  formatMatchResultNote,
  replaceGenericHomeAwayInResultNote,
  resolveMatchWinnerDisplayName,
  formatAutoConfirmCountdown,
  type MatchDetail,
  ScorecardConfirmSide,
  type ScorecardConfirmEligibilityView,
  type ScorecardConfirmationView,
  type ScorecardResponse,
} from '@acc/types';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { Button } from '../../../src/components/ui/Button';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabbedInningsScorecard } from '../../../src/components/TabbedInningsScorecard';
import { ManOfMatchCard } from '../../../src/components/ManOfMatchCard';
import { MatchTossSummaryLine } from '../../../src/components/match/MatchTossSummaryLine';
import { MatchResultBanner } from '../../../src/components/scoring/MatchResultBanner';
import {
  ApiRequestError,
  confirmScorecard,
  getMatch,
  getScorecard,
  getScorecardConfirmEligibility,
  getScorecardConfirmation,
  scorecardPdfUrl,
} from '../../../src/lib/api';

import { useScorecardResolvers } from '../../../src/hooks/useMatchResolvers';
import { useAuth } from '../../../src/lib/auth-context';
import {
  defaultInningsTabIndex,
} from '../../../src/lib/scorecardInningsTabs';

/**
 * Match result & scorecard confirmation screen (spec §13, §16). Mirrors the
 * `full_scorecard_detailed_view_with_stats` mockup: the full derived scorecard,
 * a Captain/VC confirmation banner with the 5-hour auto-confirm countdown,
 * awarded Man of the Match on the winning-team tab, and a signed-in-only PDF export.
 * Select/change MoM lives on Match Details only.
 */
export default function ScorecardResultScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [card, setCard] = useState<ScorecardResponse | null>(null);
  const [confirmation, setConfirmation] = useState<ScorecardConfirmationView | null>(null);
  const [confirmEligibility, setConfirmEligibility] =
    useState<ScorecardConfirmEligibilityView | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inningsIndex, setInningsIndex] = useState(0);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const [m, c, conf, confirmGate] = await Promise.all([
        getMatch(matchId).catch(() => null),
        getScorecard(matchId),
        getScorecardConfirmation(matchId),
        getScorecardConfirmEligibility(matchId).catch(() => ({
          awaitingConfirmation: false,
          canConfirm: false,
          confirmSide: null,
          scorecardFinalized: false,
          homeTeam: { teamId: null, confirmed: false, confirmedByUserId: null, confirmedAt: null },
          awayTeam: { teamId: null, confirmed: false, confirmedByUserId: null, confirmedAt: null },
          adminConfirmed: false,
        })),
      ]);
      setMatch(m);
      setCard(c);
      setConfirmation(conf);
      setConfirmEligibility(confirmGate);
      setInningsIndex(defaultInningsTabIndex(c));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load the scorecard.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const { nameOf, teamNameOf, battingTeamLabel } = useScorecardResolvers(card, match);

  const isMatchLive = match?.state === 'LIVE' || match?.state === 'RAIN_INTERRUPTED';

  const momUserId = match?.manOfTheMatchUserId ?? confirmation?.manOfTheMatchUserId ?? null;

  const winningTeamName = useMemo(() => {
    if (!match || !card) return 'Winning team';
    const fromSquad = card.result.winningTeamId
      ? match.squads.find((s) => s.teamId === card.result.winningTeamId)?.teamName
      : undefined;
    return (
      fromSquad ??
      resolveMatchWinnerDisplayName(
        {
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeTeamName: match.homeTeamName,
          awayTeamName: match.awayTeamName,
          externalOpponentName: match.externalOpponentName,
        },
        card.result,
        card.innings,
      )
    );
  }, [card, match]);

  const resultLine = useMemo(() => {
    if (!match || !card || isMatchLive) return null;
    if (
      match.state === 'CANCELLED' ||
      match.state === 'NO_RESULT' ||
      match.isNoResult ||
      card.result.isNoResult ||
      card.result.isTie ||
      card.result.superOverRequired ||
      !card.result.decided
    ) {
      return null;
    }
    const rebuilt = formatMatchResultNote(winningTeamName, card.result);
    if (rebuilt) {
      return rebuilt;
    }
    if (match.resultNote) {
      return replaceGenericHomeAwayInResultNote(
        match.resultNote,
        match.homeTeamName ?? 'Home',
        match.awayTeamName ?? match.externalOpponentName ?? 'Away',
      );
    }
    return null;
  }, [card, isMatchLive, match, winningTeamName]);

  const showResultBanner = Boolean(resultLine);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  function doConfirm(): void {
    const isAdminOverride = confirmEligibility?.confirmSide === ScorecardConfirmSide.Admin;
    Alert.alert(
      'Confirm scorecard?',
      isAdminOverride
        ? 'This will finalize the scorecard for both teams and lock it immediately.'
        : 'Confirm the scorecard for your team. Both teams must confirm (or an Admin/Club Manager may finalize outright) before the scorecard is locked.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: () => {
            setWorking(true);
            void (async () => {
              try {
                const conf = await confirmScorecard(matchId, {
                  expectedVersion: card?.version,
                });
                setConfirmation(conf);
                await load();
              } catch (err) {
                setError(err instanceof ApiRequestError ? err.message : 'Confirmation failed.');
              } finally {
                setWorking(false);
              }
            })();
          },
        },
      ],
    );
  }

  const showConfirmCard =
    Boolean(confirmEligibility?.awaitingConfirmation && confirmEligibility.canConfirm);

  const homeTeamLabel = match?.homeTeamName ?? 'Home team';
  const awayTeamLabel = match?.awayTeamName ?? 'Away team';
  const showTeamProgress =
    showConfirmCard &&
    confirmEligibility?.confirmSide !== ScorecardConfirmSide.Admin &&
    Boolean(confirmEligibility?.homeTeam && confirmEligibility?.awayTeam);

  function teamProgressLine(
    label: string,
    confirmed: boolean,
  ): string {
    return `${label}: ${confirmed ? 'confirmed ✓' : 'pending'}`;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader
        title={
          match
            ? `${match.homeTeamName ?? 'TBD'} vs ${match.awayTeamName ?? match.externalOpponentName ?? 'TBD'}`
            : 'Scorecard'
        }
        onBack={() => router.back()}
      />
      <ScrollView contentContainerClassName="px-6 py-6 gap-4">
        {error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : null}

        {/* §13.1: confirmation status / action */}
        {showConfirmCard ? (
          <View className="gap-2 rounded-xl border border-primary bg-primary-container/40 p-4">
            <Text className="font-sans-bold text-lg text-primary">Confirm scorecard</Text>
            <Text className="font-sans text-sm text-on-surface-variant">
              {confirmEligibility?.confirmSide === ScorecardConfirmSide.Admin
                ? 'Finalize the scorecard for both teams. Once locked, captains can no longer edit it.'
                : 'Confirm for your team within 5 hours. Both teams must confirm before the scorecard locks.'}
              {confirmation?.autoConfirmDueAt
                ? ` Otherwise the system auto-confirms in ${formatAutoConfirmCountdown(confirmation.autoConfirmDueAt)}.`
                : ''}
            </Text>
            {showTeamProgress ? (
              <View className="gap-1">
                <Text className="font-sans text-sm text-on-surface">
                  {teamProgressLine(homeTeamLabel, confirmEligibility!.homeTeam.confirmed)}
                </Text>
                <Text className="font-sans text-sm text-on-surface">
                  {teamProgressLine(awayTeamLabel, confirmEligibility!.awayTeam.confirmed)}
                </Text>
              </View>
            ) : null}
            <Button
              disabled={working}
              onPress={doConfirm}
              variant="secondary"
              className="h-12"
              label={
                confirmEligibility?.confirmSide === ScorecardConfirmSide.Admin
                  ? 'Finalize scorecard'
                  : 'Confirm for my team'
              }
            />
          </View>
        ) : null}

        <MatchTossSummaryLine match={match} />

        {showResultBanner && resultLine ? (
          <MatchResultBanner resultLine={resultLine} />
        ) : null}

        {card && card.innings.length === 0 ? (
          <View className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <Text className="font-sans text-sm text-on-surface-variant">
              No scoring was recorded for this match.
            </Text>
          </View>
        ) : null}

        {/* Full scorecard (§28) */}
        {card && card.innings.length > 0 ? (
          <TabbedInningsScorecard
            card={card}
            match={match}
            nameOf={nameOf}
            teamNameOf={teamNameOf}
            battingTeamLabel={battingTeamLabel}
            inningsIndex={inningsIndex}
            onInningsIndexChange={setInningsIndex}
            isMatchLive={isMatchLive}
            matchOversPerInnings={match?.oversPerInnings ?? null}
            user={user}
            winningTeamId={card.result.winningTeamId ?? match?.winningTeamId ?? null}
            manOfMatchSlot={
              match && momUserId ? (
                <ManOfMatchCard
                  match={match}
                  card={card}
                  momUserId={momUserId}
                  nameOf={nameOf}
                />
              ) : null
            }
          />
        ) : null}

        {/* §16: PDF export — signed-in users only (hidden for Guest) */}
        {user ? (
          <Button
            onPress={() => void Linking.openURL(scorecardPdfUrl(matchId))}
            variant="outline"
            className="h-12 border-primary"
            textClassName="text-primary"
            label="Export scorecard PDF"
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
