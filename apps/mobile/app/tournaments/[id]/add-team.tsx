import { Ionicons } from '@expo/vector-icons';
import {
  TEAM_FORM_MESSAGES,
  TEAM_NAME_MAX_LENGTH,
  normalizeTeamName,
  validateTeamName,
} from '@acc/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { FIELD_ORANGE } from '../../../src/components/ui/fieldStyles';
import { ProfileMenu } from '../../../src/components/ui/ProfileMenu';
import { SuccessDialog } from '../../../src/components/ui/SuccessDialog';
import { TeamLogoField } from '../../../src/components/ui/TeamLogoField';
import { Text } from '../../../src/components/ui/Text';
import { TextInput } from '../../../src/components/ui/TextInput';
import { ApiRequestError, createTeam, listTeams, uploadTeamLogo } from '../../../src/lib/api';
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

  const [teamName, setTeamName] = useState('');
  const [logo, setLogo] = useState<StoredImageFile | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const previewUri = logo?.uri ?? null;

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
      const remoteUrl = await uploadTeamLogo(uploadUri);
      setLogo({ ...file, uri: remoteUrl, remoteUrl });
    } catch (err) {
      setLogo(null);
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

    setSubmitting(true);
    try {
      await createTeam(tournamentId, {
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
        setSubmitError('Could not add team.');
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
        params: { id: tournamentId, tab: 'Teams' },
      });
    } else {
      router.back();
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
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
      >
        <ScrollView
          contentContainerClassName="gap-6 px-4 pb-12 pt-2"
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text className="font-sans-bold text-2xl text-on-surface">Add Team</Text>
            <Text className="mt-1 font-sans text-base text-on-surface-variant">
              Upload logo and name your team
            </Text>
          </View>

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

          {submitError ? (
            <Text className="font-sans text-sm text-primary">{submitError}</Text>
          ) : null}

          <Button
            label={submitting ? 'Adding…' : 'Add Team'}
            onPress={() => void handleSubmit()}
            disabled={submitting || logoUploading}
            className="h-14 w-full"
          />
        </ScrollView>
      </KeyboardAvoidingView>

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
