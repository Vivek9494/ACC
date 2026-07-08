import { Ionicons } from '@expo/vector-icons';
import {
  TEAM_FORM_MESSAGES,
  TEAM_NAME_MAX_LENGTH,
  type BallType,
  canAssignTeamRoles,
  normalizeTeamName,
  validateTeamName,
  validateTeamRoleAssignments,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../../../src/components/ui/KeyboardAwareFormScrollView';
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader';
import { SuccessDialog } from '../../../src/components/ui/SuccessDialog';
import { TeamCreateRoleAssignmentFields } from '../../../src/components/tournament/TeamCreateRoleAssignmentFields';
import { TeamLogoField } from '../../../src/components/ui/TeamLogoField';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { ApiRequestError, createTeam, getTournament, listTeams } from '../../../src/lib/api';
import { uploadTeamLogo } from '../../../src/lib/imageUpload';
import { useAuth } from '../../../src/lib/auth-context';
import { TOURNAMENT_DETAIL_TAB } from '../../../src/lib/tournament-detail-tabs';
import { tournamentDetailHref } from '../../../src/lib/tournament-detail-route';
import {
  ensureUploadableUri,
  isLocalImageUri,
  pickedToStored,
  type PickedImageFile,
  type StoredImageFile,
} from '../../../src/lib/imagePicker';

export default function AddTeamScreen(): React.ReactElement {
  const { id: tournamentId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [ballType, setBallType] = useState<BallType | null>(null);
  const [captainUserId, setCaptainUserId] = useState<string | null>(null);
  const [viceCaptainUserId, setViceCaptainUserId] = useState<string | null>(null);
  const [managerUserId, setManagerUserId] = useState<string | null>(null);

  const [teamName, setTeamName] = useState('');
  const [logo, setLogo] = useState<StoredImageFile | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const previewUri = logo?.uri ?? null;
  const showRoleFields = canAssignTeamRoles(user) && ballType != null;

  useEffect(() => {
    if (!tournamentId || !canAssignTeamRoles(user)) {
      return;
    }
    getTournament(tournamentId)
      .then((tournament) => setBallType(tournament.ballType))
      .catch(() => setBallType(null));
  }, [tournamentId, user]);

  const handleLogoPicked = useCallback(async (file: PickedImageFile) => {
    const stored = pickedToStored(file);
    setLogo(stored);
    setLogoError(null);
    setSubmitError(null);

    if (!isLocalImageUri(file.uri)) {
      return;
    }

    setLogoUploading(true);
    try {
      const uploadUri = await ensureUploadableUri(file.uri, 'team-logo');
      const uploaded = await uploadTeamLogo(uploadUri, file.sizeBytes ?? 0);
      setLogo({ ...stored, remoteUrl: uploaded.storageKey, uri: uploaded.logoUrl });
    } catch (err) {
      setLogo(stored);
      setLogoError(err instanceof ApiRequestError ? err.message : 'Could not upload team logo.');
    } finally {
      setLogoUploading(false);
    }
  }, []);

  async function checkNameOnBlur(): Promise<void> {
    if (!tournamentId) {
      return;
    }
    const validation = validateTeamName(teamName);
    if (validation) {
      return;
    }
    try {
      const teams = await listTeams(tournamentId);
      const normalized = normalizeTeamName(teamName);
      if (teams.some((team) => normalizeTeamName(team.name) === normalized)) {
        setNameError(TEAM_FORM_MESSAGES.name.duplicate);
      }
    } catch {
      // Backend remains the source of truth on submit.
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!tournamentId) {
      setSubmitError('Tournament not found.');
      return;
    }

    const nameValidation = validateTeamName(teamName);
    if (nameValidation) {
      setNameError(nameValidation);
      return;
    }
    setNameError(null);
    setSubmitError(null);

    if (logoUploading) {
      setSubmitError('Please wait for the logo upload to finish.');
      return;
    }

    const roleConflict = validateTeamRoleAssignments(
      captainUserId,
      viceCaptainUserId,
      managerUserId,
    );
    if (roleConflict) {
      setSubmitError(roleConflict);
      return;
    }

    setSubmitting(true);
    try {
      await createTeam(tournamentId, {
        name: teamName.trim(),
        logoUrl: logo?.remoteUrl ?? null,
        ...(showRoleFields
          ? {
              captainUserId,
              viceCaptainUserId,
              managerUserId,
            }
          : {}),
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
        setSubmitError('Could not add team.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuccessDismiss(): void {
    setShowSuccessDialog(false);
    if (tournamentId) {
      router.replace(tournamentDetailHref(user, tournamentId, TOURNAMENT_DETAIL_TAB.Teams));
    } else {
      router.back();
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader title="Add Team" subtitle="Upload logo and name your team" onBack={() => router.back()} />

      <KeyboardAwareFormScrollView
        contentContainerClassName="px-4 pt-2"
        extraBottomPadding={48}
      >
        <View className="gap-6">
          <TeamLogoField
            uri={previewUri}
            uploading={logoUploading}
            onFilePicked={(file) => void handleLogoPicked(file)}
            onPickError={setLogoError}
            error={logoError ?? undefined}
          />

          <TextInput
            label="Team Name"
            placeholder="e.g. Barrie Cobras"
            value={teamName}
            onChangeText={(value) => {
              setTeamName(value.slice(0, TEAM_NAME_MAX_LENGTH));
              setNameError(null);
              setSubmitError(null);
            }}
            onBlur={() => void checkNameOnBlur()}
            maxLength={TEAM_NAME_MAX_LENGTH}
            error={nameError ?? undefined}
          />

          {showRoleFields ? (
            <TeamCreateRoleAssignmentFields
              tournamentId={tournamentId!}
              ballType={ballType!}
              captainUserId={captainUserId}
              viceCaptainUserId={viceCaptainUserId}
              managerUserId={managerUserId}
              onCaptainChange={setCaptainUserId}
              onViceCaptainChange={setViceCaptainUserId}
              onManagerChange={setManagerUserId}
              disabled={submitting}
            />
          ) : null}

          {submitError ? (
            <Text className="font-sans text-sm text-primary">{submitError}</Text>
          ) : null}

          <Button
            label={submitting ? 'Adding…' : 'Add Team'}
            onPress={() => void handleSubmit()}
            disabled={submitting || logoUploading}
            className="h-14 w-full"
          />
        </View>
      </KeyboardAwareFormScrollView>

      {submitting ? (
        <View className="absolute inset-0 items-center justify-center bg-black/10">
          <ActivityIndicator color={FIELD_ORANGE} size="large" />
        </View>
      ) : null}

      <SuccessDialog
        visible={showSuccessDialog}
        title="Team Added"
        message="Your team has been added to the tournament."
        onDismiss={handleSuccessDismiss}
        continueLabel="Continue"
        autoDismissMs={0}
      />
    </SafeAreaView>
  );
}
