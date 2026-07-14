import {
  SCORERS_LOCKED_LIVE_MATCH_MESSAGE,
  type MatchTennisScorerView,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ChangeMatchScorerDialog } from './ChangeMatchScorerDialog';
import { PlayerAvatar } from '../tournament/PlayerAvatar';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Text } from '../ui/Text';
import { useAuth } from '../../lib/auth-context';
import { tournamentSubpathHref } from '../../lib/tournament-detail-route';

export interface MatchTennisScorerSectionProps {
  matchId: string;
  tournamentId: string;
  tennisScorer: MatchTennisScorerView;
  working: boolean;
  onAssign: (userId: string) => Promise<void>;
  onScorerSwapped?: () => void;
}

/** Tennis Phase 2: per-match scorer picker from the tournament's five shared scorers. */
export function MatchTennisScorerSection({
  matchId: _matchId,
  tournamentId,
  tennisScorer,
  working,
  onAssign,
  onScorerSwapped,
}: MatchTennisScorerSectionProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [changeScorerOpen, setChangeScorerOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    tennisScorer.assignedScorer && !tennisScorer.assignedScorer.isStale
      ? tennisScorer.assignedScorer.userId
      : null,
  );

  useEffect(() => {
    setSelectedUserId(
      tennisScorer.assignedScorer && !tennisScorer.assignedScorer.isStale
        ? tennisScorer.assignedScorer.userId
        : null,
    );
  }, [tennisScorer.assignedScorer?.userId, tennisScorer.assignedScorer?.isStale]);

  const { assignedScorer, pickableScorers, canManageMatchScorer, canManageTournamentScorers } =
    tennisScorer;
  const showMidMatchSwap = tennisScorer.canMidMatchSwapScorer;
  const showMatchScorerPicker =
    canManageMatchScorer && !tennisScorer.matchScorerEditLocked;

  if (tennisScorer.tournamentScorerCount === 0) {
    return (
      <View className="gap-3 rounded-control border border-outline-variant bg-surface-container-lowest p-4">
        <Text className="font-sans-bold text-lg text-primary">Scorer</Text>
        <Text className="font-sans text-sm text-on-surface-variant">
          Assign tournament scorers first.
        </Text>
        {tennisScorer.scorersEditLocked ? (
          <Text className="font-sans text-sm text-primary">{SCORERS_LOCKED_LIVE_MATCH_MESSAGE}</Text>
        ) : null}
        {canManageTournamentScorers && !tennisScorer.scorersEditLocked ? (
          <Button
            disabled={working}
            onPress={() =>
              router.push(tournamentSubpathHref(user, tournamentId, 'assign-scorers'))
            }
            className="h-12"
            label="Assign Scorers"
          />
        ) : null}
      </View>
    );
  }

  const pickerOptions = pickableScorers.map((scorer) => ({
    value: scorer.userId,
    label: `${scorer.firstName} ${scorer.lastName}`.trim(),
  }));

  return (
    <View className="gap-3 rounded-control border border-outline-variant bg-surface-container-lowest p-4">
      <Text className="font-sans-bold text-lg text-primary">Scorer</Text>

      {assignedScorer?.isStale ? (
        <View className="gap-1 rounded-control border border-error bg-error-container/20 p-3">
          <Text className="font-sans-semibold text-sm text-on-surface">
            {assignedScorer.firstName} {assignedScorer.lastName}
          </Text>
          <Text className="font-sans text-xs text-error">
            No longer a tournament scorer — select a replacement.
          </Text>
        </View>
      ) : assignedScorer ? (
        <View className="flex-row items-center gap-3">
          <PlayerAvatar
            firstName={assignedScorer.firstName}
            profilePhotoUrl={null}
            size="sm"
            shape="circle"
          />
          <View className="min-w-0 flex-1">
            <Text className="font-sans-semibold text-sm text-on-surface">
              {assignedScorer.firstName} {assignedScorer.lastName}
            </Text>
          </View>
        </View>
      ) : (
        <Text className="font-sans text-sm text-on-surface-variant">
          No match scorer assigned yet.
        </Text>
      )}

      {tennisScorer.matchScorerEditLocked && tennisScorer.matchScorerEditLockedMessage ? (
        showMidMatchSwap ? (
          <Button
            disabled={working}
            onPress={() => setChangeScorerOpen(true)}
            className="h-12"
            label="Change Scorer"
          />
        ) : (
          <Text className="font-sans text-sm text-primary">
            {tennisScorer.matchScorerEditLockedMessage}
          </Text>
        )
      ) : null}

      <ChangeMatchScorerDialog
        visible={changeScorerOpen}
        matchId={_matchId}
        pickableScorers={pickableScorers}
        currentScorerUserId={
          assignedScorer && !assignedScorer.isStale ? assignedScorer.userId : null
        }
        onClose={() => setChangeScorerOpen(false)}
        onSwapped={onScorerSwapped}
      />

      {showMatchScorerPicker ? (
        <Select
          label="Match Scorer"
          placeholder="Select scorer"
          value={selectedUserId}
          options={pickerOptions}
          onChange={(userId) => {
            setSelectedUserId(userId);
            if (userId) {
              void onAssign(userId);
            }
          }}
        />
      ) : null}
    </View>
  );
}
