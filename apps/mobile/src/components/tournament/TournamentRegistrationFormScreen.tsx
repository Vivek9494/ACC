import {
  BattingStyle,
  BallType,
  BATTING_POSITION_OPTIONS,
  BATTING_STYLE_LABELS,
  BOWLING_TYPE_OPTIONS,
  FIELDING_POSITION_OPTIONS,
  isTournamentRegistrationOpen,
  PlayerRegistrationRole,
  PLAYER_REGISTRATION_ROLE_LABELS,
  REGISTRATION_DECLINED_MESSAGE,
  REGISTRATION_PLAYER_TYPE_OPTIONS,
  REGISTRATION_RATING_OPTIONS,
  REGISTRATION_STATUS_LABELS,
  RegistrationPlayerType,
  RegistrationStatus,
  type RegistrationDetail,
  type RegistrationFieldDefinition,
  type SubmitRegistrationRequest,
  type TournamentDetail,
  formatSignupNameInput,
  SIGNUP_NAME_MAX_LENGTH,
  SIGNUP_VALIDATION_MESSAGES,
  validateSignupName,
} from '@acc/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiRequestError,
  getCenters,
  getMyRegistration,
  getProfile,
  getTournament,
  lateRegisterPlayer,
  listRegistrationFields,
  submitRegistration,
} from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { tournamentDetailHref, tournamentSubpathHref } from '../../lib/tournament-detail-route';
import { TOURNAMENT_DETAIL_TAB } from '../../lib/tournament-detail-tabs';
import { Button } from '../ui/Button';
import { KeyboardAwareFormScrollView } from '../ui/KeyboardAwareFormScrollView';
import { ScreenHeader } from '../ui/ScreenHeader';
import { SuccessDialog } from '../ui/SuccessDialog';
import { FIELD_ORANGE } from '../ui/fieldStyles';
import { RadioGroup } from '../ui/RadioGroup';
import { Select, type SelectOption } from '../ui/Select';
import { Text } from '../ui/Text';
import { TextInput } from '../ui/TextInput';

function ratingOptions(options: readonly { value: number; label: string }[]): SelectOption[] {
  return options.map((option) => ({
    value: String(option.value),
    label: option.label,
  }));
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View className="gap-4">
      <Text className="font-sans-semibold text-xs uppercase tracking-wider text-primary">
        {title}
      </Text>
      {children}
    </View>
  );
}

function FormFieldRow({ children }: { children: React.ReactNode }): React.ReactElement {
  return <View className="flex-row items-start gap-3">{children}</View>;
}

export interface TournamentRegistrationFormScreenProps {
  tournamentId: string;
  /** §7.6: Center Sevak registers an own-center player after the window closes. */
  onBehalfOfUserId?: string;
  prefilledFirstName?: string;
  prefilledLastName?: string;
  prefilledCenterId?: string;
  lateRegister?: boolean;
}

