import {
  BallType,
  type TeamDetailPlayerRow,
  type TeamDetailView,
  type TeamRoleCandidate,
} from '@acc/types';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ApiRequestError, assignTeamRoles, listTeamRoleCandidates } from '../../lib/api';
import { Select, type SelectOption } from '../ui/Select';
import { Text } from '../ui/Text';

const UNASSIGNED_VALUE = '';
const ALL_CENTERS_VALUE = '';

function candidateLabel(candidate: TeamRoleCandidate): string {
  return candidate.centerName
    ? `${candidate.firstName} ${candidate.lastName} · ${candidate.centerName}`
    : `${candidate.firstName} ${candidate.lastName}`;
}

function playerToCandidate(player: TeamDetailPlayerRow): TeamRoleCandidate {
  return {
    userId: player.userId,
    firstName: player.firstName,
    lastName: player.lastName,
    centerId: null,
    centerName: '',
  };
}

function mergeCandidates(
  audience: TeamRoleCandidate[],
  roster: TeamDetailPlayerRow[],
): TeamRoleCandidate[] {
  const byId = new Map<string, TeamRoleCandidate>();
  for (const player of roster) {
    byId.set(player.userId, playerToCandidate(player));
  }
  for (const candidate of audience) {
    byId.set(candidate.userId, candidate);
  }
  return [...byId.values()].sort((a, b) => {
    const last = a.lastName.localeCompare(b.lastName);
    if (last !== 0) {
      return last;
    }
    return a.firstName.localeCompare(b.firstName);
  });
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

export interface TeamRoleAssignmentFieldsProps {
  tournamentId: string;
  teamId: string;
  detail: TeamDetailView;
  /** Called after a successful assign so the parent can reload team detail. */
  onUpdated: () => void;
}

/** Captain / Vice-Captain / Manager pickers — organizers (Admin / CM / participating Sevak). */
export function TeamRoleAssignmentFields({
  tournamentId,
  teamId,
  detail,
  onUpdated,
}: TeamRoleAssignmentFieldsProps): React.ReactElement {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<TeamRoleCandidate[]>([]);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [centerFilter, setCenterFilter] = useState<string>(ALL_CENTERS_VALUE);
  const [loading, setLoading] = useState(true);

  const captainUserId = detail.players.find((player) => player.isCaptain)?.userId ?? null;
  const viceCaptainUserId =
    detail.players.find((player) => player.isViceCaptain)?.userId ?? null;
  const managerUserId = detail.players.find((player) => player.isManager)?.userId ?? null;
  const showManager = detail.ballType !== BallType.Leather;

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
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
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

  const pool = useMemo(
    () => mergeCandidates(candidates, detail.players),
    [candidates, detail.players],
  );

  const centerOptions: SelectOption[] = useMemo(
    () => [
      { value: ALL_CENTERS_VALUE, label: 'All centers' },
      ...centers.map((center) => ({ value: center.id, label: center.name })),
    ],
    [centers],
  );

  const captainOptions = useMemo(
    () => roleOptions(pool, [viceCaptainUserId, managerUserId].filter(Boolean) as string[]),
    [managerUserId, pool, viceCaptainUserId],
  );
  const viceCaptainOptions = useMemo(
    () => roleOptions(pool, [captainUserId, managerUserId].filter(Boolean) as string[]),
    [captainUserId, managerUserId, pool],
  );
  const managerOptions = useMemo(
    () => roleOptions(pool, [captainUserId, viceCaptainUserId].filter(Boolean) as string[]),
    [captainUserId, pool, viceCaptainUserId],
  );

  async function saveRole(
    patch: Partial<{
      captainUserId: string | null;
      viceCaptainUserId: string | null;
      managerUserId: string | null;
    }>,
  ): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await assignTeamRoles(tournamentId, teamId, patch);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not update team role.');
    } finally {
      setSaving(false);
    }
  }

  function toUserId(value: string): string | null {
    return value === UNASSIGNED_VALUE ? null : value;
  }

  const emptyPool = !loading && pool.length === 0;
  const fieldsDisabled = saving || loading;

  return (
    <View className="gap-4">
      <View>
        <Text className="font-sans-bold text-lg text-on-surface">Team Leadership</Text>
        <Text className="mt-1 font-sans text-sm text-on-surface-variant">
          Assign Captain, Vice-Captain
          {showManager ? ', and Manager' : ''} from eligible players for this tournament type.
          Players not already on this squad are added automatically. Each role must be a different
          player.
        </Text>
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
        placeholder={emptyPool ? 'No eligible players' : 'Select captain'}
        value={captainUserId ?? UNASSIGNED_VALUE}
        options={captainOptions}
        onChange={(value) => void saveRole({ captainUserId: toUserId(value) })}
        disabled={fieldsDisabled || emptyPool}
        loading={loading}
        searchable
        searchPlaceholder="Search players…"
      />

      <Select
        label="Vice-Captain"
        placeholder={emptyPool ? 'No eligible players' : 'Select vice-captain'}
        value={viceCaptainUserId ?? UNASSIGNED_VALUE}
        options={viceCaptainOptions}
        onChange={(value) => void saveRole({ viceCaptainUserId: toUserId(value) })}
        disabled={fieldsDisabled || emptyPool}
        loading={loading}
        searchable
        searchPlaceholder="Search players…"
      />

      {showManager ? (
        <Select
          label="Manager"
          placeholder={emptyPool ? 'No eligible players' : 'Select manager'}
          value={managerUserId ?? UNASSIGNED_VALUE}
          options={managerOptions}
          onChange={(value) => void saveRole({ managerUserId: toUserId(value) })}
          disabled={fieldsDisabled || emptyPool}
          loading={loading}
          searchable
          searchPlaceholder="Search players…"
        />
      ) : null}

      {error ? <Text className="font-sans text-sm text-primary">{error}</Text> : null}
    </View>
  );
}
