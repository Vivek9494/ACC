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
const ALL_CENTERS_VALUE = '';

function candidateLabel(candidate: TeamRoleCandidate): string {
  return candidate.centerName
    ? `${candidate.firstName} ${candidate.lastName} · ${candidate.centerName}`
    : `${candidate.firstName} ${candidate.lastName}`;
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

/**
 * Captain / VC / Manager pickers at team creation — type-specific audience
 * (tennis centers / leather province prior participants). Selected players are
 * auto-rostered onto the new team.
 */
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
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [audienceCount, setAudienceCount] = useState(0);
  const [rosteredCount, setRosteredCount] = useState(0);
  const [centerFilter, setCenterFilter] = useState<string>(ALL_CENTERS_VALUE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const showManager = ballType !== BallType.Leather;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTeamRoleCandidates(tournamentId, {
      centerId: centerFilter || undefined,
    })
      .then((response) => {
        if (!cancelled) {
          setCandidates(response.candidates);
          setCenters(response.centers);
          setAudienceCount(response.confirmedRegistrantCount);
          setRosteredCount(response.rosteredCount);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not load eligible players.',
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
  }, [tournamentId, centerFilter]);

  const centerOptions: SelectOption[] = useMemo(
    () => [
      { value: ALL_CENTERS_VALUE, label: 'All centers' },
      ...centers.map((center) => ({ value: center.id, label: center.name })),
    ],
    [centers],
  );

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
          {showManager ? ', and Manager' : ''} from eligible players for this tournament type.
          Selected players are added to this team&apos;s squad automatically. Each role must be a
          different player not already on another team.
        </Text>
        {!loading && !loadError ? (
          <Text className="mt-2 font-sans text-xs text-text-muted">
            {`${eligibleCount} eligible (unrostered) · ${audienceCount} in audience · ${rosteredCount} already on a team`}
          </Text>
        ) : null}
      </View>

      {centers.length > 0 ? (
        <Select
          label="Filter by center"
          placeholder="All centers"
          value={centerFilter}
          options={centerOptions}
          onChange={setCenterFilter}
          disabled={fieldsDisabled}
          loading={loading}
        />
      ) : null}

      <Select
        label="Captain"
        placeholder={emptyPool ? 'No eligible players' : 'Select captain (optional)'}
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
        placeholder={emptyPool ? 'No eligible players' : 'Select vice-captain (optional)'}
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
          placeholder={emptyPool ? 'No eligible players' : 'Select manager (optional)'}
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
