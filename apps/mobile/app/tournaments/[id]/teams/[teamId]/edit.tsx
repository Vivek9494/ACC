import { Ionicons } from '@expo/vector-icons';
import {
  TEAM_FORM_MESSAGES,
  TEAM_NAME_MAX_LENGTH,
  normalizeTeamName,
  type TeamDetailView,
  validateTeamName,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../../../../src/components/ui/Button';
import { KeyboardAwareFormScrollView } from '../../../../../src/components/ui/KeyboardAwareFormScrollView';
import { FIELD_ORANGE } from '../../../../../src/components/ui/fieldStyles';
import { ScreenHeader } from '../../../../../src/components/ui/ScreenHeader';
import { SuccessDialog } from '../../../../../src/components/ui/SuccessDialog';
import { TeamLogoField } from '../../../../../src/components/ui/TeamLogoField';
import { Text } from '../../../../../src/components/ui/Text';
import { TextInput } from '../../../../../src/components/ui/TextInput';
import { TeamRoleAssignmentFields } from '../../../../../src/components/tournament/TeamRoleAssignmentFields';
import {
  ApiRequestError,
  getTeamDetail,
  listTeams,
  updateTeam,
} from '../../../../../src/lib/api';
import { uploadTeamLogo } from '../../../../../src/lib/imageUpload';
import {
  ensureUploadableUri,
  isLocalImageUri,
  pickedToStored,
  storedImageFromRemoteUrl,
  type PickedImageFile,
  type StoredImageFile,
} from '../../../../../src/lib/imagePicker';
import { resolveMediaDisplayUrl } from '../../../../../src/lib/media-url';

export default function EditTeamScreen(): React.ReactElement {
  const { id: tournamentId, teamId } = useLocalSearchParams<{ id: string; teamId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [initialName, setInitialName] = useState('');
  const [logo, setLogo] = useState<StoredImageFile | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [teamDetail, setTeamDetail] = useState<TeamDetailView | null>(null);

  const previewUri = logo?.uri ?? null;

  useEffect(() => {
    if (!tournamentId || !teamId) {
      setLoadError('Team not found.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getTeamDetail(tournamentId, teamId)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        setTeamDetail(detail);
        setTeamName(detail.name);
        setInitialName(detail.name);
        if (detail.logoUrl) {
          const displayUrl = resolveMediaDisplayUrl(detail.logoUrl) ?? detail.logoUrl;
          setLogo({
            ...storedImageFromRemoteUrl(detail.logoUrl),
            uri: displayUrl,
          });
        }
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError ? err.message : 'Could not load the team.',
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
  }, [teamId, tournamentId]);

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
    if (!tournamentId || !teamId) {
      return;
    }
    const validation = validateTeamName(teamName);
    if (validation) {
      return;
    }
    if (normalizeTeamName(teamName) === normalizeTeamName(initialName)) {
      return;
    }
    try {
      const teams = await listTeams(tournamentId);
      const normalized = normalizeTeamName(teamName);
      if (teams.some((team) => team.id !== teamId && normalizeTeamName(team.name) === normalized)) {
        setNameError(TEAM_FORM_MESSAGES.name.duplicate);
      }
    } catch {
      // Backend remains the source of truth on submit.
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!tournamentId || !teamId) {
      setSubmitError('Team not found.');
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

    setSubmitting(true);
    try {
      await updateTeam(tournamentId, teamId, {
        name: teamName.trim(),
        logoUrl: logo?.remoteUrl ?? null,
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
        setSubmitError('Could not update team.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuccessDismiss(): void {
    setShowSuccessDialog(false);
    router.back();
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView className="flex-1 bg-background px-6">
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-center font-sans text-base text-on-surface-variant">{loadError}</Text>
          <Button onPress={() => router.back()} label="Go back" className="h-12 px-8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader
        title="Edit Team"
        subtitle="Update team name, logo, and leadership roles"
        onBack={() => router.back()}
      />

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

          {teamDetail?.canAssignTeamRoles ? (
            <TeamRoleAssignmentFields
              tournamentId={tournamentId!}
              teamId={teamId!}
              detail={teamDetail}
              onUpdated={(patch) =>
                setTeamDetail((current) => (current ? { ...current, ...patch } : current))
              }
            />
          ) : null}

          {submitError ? (
            <Text className="font-sans text-sm text-primary">{submitError}</Text>
          ) : null}

          <Button
            label={submitting ? 'Saving…' : 'Save Changes'}
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
        title="Team Updated"
        message="Your team changes have been saved."
        onDismiss={handleSuccessDismiss}
        continueLabel="Continue"
        autoDismissMs={0}
      />
    </SafeAreaView>
  );
}