/** Player registration form — §7.1 default fields + custom form answers. */
export function TournamentRegistrationFormScreen({
  tournamentId,
  onBehalfOfUserId,
  prefilledFirstName,
  prefilledLastName,
  prefilledCenterId,
  lateRegister = false,
}: TournamentRegistrationFormScreenProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const isLateOnBehalf = lateRegister && Boolean(onBehalfOfUserId);

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [existing, setExisting] = useState<RegistrationDetail | null>(null);
  const [fields, setFields] = useState<RegistrationFieldDefinition[]>([]);
  const [centerOptions, setCenterOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showLateRegisterSuccess, setShowLateRegisterSuccess] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameError, setFirstNameError] = useState<string | undefined>();
  const [lastNameError, setLastNameError] = useState<string | undefined>();
  const [centerId, setCenterId] = useState<string | null>(null);
  const [battingStyle, setBattingStyle] = useState<BattingStyle | null>(null);
  const [playerRole, setPlayerRole] = useState<PlayerRegistrationRole | null>(null);
  const [battingRating, setBattingRating] = useState<string | null>(null);
  const [battingPosition, setBattingPosition] = useState<string | null>(null);
  const [bowlingRating, setBowlingRating] = useState<string | null>(null);
  const [bowlingType, setBowlingType] = useState<string | null>(null);
  const [fieldingRating, setFieldingRating] = useState<string | null>(null);
  const [fieldingPosition, setFieldingPosition] = useState<string | null>(null);
  const [playerType, setPlayerType] = useState<RegistrationPlayerType | null>(null);
  const [custom, setCustom] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    if (!tournamentId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getTournament(tournamentId),
      getProfile(),
      isLateOnBehalf ? Promise.resolve(null) : getMyRegistration(tournamentId),
      listRegistrationFields(tournamentId),
    ])
      .then(async ([tournamentDetail, profile, registration, fieldDefs]) => {
        if (cancelled) {
          return;
        }
        setTournament(tournamentDetail);
        setFields(fieldDefs);
        setExisting(registration);
        setFirstName(prefilledFirstName ?? profile.firstName);
        setLastName(prefilledLastName ?? profile.lastName);
        setCenterId(prefilledCenterId ?? profile.centerId);

        const centers = await getCenters(profile.provinceId);
        if (cancelled) {
          return;
        }
        setCenterOptions(
          centers.map((center) => ({ value: center.id, label: center.name })),
        );

        if (registration) {
          setBattingStyle(registration.battingStyle);
          setPlayerRole(registration.playerRole);
          setBattingRating(
            registration.battingRating === null ? null : String(registration.battingRating),
          );
          setBattingPosition(registration.battingPosition);
          setBowlingRating(
            registration.bowlingRating === null ? null : String(registration.bowlingRating),
          );
          setBowlingType(registration.bowlingType);
          setFieldingRating(
            registration.fieldingRating === null ? null : String(registration.fieldingRating),
          );
          setFieldingPosition(registration.fieldingPosition);
          setPlayerType(registration.playerType);
        }
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : 'Could not load registration.');
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
  }, [tournamentId, isLateOnBehalf, prefilledFirstName, prefilledLastName, prefilledCenterId]);

  const isLeatherBall = tournament?.ballType === BallType.Leather;
  const windowOpen = tournament ? isTournamentRegistrationOpen(tournament) : false;
  const canSubmit = isLateOnBehalf
    ? true
    : windowOpen &&
      existing?.status !== RegistrationStatus.Confirmed &&
      existing?.status !== RegistrationStatus.InWaitlist;

  function validateForm(): string | null {
    const nextFirstNameError = validateSignupName(
      firstName,
      SIGNUP_VALIDATION_MESSAGES.firstName,
    );
    const nextLastNameError = validateSignupName(lastName, SIGNUP_VALIDATION_MESSAGES.lastName);
    setFirstNameError(nextFirstNameError ?? undefined);
    setLastNameError(nextLastNameError ?? undefined);
    if (nextFirstNameError || nextLastNameError) {
      return nextFirstNameError ?? nextLastNameError;
    }
    if (!centerId) {
      return 'Please select your training center.';
    }
    if (!battingStyle) {
      return 'Please select your batting/bowling hand.';
    }
    if (!playerRole) {
      return 'Please select whether you are a batsman, bowler, or all-rounder.';
    }
    if (
      battingRating === null ||
      !battingPosition ||
      bowlingRating === null ||
      !bowlingType
    ) {
      return 'Please complete all skill assessment fields.';
    }
    if (fieldingRating === null || !fieldingPosition) {
      return 'Please complete all fielding fields.';
    }
    if (isLeatherBall && !playerType) {
      return 'Please select your player type.';
    }
    const missing = fields.find((field) => field.required && !custom[field.key]);
    if (missing) {
      return `${missing.label} is required.`;
    }
    return null;
  }

  /** After late register: Leather → Registered Players; Tennis → Verify Players. */
  function navigateAfterLateRegister(): void {
    const destination = isLeatherBall
      ? tournamentSubpathHref(user, tournamentId, 'registered-players')
      : tournamentSubpathHref(user, tournamentId, 'registrations/queue');
    // Pop to destination when it's in the stack; otherwise replace (drops form + picker).
    router.dismissTo(destination);
  }

  async function onSubmit(): Promise<void> {
    if (!tournamentId || !centerId) {
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: SubmitRegistrationRequest = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        centerId,
        battingStyle,
        playerRole,
        battingRating: Number(battingRating),
        battingPosition,
        bowlingType,
        bowlingRating: Number(bowlingRating),
        fieldingRating: Number(fieldingRating),
        fieldingPosition,
        playerType: isLeatherBall ? playerType : null,
        customFields: fields.length > 0 ? custom : null,
      };
      if (isLateOnBehalf && onBehalfOfUserId) {
        await lateRegisterPlayer(tournamentId, { ...payload, userId: onBehalfOfUserId });
        if (isLeatherBall) {
          setShowLateRegisterSuccess(true);
        } else {
          navigateAfterLateRegister();
        }
      } else {
        await submitRegistration(tournamentId, payload);
        router.replace(tournamentDetailHref(user, tournamentId, TOURNAMENT_DETAIL_TAB.Details));
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not submit registration.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={FIELD_ORANGE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScreenHeader
        title={isLateOnBehalf ? 'Register player' : 'Player Registration'}
        subtitle={
          isLateOnBehalf
            ? `Register on behalf of a player for${tournament ? ` ${tournament.name}` : ' this tournament'}. They will be confirmed immediately with the ratings you enter — no separate approval step.`
            : `Complete your profile to join${tournament ? ` ${tournament.name}` : ' this tournament'}.`
        }
        onBack={() => router.back()}
      />
      <KeyboardAwareFormScrollView contentContainerClassName="gap-6 px-4" extraBottomPadding={24}>
        {existing && !isLateOnBehalf ? (
          <View className="gap-1 rounded-control bg-surface-container-high px-4 py-3">
            <Text className="font-sans-medium text-[11px] uppercase tracking-wider text-on-surface-variant">
              Your status
            </Text>
            <Text className="font-sans-bold text-lg text-on-surface">
              {REGISTRATION_STATUS_LABELS[existing.status]}
            </Text>
            {existing.status === RegistrationStatus.Declined ? (
              <Text className="font-sans text-sm text-primary">{REGISTRATION_DECLINED_MESSAGE}</Text>
            ) : null}
          </View>
        ) : null}

        {!windowOpen && !isLateOnBehalf ? (
          <View className="rounded-control bg-surface-container-high px-4 py-3">
            <Text className="font-sans text-sm text-on-surface-variant">
              Registration is not open for this tournament right now.
            </Text>
          </View>
        ) : null}

        {canSubmit ? (
          <View className="gap-6">
            <FormSection title="Personal Information">
              <View className="gap-4">
                <TextInput
                  label="First Name"
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(formatSignupNameInput(text));
                    if (firstNameError) setFirstNameError(undefined);
                  }}
                  autoCapitalize="words"
                  maxLength={SIGNUP_NAME_MAX_LENGTH}
                  error={firstNameError}
                />
                <TextInput
                  label="Last Name"
                  value={lastName}
                  onChangeText={(text) => {
                    setLastName(formatSignupNameInput(text));
                    if (lastNameError) setLastNameError(undefined);
                  }}
                  autoCapitalize="words"
                  maxLength={SIGNUP_NAME_MAX_LENGTH}
                  error={lastNameError}
                />
              </View>
            </FormSection>

            <FormSection title="Game Preferences">
              <View className="gap-4">
                <Select
                  label="Center"
                  placeholder="Select training center"
                  value={centerId}
                  options={centerOptions}
                  onChange={setCenterId}
                  disabled={isLateOnBehalf}
                />
                <Select
                  label="Batting/Bowling Hand"
                  value={battingStyle}
                  options={Object.values(BattingStyle).map((value) => ({
                    value,
                    label: BATTING_STYLE_LABELS[value],
                  }))}
                  onChange={(value) => setBattingStyle(value as BattingStyle)}
                />
                <RadioGroup
                  label="Are you?"
                  horizontal
                  indicatorOnly
                  value={playerRole}
                  onChange={setPlayerRole}
                  options={Object.values(PlayerRegistrationRole).map((value) => ({
                    value,
                    label: PLAYER_REGISTRATION_ROLE_LABELS[value],
                  }))}
                />
                {isLeatherBall ? (
                  <RadioGroup
                    label="Player Type"
                    horizontal
                    value={playerType}
                    onChange={setPlayerType}
                    options={REGISTRATION_PLAYER_TYPE_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                ) : null}
              </View>
            </FormSection>

            <FormSection title="Skill Assessment">
              <View className="gap-4">
                <FormFieldRow>
                  <Select
                    label="Batting Rating"
                    value={battingRating}
                    options={ratingOptions(REGISTRATION_RATING_OPTIONS)}
                    onChange={setBattingRating}
                    containerClassName="min-w-0 flex-1"
                  />
                  <Select
                    label="Batting Position"
                    value={battingPosition}
                    options={BATTING_POSITION_OPTIONS.map((value) => ({ value, label: value }))}
                    onChange={setBattingPosition}
                    containerClassName="min-w-0 flex-1"
                  />
                </FormFieldRow>
                <FormFieldRow>
                  <Select
                    label="Bowling Rating"
                    value={bowlingRating}
                    options={ratingOptions(REGISTRATION_RATING_OPTIONS)}
                    onChange={setBowlingRating}
                    containerClassName="min-w-0 flex-1"
                  />
                  <Select
                    label="Bowling Type"
                    value={bowlingType}
                    options={BOWLING_TYPE_OPTIONS.map((value) => ({ value, label: value }))}
                    onChange={setBowlingType}
                    containerClassName="min-w-0 flex-1"
                  />
                </FormFieldRow>
                <FormFieldRow>
                  <Select
                    label="Fielding Rating"
                    value={fieldingRating}
                    options={ratingOptions(REGISTRATION_RATING_OPTIONS)}
                    onChange={setFieldingRating}
                    containerClassName="min-w-0 flex-1"
                  />
                  <Select
                    label="Fielding Position"
                    value={fieldingPosition}
                    options={FIELDING_POSITION_OPTIONS.map((value) => ({ value, label: value }))}
                    onChange={setFieldingPosition}
                    containerClassName="min-w-0 flex-1"
                  />
                </FormFieldRow>
              </View>
            </FormSection>

            {fields.map((field) => (
              <CustomFieldInput
                key={field.id}
                field={field}
                value={custom[field.key]}
                onChange={(value) => setCustom((prev) => ({ ...prev, [field.key]: value }))}
              />
            ))}

            {error ? (
              <View className="rounded-control bg-primary-50 px-4 py-3">
                <Text className="font-sans text-sm text-primary">{error}</Text>
              </View>
            ) : null}

            <Button
              label={isLateOnBehalf ? 'Register & confirm player' : 'Registration'}
              onPress={() => void onSubmit()}
              disabled={submitting}
              className="h-14 w-full"
            />
          </View>
        ) : null}

        {!canSubmit && error ? (
          <View className="rounded-control bg-primary-50 px-4 py-3">
            <Text className="font-sans text-sm text-primary">{error}</Text>
          </View>
        ) : null}
      </KeyboardAwareFormScrollView>

      <SuccessDialog
        visible={showLateRegisterSuccess}
        title="Player registered"
        message="The player has been added to the registered players list."
        onDismiss={() => {
          setShowLateRegisterSuccess(false);
          navigateAfterLateRegister();
        }}
      />
    </SafeAreaView>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: RegistrationFieldDefinition;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}): React.ReactElement {
  if (field.fieldType === 'BOOLEAN') {
    return (
      <RadioGroup
        label={field.label}
        value={value === true ? 'yes' : value === false ? 'no' : null}
        onChange={(next) => onChange(next === 'yes')}
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]}
      />
    );
  }
  if (field.fieldType === 'SELECT') {
    return (
      <Select
        label={field.label}
        value={typeof value === 'string' ? value : null}
        options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
        onChange={onChange}
      />
    );
  }
  return (
    <TextInput
      label={field.label}
      value={typeof value === 'string' ? value : ''}
      onChangeText={onChange}
      keyboardType={field.fieldType === 'NUMBER' ? 'number-pad' : 'default'}
    />
  );
}
