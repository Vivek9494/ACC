import {
  formatMatchResultNote,
  type ManOfMatchEligibilityView,
  type MatchDetail,
  type ScorecardConfirmationView,
  type ScorecardResponse,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { Button } from '../../../src/components/ui/Button';
import { Text } from '../../../src/components/ui/Text';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabbedInningsScorecard } from '../../../src/components/TabbedInningsScorecard';
import { ManOfMatchCard } from '../../../src/components/ManOfMatchCard';
import { ManOfMatchDialog } from '../../../src/components/scoring/ManOfMatchDialog';
import {
  ApiRequestError,
  confirmScorecard,
  getManOfMatchEligibility,
  getMatch,
  getScorecard,
  getScorecardConfirmation,
  scorecardPdfUrl,
  selectManOfMatch,
} from '../../../src/lib/api';
import {
  buildManOfMatchCandidates,
  shouldOfferManOfMatch,
} from '../../../src/lib/match-completion';

import { useScorecardResolvers } from '../../../src/hooks/useMatchResolvers';
import {
  defaultInningsTabIndex,
} from '../../../src/lib/scorecardInningsTabs';

/** Humanises the remaining time to the auto-confirm deadline (§13.1). */
function untilLabel(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Match result & scorecard confirmation screen (spec §13, §16). Mirrors the
 * `full_scorecard_detailed_view_with_stats` mockup: the full derived scorecard,
 * a Captain/VC confirmation banner with the 5-hour auto-confirm countdown, the
 * Man of the Match picker, and a guest-accessible PDF export.
 */
export default function ScorecardResultScreen(): React.ReactElement {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [card, setCard] = useState<ScorecardResponse | null>(null);
  const [confirmation, setConfirmation] = useState<ScorecardConfirmationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [momEligibility, setMomEligibility] = useState<ManOfMatchEligibilityView | null>(null);
  const [showManOfMatch, setShowManOfMatch] = useState(false);
  const [inningsIndex, setInningsIndex] = useState(0);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const [m, c, conf, eligibility] = await Promise.all([
        getMatch(matchId),
        getScorecard(matchId),
        getScorecardConfirmation(matchId),
        getManOfMatchEligibility(matchId).catch(() => ({
          offered: false,
          canSelect: false,
          required: false,
          dueAt: null,
          overdue: false,
        })),
      ]);
      setMatch(m);
      setCard(c);
      setConfirmation(conf);
      setMomEligibility(eligibility);
      setInningsIndex(defaultInningsTabIndex(c));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not load the scorecard.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const { nameOf, teamNameOf, battingTeamLabel } = useScorecardResolvers(card, match);

  const isMatchLive = match?.state === 'LIVE' || match?.state === 'RAIN_INTERRUPTED';

  const momUserId = match?.manOfTheMatchUserId ?? confirmation?.manOfTheMatchUserId ?? null;

  const winningTeamName = useMemo(() => {
    const winnerId = card?.result.winningTeamId;
    if (!winnerId || !match) return 'Winning team';
    return (
      match.squads.find((s) => s.teamId === winnerId)?.teamName ??
      (winnerId === match.homeTeamId ? match.homeTeamName : match.awayTeamName) ??
      'Winning team'
    );
  }, [card?.result.winningTeamId, match]);

  const resultLine = useMemo(() => {
    if (match?.resultNote) return match.resultNote;
    if (!card?.result.decided || !match) return null;
    return formatMatchResultNote(winningTeamName, card.result);
  }, [card?.result, match, winningTeamName]);

  const momCandidates = useMemo(
    () => (match && card ? buildManOfMatchCandidates(match, card) : []),
    [match, card],
  );

  const showMomPrompt =
    Boolean(momEligibility?.offered && momEligibility.canSelect) &&
    shouldOfferManOfMatch(match, card);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  function doConfirm(): void {
    Alert.alert(
      'Confirm scorecard?',
      'Once confirmed the scorecard is locked. Captain, Vice Captain and Scorer can no longer edit it.',
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

  function pickManOfMatch(userId: string): void {
    setWorking(true);
    void (async () => {
      try {
        const conf = await selectManOfMatch(matchId, { userId });
        setConfirmation(conf);
        setShowManOfMatch(false);
        await load();
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : 'Could not set Man of the Match.');
      } finally {
        setWorking(false);
      }
    })();
  }

  const locked = confirmation?.state === 'SCORECARD_LOCKED';
  const awaiting = confirmation?.state === 'COMPLETED' || confirmation?.state === 'NO_RESULT';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-6 py-6 gap-4">
        <Pressable onPress={() => router.back()}>
          <Text className="font-sans text-primary">← Back</Text>
        </Pressable>

        <Text className="font-sans-bold text-2xl text-on-surface">
          {match
            ? `${match.homeTeamName ?? 'TBD'} vs ${match.awayTeamName ?? match.externalOpponentName ?? 'TBD'}`
            : 'Scorecard'}
        </Text>

        {error ? (
          <View className="rounded-lg bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : null}

        {/* §13.1: confirmation status / action */}
        {awaiting ? (
          <View className="gap-2 rounded-xl border border-primary bg-primary-container/40 p-4">
            <Text className="font-sans-bold text-lg text-primary">Confirm scorecard</Text>
            <Text className="font-sans text-sm text-on-surface-variant">
              The Captain or Vice Captain should confirm within 5 hours. Otherwise the system
              auto-confirms{confirmation?.autoConfirmDueAt ? ` in ${untilLabel(confirmation.autoConfirmDueAt)}` : ''}.
            </Text>
            <Button
              disabled={working}
              onPress={doConfirm}
              variant="secondary"
              className="h-12"
              label="Confirm scorecard"
            />
          </View>
        ) : null}

        {locked ? (
          <View className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
              Scorecard locked
            </Text>
            <Text className="mt-1 font-sans text-sm text-on-surface">
              {confirmation?.autoConfirmed
                ? 'Auto-confirmed by the system after the 5-hour window.'
                : 'Confirmed by the team.'}
            </Text>
          </View>
        ) : null}

        {card && match && momUserId ? (
          <ManOfMatchCard
            match={match}
            card={card}
            momUserId={momUserId}
            nameOf={nameOf}
          />
        ) : null}

        {/* Full scorecard (§28) */}
        {card ? (
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
          />
        ) : null}

        {/* §13.3: Man of the Match — winning captain only */}
        {showMomPrompt ? (
          <View
            className={`gap-2 rounded-xl border p-4 ${
              momEligibility?.overdue
                ? 'border-secondary-700 bg-secondary-100/30'
                : 'border-primary bg-primary-container/40'
            }`}
          >
            <Text
              className={`font-sans-bold text-lg ${
                momEligibility?.overdue ? 'text-secondary-900' : 'text-primary'
              }`}
            >
              Man of the Match — Required
            </Text>
            {momEligibility?.dueAt ? (
              <Text
                className={`font-sans text-sm ${
                  momEligibility.overdue ? 'text-secondary-900' : 'text-on-surface-variant'
                }`}
              >
                {momEligibility.overdue
                  ? `Overdue — required by end of match day (${momEligibility.dueAt.slice(0, 10)})`
                  : `Required by end of match day (${momEligibility.dueAt.slice(0, 10)})`}
              </Text>
            ) : null}
            {confirmation?.manOfTheMatchUserId ? (
              <Text className="font-sans text-sm text-on-surface">
                ★ {nameOf(confirmation.manOfTheMatchUserId)}
              </Text>
            ) : (
              <>
                <Text className="font-sans text-sm text-on-surface-variant">
                  Select the player of the match from {winningTeamName}.
                </Text>
                <Button
                  label="Select Man of the Match"
                  disabled={working}
                  onPress={() => setShowManOfMatch(true)}
                  className="h-11"
                />
              </>
            )}
          </View>
        ) : null}

        {/* §16: PDF export (guest-accessible) */}
        <Button
          onPress={() => void Linking.openURL(scorecardPdfUrl(matchId))}
          variant="outline"
          className="h-12 border-primary"
          textClassName="text-primary"
          label="Export scorecard PDF"
        />
      </ScrollView>

      <ManOfMatchDialog
        visible={showManOfMatch}
        teamName={winningTeamName}
        resultLine={resultLine}
        candidates={momCandidates}
        required={momEligibility?.required ?? true}
        dueAt={momEligibility?.dueAt ?? confirmation?.manOfMatchDueAt}
        overdue={momEligibility?.overdue ?? confirmation?.manOfMatchOverdue}
        onConfirm={pickManOfMatch}
      />
    </SafeAreaView>
  );
}
