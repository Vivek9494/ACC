import { Ionicons } from '@expo/vector-icons';
import {
  GROUP_FORM_MESSAGES,
  GROUP_NAME_MAX_LENGTH,
  normalizeGroupName,
  type TeamSummary,
  validateGroupName,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { FIELD_ORANGE, labelClassName } from '../../../src/components/ui/fieldStyles';
import { ProfileMenu } from '../../../src/components/ui/ProfileMenu';
import { SuccessDialog } from '../../../src/components/ui/SuccessDialog';
import { TeamAvatar } from '../../../src/components/ui/TeamAvatar';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { ApiRequestError, createGroup, listGroups, listTeams } from '../../../src/lib/api';

function TeamSelectRow({
  team,
  checked,
  onToggle,
}: {
  team: TeamSummary;
  checked: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onToggle}
      className={`flex-row items-center gap-3 rounded-control border bg-white p-4 active:opacity-90 ${
        checked ? 'border-primary bg-primary/5' : 'border-outline-variant'
      }`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={team.name}
    >
      <TeamAvatar name={team.name} logoUrl={team.logoUrl} size="md" />
      <Text className="min-w-0 flex-1 font-sans-medium text-base text-on-surface">{team.name}</Text>
      <View
        className={`h-6 w-6 items-center justify-center rounded-md border ${
          checked ? 'border-primary bg-primary' : 'border-[#D1D1D1] bg-white'
        }`}
      >
        {checked ? <Ionicons name="checkmark" size={16} color="#ffffff" /> : null}
      </View>
    </Pressable>
  );
}

export default function CreateGroupScreen(): React.ReactElement {
  const { id: tournamentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loadingTeams, setLoadingTeams] = useState(true);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [groupName, setGroupName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const selectableTeams = useMemo(
    () => teams.filter((team) => team.groupId == null),
    [teams],
  );

  const filteredTeams = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    if (!query) {
      return selectableTeams;
    }
    return selectableTeams.filter((team) => team.name.toLowerCase().includes(query));
  }, [selectableTeams, teamSearch]);

  const assignedTeamCount = teams.length - selectableTeams.length;
  const canSubmit = groupName.trim().length > 0 && !submitting && !loadingTeams;

  const loadTeams = useCallback(async () => {
    if (!tournamentId) {
      setLoadError('Tournament not found.');
      setLoadingTeams(false);
      return;
    }
    setLoadingTeams(true);
    setLoadError(null);
    try {
      setTeams(await listTeams(tournamentId));
    } catch (err) {
      setTeams([]);
      setLoadError(err instanceof ApiRequestError ? err.message : 'Could not load teams.');
    } finally {
      setLoadingTeams(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  async function checkNameOnBlur(): Promise<void> {
    if (!tournamentId) {
      return;
    }
    const validation = validateGroupName(groupName);
    if (validation) {
      return;
    }
    try {
      const groups = await listGroups(tournamentId);
      const normalized = normalizeGroupName(groupName);
      if (groups.some((group) => normalizeGroupName(group.name) === normalized)) {
        setNameError(GROUP_FORM_MESSAGES.name.duplicate);
      }
    } catch {
      // Backend remains the source of truth on submit.
    }
  }

  function toggleTeam(teamId: string): void {
    setSelectedTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId],
    );
    setSubmitError(null);
  }

  async function handleSubmit(): Promise<void> {
    if (!tournamentId) {
      setSubmitError('Tournament not found.');
      return;
    }

    const nameValidation = validateGroupName(groupName);
    if (nameValidation) {
      setNameError(nameValidation);
      return;
    }
    setNameError(null);
    setSubmitError(null);

    setSubmitting(true);
    try {
      await createGroup(tournamentId, {
        name: groupName.trim(),
        teamIds: selectedTeamIds,
      });
      setShowSuccessDialog(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const fieldName = err.error.fields?.name;
        if (fieldName) {
          setNameError(fieldName);
          setSubmitError(null);
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError('Could not create group.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuccessDismiss(): void {
    setShowSuccessDialog(false);
    if (tournamentId) {
      router.replace({
        pathname: '/tournaments/[id]',
        params: { id: tournamentId, tab: 'Groups' },
      });
    } else {
      router.back();
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
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

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View className="flex-1">
          <ScrollView
            contentContainerClassName="gap-6 px-4 pb-6 pt-2"
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text className="font-sans-bold text-2xl text-on-surface">Add New Group</Text>
              <Text className="mt-2 font-sans text-base text-on-surface-variant">
                Fill in the details to create a new group for your tournament.
              </Text>
            </View>

            <TextInput
              label="Group Name"
              placeholder="e.g., Group A"
              value={groupName}
              onChangeText={(value) => {
                setGroupName(value.slice(0, GROUP_NAME_MAX_LENGTH));
                setNameError(null);
                setSubmitError(null);
              }}
              onBlur={() => void checkNameOnBlur()}
              maxLength={GROUP_NAME_MAX_LENGTH}
              error={nameError ?? undefined}
            />

            <View className="gap-3">
              <View className="gap-1">
                <Text className={labelClassName('brand')}>Select Teams</Text>
                {selectedTeamIds.length > 0 ? (
                  <Text className="ml-1 font-sans text-sm text-on-surface-variant">
                    {selectedTeamIds.length} team{selectedTeamIds.length === 1 ? '' : 's'} selected
                  </Text>
                ) : null}
              </View>

              <TextInput
                placeholder="Search teams..."
                value={teamSearch}
                onChangeText={setTeamSearch}
                leadingIcon={
                  <Ionicons name="search" size={20} color="#5A4136" accessibilityElementsHidden />
                }
                className="py-3"
              />

              {assignedTeamCount > 0 ? (
                <Text className="ml-1 font-sans text-sm text-on-surface-variant">
                  {assignedTeamCount} team{assignedTeamCount === 1 ? '' : 's'} already in another
                  group {assignedTeamCount === 1 ? 'is' : 'are'} not shown.
                </Text>
              ) : null}

              {loadingTeams ? (
                <ActivityIndicator color={FIELD_ORANGE} />
              ) : loadError ? (
                <Text className="font-sans text-sm text-error">{loadError}</Text>
              ) : selectableTeams.length === 0 ? (
                <Text className="font-sans text-sm text-on-surface-variant">
                  {teams.length === 0
                    ? 'No teams in this tournament yet.'
                    : 'All teams are already assigned to groups.'}
                </Text>
              ) : filteredTeams.length === 0 ? (
                <Text className="font-sans text-sm text-on-surface-variant">
                  No teams match your search.
                </Text>
              ) : (
                <View className="gap-3">
                  {filteredTeams.map((team) => (
                    <TeamSelectRow
                      key={team.id}
                      team={team}
                      checked={selectedTeamIds.includes(team.id)}
                      onToggle={() => toggleTeam(team.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          <SafeAreaView
            edges={['bottom']}
            className="border-t border-outline-variant/20 bg-surface px-4 pt-3"
          >
            {submitError ? (
              <Text className="mb-2 font-sans text-sm text-error">{submitError}</Text>
            ) : null}
            <Button
              label={submitting ? 'Creating…' : 'Create Group'}
              onPress={() => void handleSubmit()}
              disabled={!canSubmit}
              className="h-14 w-full"
            />
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>

      {submitting ? (
        <View className="absolute inset-0 items-center justify-center bg-black/10">
          <ActivityIndicator color={FIELD_ORANGE} size="large" />
        </View>
      ) : null}

      <SuccessDialog
        visible={showSuccessDialog}
        title="Group Created"
        message="Your group has been added to the tournament."
        onDismiss={handleSuccessDismiss}
        continueLabel="Continue"
        autoDismissMs={0}
      />
    </SafeAreaView>
  );
}
