import type { MatchListItem } from '@acc/types';
import {
  MatchSchedulingFormat,
  type MatchSchedulingFormat as MatchSchedulingFormatType,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiRequestError, listMatches, selectMatchSchedulingFormat } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { canCreateTournamentTeam } from '../../lib/can-create-team';
import { canScheduleTournamentMatches } from '../../lib/can-schedule-matches';
import { GroupSetupRequiredDialog } from '../ui/GroupSetupRequiredDialog';
import { ScheduleMatchesNoTeamsDialog } from '../ui/ScheduleMatchesNoTeamsDialog';
import { SelectFormatModal } from '../ui/SelectFormatModal';
import { Button } from '../ui/Button';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { Text } from '../ui/Text';
import { MatchList } from './MatchList';
import { TournamentMatchesEmptyState } from './TournamentMatchesEmptyState';

export interface TournamentMatchesTabProps {
  tournamentId: string;
  active: boolean;
  teamCount: number;
}

export function TournamentMatchesTab({
  tournamentId,
  active,
  teamCount,
}: TournamentMatchesTabProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();

  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noTeamsDialogVisible, setNoTeamsDialogVisible] = useState(false);
  const [selectFormatVisible, setSelectFormatVisible] = useState(false);
  const [setupRequiredVisible, setSetupRequiredVisible] = useState(false);
  const [selectingFormat, setSelectingFormat] = useState(false);
  const [selectFormatError, setSelectFormatError] = useState<string | null>(null);

  const canSchedule = canScheduleTournamentMatches(user);
  const canCreateTeam = canCreateTournamentTeam(user);
  const hasMatches = matches.length > 0;

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMatches(await listMatches(tournamentId));
    } catch (err) {
      setMatches([]);
      setError(err instanceof ApiRequestError ? err.message : 'Could not load matches.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (!active) {
      return;
    }
    void loadMatches();
  }, [active, loadMatches]);

  function handleSchedulePress(): void {
    if (!canSchedule) {
      return;
    }
    if (teamCount < 2) {
      setNoTeamsDialogVisible(true);
      return;
    }
    setSelectFormatError(null);
    setSelectFormatVisible(true);
  }

  function handleCreateTeam(): void {
    setNoTeamsDialogVisible(false);
    router.push(`/tournaments/${tournamentId}/add-team`);
  }

  function handleCreateGroup(): void {
    setSetupRequiredVisible(false);
    router.push(`/tournaments/${tournamentId}/create-group`);
  }

  function navigateToSchedulingFlow(format: MatchSchedulingFormatType): void {
    router.push({
      pathname: '/tournaments/[id]/match-setup',
      params: { id: tournamentId, format },
    });
  }

  async function handleFormatSelect(format: MatchSchedulingFormatType): Promise<void> {
    setSelectingFormat(true);
    setSelectFormatError(null);
    try {
      const updated = await selectMatchSchedulingFormat(tournamentId, format);
      setSelectFormatVisible(false);

      if (
        format === MatchSchedulingFormat.GroupStageKnockout &&
        updated.groupCount === 0
      ) {
        setSetupRequiredVisible(true);
        return;
      }

      navigateToSchedulingFlow(format);
    } catch (err) {
      setSelectFormatError(
        err instanceof ApiRequestError ? err.message : 'Could not save scheduling format.',
      );
    } finally {
      setSelectingFormat(false);
    }
  }

  if (loading && !loaded) {
    return (
      <View className="items-center py-16">
        <ActivityIndicator color={FIELD_ORANGE} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="items-center px-6 py-12">
        <Text className="text-center font-sans text-base text-on-surface-variant">{error}</Text>
      </View>
    );
  }

  return (
    <>
      {hasMatches ? (
        <View className="gap-4">
          {canSchedule ? (
            <Button
              label="Schedule Matches"
              variant="amber"
              onPress={handleSchedulePress}
              className="h-12 w-full"
            />
          ) : null}
          <MatchList
            matches={matches}
            onMatchPress={(matchId) => router.push(`/matches/${matchId}`)}
            onWatchLivePress={(matchId) => router.push(`/matches/${matchId}/live`)}
          />
        </View>
      ) : (
        <TournamentMatchesEmptyState
          canSchedule={canSchedule}
          onSchedulePress={handleSchedulePress}
        />
      )}

      <ScheduleMatchesNoTeamsDialog
        visible={noTeamsDialogVisible}
        teamCount={teamCount}
        canCreateTeam={canCreateTeam}
        onCancel={() => setNoTeamsDialogVisible(false)}
        onCreateTeam={canCreateTeam ? handleCreateTeam : undefined}
      />

      <SelectFormatModal
        visible={selectFormatVisible}
        selecting={selectingFormat}
        errorMessage={selectFormatError}
        onCancel={() => {
          if (!selectingFormat) {
            setSelectFormatVisible(false);
            setSelectFormatError(null);
          }
        }}
        onSelect={(format) => void handleFormatSelect(format)}
      />

      <GroupSetupRequiredDialog
        visible={setupRequiredVisible}
        canCreateGroup={canSchedule}
        onCancel={() => setSetupRequiredVisible(false)}
        onCreateGroup={canSchedule ? handleCreateGroup : undefined}
      />
    </>
  );
}
