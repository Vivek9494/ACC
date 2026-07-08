import {
  BallType,
  type TeamRoleCandidate,
  validateTeamRoleAssignments,
} from '@acc/types';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ApiRequestError, listTeamRoleCandidates } from '../../lib/api';
import { Select, type SelectOption } from '../ui/Select';
import { Text } from '../ui/Text';

const UNASSIGNED_VALUE = '';

function candidateLabel(candidate: TeamRoleCandidate): string {
  return `${candidate.firstName} ${candidate.lastName}`;
}

function roleOptions(
  candidates: TeamRoleCandidate[],
  excludedUserIds: string[],
): SelectOption[] {
  const excluded = new Set(excludedUserIds);
  return [
    { value: UNASSIGNED_VALUE, label: 'None' },
    ...candidates
      .filter((candidate) => !excluded.has(candidate.userId))
      .map((candidate) => ({ value: candidate.userId, label: candidateLabel(candidate) })),
  ];
}

export interface TeamCreateRoleAssignmentFieldsProps {
  tournamentId: string;
  ballType: BallType;
  captainUserId: string | null;
  viceCaptainUserId: string | null;
  managerUserId: string | null;
  onCaptainChange: (userId: string | null) => void;
  onViceCaptainChange: (userId: string | null) => void;
  onManagerChange: (userId: string | null) => void;
  disabled?: boolean;
}

/** Captain / VC / Manager pickers at team creation — lists unrostered registered players. */
export function TeamCreateRoleAssignmentFields({
  tournamentId,
  ballType,
  captainUserId,
  viceCaptainUserId,
  managerUserId,
  onCaptainChange,
  onViceCaptainChange,
  onManagerChange,
  disabled = false,
}: TeamCreateRoleAssignmentFieldsProps): React.ReactElement {
  const [candidates, setCandidates] = useState<TeamRoleCandidate[]>([]);
  const [confirmedRegistrantCount, setConfirmedRegistrantCount] = useState(0);
  const [rosteredCount, setRosteredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const showManager = ballType !== BallType.Leather;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTeamRoleCandidates(tournamentId)
      .then((response) => {
        if (!cancelled) {
          setCandidates(response.candidates);
          setConfirmedRegistrantCount(response.confirmedRegistrantCount);
          setRosteredCount(response.rosteredCount);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not load registered players.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const captainOptions = useMemo(
    () => roleOptions(candidates, [viceCaptainUserId, managerUserId].filter(Boolean) as string[]),
    [candidates, managerUserId, viceCaptainUserId],
  );
  const viceCaptainOptions = useMemo(
    () => roleOptions(candidates, [captainUserId, managerUserId].filter(Boolean) as string[]),
    [captainUserId, candidates, managerUserId],
  );
  const managerOptions = useMemo(
    () => roleOptions(candidates, [captainUserId, viceCaptainUserId].filter(Boolean) as string[]),
    [captainUserId, candidates, viceCaptainUserId],
  );

  const roleConflict = validateTeamRoleAssignments(
    captainUserId,
    viceCaptainUserId,
    managerUserId,
  );

  function toUserId(value: string): string | null {
    return value === UNASSIGNED_VALUE ? null : value;
  }

  const emptyPool = !loading && candidates.length === 0;
  const fieldsDisabled = disabled || loading;
  const eligibleCount = candidates.length;

  return (
    <View className="gap-4">
      <View>
        <Text className="font-sans-bold text-lg text-on-surface">Team Leadership</Text>
        <Text className="mt-1 font-sans text-sm text-on-surface-variant">
          Optionally assign Captain, Vice-Captain
          {showManager ? ', and Manager' : ''} now. Selected players are added to this team&apos;s
          squad automatically. Each role must be a different confirmed registrant not already on
          another team.
        </Text>
        {!loading && !loadError ? (
          <Text className="mt-2 font-sans text-xs text-text-muted">
            {`${eligibleCount} eligible player${eligibleCount === 1 ? '' : 's'} · ${confirmedRegistrantCount} confirmed registrant${confirmedRegistrantCount === 1 ? '' : 's'} · ${rosteredCount} already on a team`}
          </Text>
        ) : null}
      </View>

      <Select
        label="Captain"
        placeholder={emptyPool ? 'No eligible registered players' : 'Select captain (optional)'}
        value={captainUserId ?? UNASSIGNED_VALUE}
        options={captainOptions}
        onChange={(value) => onCaptainChange(toUserId(value))}
        disabled={fieldsDisabled || emptyPool}
        loading={loading}
        searchable
        searchPlaceholder="Search players…"
      />

      <Select
        label="Vice-Captain"
        placeholder={
          emptyPool ? 'No eligible registered players' : 'Select vice-captain (optional)'
        }
        value={viceCaptainUserId ?? UNASSIGNED_VALUE}
        options={viceCaptainOptions}
        onChange={(value) => onViceCaptainChange(toUserId(value))}
        disabled={fieldsDisabled || emptyPool}
        loading={loading}
        searchable
        searchPlaceholder="Search players…"
      />

      {showManager ? (
        <Select
          label="Manager"
          placeholder={emptyPool ? 'No eligible registered players' : 'Select manager (optional)'}
          value={managerUserId ?? UNASSIGNED_VALUE}
          options={managerOptions}
          onChange={(value) => onManagerChange(toUserId(value))}
          disabled={fieldsDisabled || emptyPool}
          loading={loading}
          searchable
          searchPlaceholder="Search players…"
        />
      ) : null}

      {loadError ? <Text className="font-sans text-sm text-primary">{loadError}</Text> : null}
      {roleConflict ? <Text className="font-sans text-sm text-primary">{roleConflict}</Text> : null}
    </View>
  );
}
