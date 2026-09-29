import {
  BALL_TYPE_LABELS,
  BallType,
  CitySelection,
  DEFAULT_VENUE_TIMEZONE,
  KNOCKOUT_TEAM_COUNT_MESSAGES,
  TournamentType,
  UserRole,
  canConfigureKnockoutTeamCount,
  canConfigureKnockoutTeamCountOnCreate,
  firstTournamentFieldError,
  formatTodayDateOnlyInZone,
  resolvesToAplOnCreate,
  sanitizeTournamentFeeInput,
  type TournamentFormFieldErrors,
  type TournamentFormFieldKey,
} from '@acc/types';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { useAuth } from '@/auth/auth-context';
import { QueryErrorCard } from '@/components/QueryErrorCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { centersInProvince, useCenters, useProvinces } from '@/features/geography/use-geography';
import { ApiError, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

import { localIsoDate, TennisDatesField } from './TennisDatesField';
import { CentersField } from './CentersField';
import { CheckboxRow, ChoiceSelect, DateTimeRow, FieldShell, ReadOnlyValue } from './form-fields';
import { LocationField } from './LocationField';
import { PosterField } from './PosterField';
import {
  emptyTournamentForm,
  hydrateTournamentForm,
  knockoutTeamCountOptions,
  numberOfTeamsOptions,
  scopeSelectValue,
  serverFieldErrors,
  toCreateTournamentRequest,
  toUpdateTournamentRequest,
  validateTournamentForm,
  withBallType,
  withProvince,
  withScope,
  yearOptions,
  type TournamentEditContext,
  type TournamentFormValues,
} from './tournament-form';
import {
  uploadTournamentPoster,
  useCreateTournament,
  useTournamentEditForm,
  useTournamentTypeCatalog,
  useUpdateTournament,
} from './tournament-manage-api';

const BALL_TYPE_OPTIONS = [BallType.Tennis, BallType.Leather] as const;

/** Clearing a toggle also clears its fields' errors (mobile clears both together). */
const TOGGLE_FIELDS = {
  hasRegistrationWindow: [
    'registrationOpenDate',
    'registrationOpenTime',
    'registrationCloseDate',
    'registrationCloseTime',
  ],
  hasAuctionDate: ['auctionDate', 'auctionTime'],
  videoRequired: [
    'videoUploadStartDate',
    'videoUploadStartTime',
    'videoUploadEndDate',
    'videoUploadEndTime',
  ],
} as const satisfies Record<
  string,
  readonly (keyof TournamentFormValues & TournamentFormFieldKey)[]
>;

type ToggleKey = keyof typeof TOGGLE_FIELDS;

/** /tournaments/new */
export function CreateTournamentPage(): React.ReactElement {
  return (
    <FormFrame title="Add Tournament" backTo="/tournaments" backLabel="All tournaments">
      <TournamentForm
        existingPosterUrl={null}
        context={null}
        initialValues={null}
        tournamentId={null}
      />
    </FormFrame>
  );
}

/** /tournaments/:tournamentId/edit */
export function EditTournamentPage(): React.ReactElement {
  const { tournamentId = '' } = useParams();
  const editForm = useTournamentEditForm(tournamentId);
  const hydrated = useMemo(
    () => (editForm.data ? hydrateTournamentForm(editForm.data) : null),
    [editForm.data],
  );
  const backTo = `/tournaments/${encodeURIComponent(tournamentId)}`;

  let body: ReactNode;
  if (editForm.isError) {
    body =
      editForm.error instanceof ApiError && editForm.error.status === 403 ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ShieldAlert className="size-8 text-destructive" />
            <div>
              <p className="font-semibold">You can't edit this tournament</p>
              <p className="text-sm text-muted-foreground">{editForm.error.message}</p>
            </div>
            <Button variant="outline" asChild>
              <Link to={backTo}>Back to tournament</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <QueryErrorCard
          title="Couldn't load this tournament"
          error={editForm.error}
          onRetry={() => void editForm.refetch()}
        />
      );
  } else if (!editForm.data || !hydrated) {
    body = (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  } else {
    body = (
      <TournamentForm
        key={editForm.dataUpdatedAt}
        tournamentId={tournamentId}
        initialValues={hydrated.values}
        context={hydrated.context}
        existingPosterUrl={editForm.data.posterUrl}
      />
    );
  }

  return (
    <FormFrame
      title={editForm.data ? `Edit ${editForm.data.name}` : 'Edit Tournament'}
      backTo={backTo}
      backLabel="Back to tournament"
    >
      {body}
    </FormFrame>
  );
}

function FormFrame({
  title,
  backTo,
  backLabel,
  children,
}: {
  title: string;
  backTo: string;
  backLabel: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={backTo}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-secondary">{title}</h1>
      <div className="@container">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function TournamentForm({
  tournamentId,
  initialValues,
  context,
  existingPosterUrl,
}: {
  tournamentId: string | null;
  initialValues: TournamentFormValues | null;
  context: TournamentEditContext | null;
  existingPosterUrl: string | null;
}): React.ReactElement {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = context !== null;
  const provinces = useProvinces();
  const centers = useCenters();

  const [values, setValues] = useState<TournamentFormValues>(
    () => initialValues ?? emptyTournamentForm(),
  );
  const [errors, setErrors] = useState<TournamentFormFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [posterKey, setPosterKey] = useState<string | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(existingPosterUrl);
  const [posterUploading, setPosterUploading] = useState(false);
  const blobUrl = useRef<string | null>(null);

  const createTournament = useCreateTournament();
  const updateTournament = useUpdateTournament(tournamentId ?? '');
  const submitting = createTournament.isPending || updateTournament.isPending;

  const isTennis = values.ballType === BallType.Tennis;
  const isLeather = values.ballType === BallType.Leather;
  const catalog = useTournamentTypeCatalog(values.provinceId, !isEdit && isTennis);
  const provinceCenters = useMemo(
    () => (values.provinceId ? centersInProvince(centers.data ?? [], values.provinceId) : []),
    [centers.data, values.provinceId],
  );

  useEffect(
    () => () => {
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );

  // Default the province to the organizer's own (mobile defaults it from the profile).
  useEffect(() => {
    if (isEdit || values.provinceId || !user || !centers.data) return;
    const own = centers.data.find((center) => center.id === user.centerId);
    if (own) setValues((v) => (v.provinceId ? v : { ...v, provinceId: own.provinceId }));
  }, [isEdit, values.provinceId, user, centers.data]);

  const update = (
    patch: Partial<TournamentFormValues>,
    clear: readonly TournamentFormFieldKey[] = [],
  ) => {
    setValues((v) => ({ ...v, ...patch }));
    if (clear.length > 0) {
      setErrors((e) => {
        const next = { ...e };
        for (const key of clear) delete next[key];
        return next;
      });
    }
  };

  const toggle = (key: ToggleKey, checked: boolean) => {
    const cleared = checked
      ? {}
      : Object.fromEntries(TOGGLE_FIELDS[key].map((field) => [field, '']));
    update({ ...cleared, [key]: checked }, TOGGLE_FIELDS[key]);
  };

  const onPosterPick = async (file: File) => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = URL.createObjectURL(file);
    const previous = posterPreview;
    setPosterPreview(blobUrl.current);
    setPosterUploading(true);
    setErrors((e) => ({ ...e, poster: undefined }));
    try {
      const uploaded = await uploadTournamentPoster(file);
      setPosterKey(uploaded.storageKey);
    } catch (err) {
      setPosterPreview(previous);
      setErrors((e) => ({
        ...e,
        poster: errorMessage(err, 'Could not upload the poster. Please try again.'),
      }));
    } finally {
      setPosterUploading(false);
    }
  };

  const scrollToField = (key: TournamentFormFieldKey) => {
    const el = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.querySelector<HTMLElement>('input, button, [role="combobox"]')?.focus({
      preventScroll: true,
    });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (posterUploading) {
      setErrors((e) => ({ ...e, poster: 'Poster upload in progress. Please wait.' }));
      scrollToField('poster');
      return;
    }
    const hasPoster = posterKey !== null || (isEdit && posterPreview !== null);
    const found = validateTournamentForm(values, hasPoster, context);
    setErrors(found);
    const first = firstTournamentFieldError(found);
    if (first) {
      setFormError('Fix the highlighted fields.');
      scrollToField(first);
      return;
    }
    setFormError(null);
    try {
      const saved =
        context && tournamentId
          ? await updateTournament.mutateAsync(
              toUpdateTournamentRequest(values, context, posterKey),
            )
          : await createTournament.mutateAsync(toCreateTournamentRequest(values, posterKey ?? ''));
      toast.success(context ? `${saved.name} updated` : `${saved.name} created`);
      navigate(`/tournaments/${encodeURIComponent(saved.id)}`);
    } catch (err) {
      const mapped = err instanceof ApiError ? serverFieldErrors(err.fields) : {};
      const firstServer = firstTournamentFieldError(mapped);
      setErrors(mapped);
      setFormError(errorMessage(err, 'Could not save the tournament. Please try again.'));
      if (firstServer) scrollToField(firstServer);
    }
  };

  const provinceOptions = (provinces.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const scopeOptions = [
    ...(catalog.data ?? []).map((entry) => ({ value: entry.id, label: entry.name })),
    { value: CitySelection.Multi, label: 'Multi-centers' },
  ];
  const showKnockout = isEdit
    ? context.tournamentType === TournamentType.APL
    : resolvesToAplOnCreate(values.ballType, values.citySelection);
  const totalTeams = values.numberOfTeams ? Number(values.numberOfTeams) : 0;
  const knockoutReady = isEdit
    ? canConfigureKnockoutTeamCount(context.groupCount, totalTeams)
    : canConfigureKnockoutTeamCountOnCreate(totalTeams);
  const knockoutLocked = isEdit && context.hasKnockoutBracket;
  const leatherMinDate = isEdit ? undefined : formatTodayDateOnlyInZone(DEFAULT_VENUE_TIMEZONE);
  const todayLocal = localIsoDate(new Date());

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-6">
      <Section title="Tournament">
        <PosterField
          previewUrl={posterPreview}
          uploading={posterUploading}
          error={errors.poster}
          onPick={(f) => void onPosterPick(f)}
        />

        <FieldShell id="tournament-name" field="name" label="Tournament Name" error={errors.name}>
          <Input
            id="tournament-name"
            value={values.name}
            onChange={(e) => update({ name: e.target.value }, ['name'])}
            aria-invalid={Boolean(errors.name)}
            maxLength={120}
          />
        </FieldShell>

        <div className="grid gap-5 @lg:grid-cols-2">
          <FieldShell
            id="tournament-ball-type"
            field="ballType"
            label="Ball Type"
            error={errors.ballType}
          >
            {isEdit ? (
              <ReadOnlyValue id="tournament-ball-type">
                {values.ballType ? BALL_TYPE_LABELS[values.ballType] : '—'}
              </ReadOnlyValue>
            ) : (
              <div
                id="tournament-ball-type"
                role="radiogroup"
                aria-label="Ball type"
                className="grid grid-cols-2 gap-2"
              >
                {BALL_TYPE_OPTIONS.map((ballType) => (
                  <button
                    key={ballType}
                    type="button"
                    role="radio"
                    aria-checked={values.ballType === ballType}
                    onClick={() => {
                      if (values.ballType === ballType) return;
                      setValues((v) => withBallType(v, ballType));
                      setErrors({});
                    }}
                    className={cn(
                      'h-9 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors',
                      values.ballType === ballType
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'bg-card hover:bg-muted',
                      errors.ballType && 'border-destructive',
                    )}
                  >
                    {BALL_TYPE_LABELS[ballType]}
                  </button>
                ))}
              </div>
            )}
          </FieldShell>

          <FieldShell id="tournament-year" field="year" label="Tournament Year" error={errors.year}>
            {isEdit ? (
              <ReadOnlyValue id="tournament-year">{values.year}</ReadOnlyValue>
            ) : (
              <ChoiceSelect
                id="tournament-year"
                value={values.year}
                onChange={(year) => update({ year }, ['year'])}
                options={yearOptions().map((y) => ({ value: y, label: y }))}
                placeholder="Select year"
                invalid={Boolean(errors.year)}
              />
            )}
          </FieldShell>
        </div>
      </Section>

      {values.ballType ? (
        <Section title="Schedule & venue">
          {isLeather ? (
            <div className="grid gap-5 @lg:grid-cols-2" data-field="tournamentDates">
              <FieldShell
                id="leather-from"
                field="leatherFromDate"
                label="From Date"
                error={errors.leatherFromDate ?? errors.tournamentDates}
              >
                <Input
                  id="leather-from"
                  type="date"
                  value={values.leatherFromDate}
                  min={leatherMinDate}
                  onChange={(e) =>
                    update({ leatherFromDate: e.target.value }, [
                      'leatherFromDate',
                      'leatherEndDate',
                      'tournamentDates',
                    ])
                  }
                  aria-invalid={Boolean(errors.leatherFromDate)}
                />
              </FieldShell>
              <FieldShell
                id="leather-end"
                field="leatherEndDate"
                label="End Date"
                error={errors.leatherEndDate}
              >
                <Input
                  id="leather-end"
                  type="date"
                  value={values.leatherEndDate}
                  min={values.leatherFromDate || leatherMinDate}
                  onChange={(e) =>
                    update({ leatherEndDate: e.target.value }, [
                      'leatherFromDate',
                      'leatherEndDate',
                      'tournamentDates',
                    ])
                  }
                  aria-invalid={Boolean(errors.leatherEndDate)}
                />
              </FieldShell>
            </div>
          ) : (
            <FieldShell
              id="tournament-dates"
              field="tournamentDates"
              label="Tournament Dates"
              error={errors.tournamentDates}
              hint="Click days to add or remove them."
            >
              <TennisDatesField
                id="tournament-dates"
                value={values.tournamentDates}
                onChange={(tournamentDates) => update({ tournamentDates }, ['tournamentDates'])}
                minDate={todayLocal}
                lockedDates={context?.datesWithMatches}
                invalid={Boolean(errors.tournamentDates)}
              />
            </FieldShell>
          )}

          <FieldShell
            id="tournament-province"
            field="province"
            label="Province"
            error={errors.province}
          >
            <ChoiceSelect
              id="tournament-province"
              value={values.provinceId}
              onChange={(provinceId) => {
                setValues((v) => withProvince(v, provinceId));
                setErrors((e) => ({
                  ...e,
                  province: undefined,
                  citySelection: undefined,
                  centers: undefined,
                }));
              }}
              options={provinceOptions}
              placeholder={provinces.isLoading ? 'Loading provinces…' : 'Select province'}
              disabled={provinces.isLoading}
              invalid={Boolean(errors.province)}
            />
          </FieldShell>

          {isTennis ? (
            isEdit ? (
              <div className="grid gap-5 @lg:grid-cols-2">
                <FieldShell id="tournament-scope" label="Tournament Type">
                  <ReadOnlyValue id="tournament-scope">{context.scopeLabel}</ReadOnlyValue>
                </FieldShell>
                {context.centerNames.length > 0 ? (
                  <FieldShell id="tournament-centers" label="Centers">
                    <ReadOnlyValue id="tournament-centers">
                      {context.centerNames.length === 1
                        ? context.centerNames[0]
                        : `${context.centerNames.length} centers selected`}
                    </ReadOnlyValue>
                  </FieldShell>
                ) : null}
              </div>
            ) : (
              <>
                <FieldShell
                  id="tournament-scope"
                  field="citySelection"
                  label="Tournament Type"
                  error={errors.citySelection}
                  hint={
                    values.provinceId && catalog.isSuccess && catalog.data.length === 0
                      ? 'No tournament types for this province yet — pick Multi-centers or add a type under Geography.'
                      : undefined
                  }
                >
                  <ChoiceSelect
                    id="tournament-scope"
                    value={scopeSelectValue(values)}
                    onChange={(scope) => {
                      setValues((v) => withScope(v, scope, catalog.data ?? []));
                      setErrors((e) => ({ ...e, citySelection: undefined, centers: undefined }));
                    }}
                    options={scopeOptions}
                    placeholder={
                      !values.provinceId
                        ? 'Select a province first'
                        : catalog.isLoading
                          ? 'Loading…'
                          : 'Select scope'
                    }
                    disabled={!values.provinceId || catalog.isLoading}
                    invalid={Boolean(errors.citySelection)}
                  />
                </FieldShell>
                {values.citySelection === CitySelection.Multi ? (
                  <FieldShell
                    id="tournament-centers"
                    field="centers"
                    label="Centers"
                    error={errors.centers}
                    hint={
                      user?.role === UserRole.ClubManager
                        ? 'Center Sevaks of the selected centers will manage this tournament — Club Managers can’t edit or delete a multi-center tournament after it’s created.'
                        : undefined
                    }
                  >
                    <CentersField
                      centers={provinceCenters}
                      value={values.centerIds}
                      onChange={(centerIds) => update({ centerIds }, ['centers'])}
                      invalid={Boolean(errors.centers)}
                    />
                  </FieldShell>
                ) : null}
              </>
            )
          ) : null}

          {isTennis ? (
            <LocationField
              address={values.locationAddress}
              latitude={values.latitude}
              longitude={values.longitude}
              onChange={(locationAddress, latitude, longitude) =>
                update({ locationAddress, latitude, longitude }, ['tournamentLocation'])
              }
              error={errors.tournamentLocation}
            />
          ) : null}
        </Section>
      ) : null}

      <Section title="Teams">
        <div className="grid gap-5 @lg:grid-cols-2">
          <FieldShell
            id="tournament-teams"
            field="numberOfTeams"
            label="Number of Teams"
            error={errors.numberOfTeams}
          >
            <ChoiceSelect
              id="tournament-teams"
              value={values.numberOfTeams}
              onChange={(numberOfTeams) =>
                update({ numberOfTeams }, ['numberOfTeams', 'knockoutTeamCount'])
              }
              options={numberOfTeamsOptions(context?.minTeamCount).map((n) => ({
                value: n,
                label: n,
              }))}
              placeholder="Select number of teams"
              invalid={Boolean(errors.numberOfTeams)}
            />
          </FieldShell>
          <FieldShell
            id="tournament-players"
            field="playersPerTeam"
            label="Players per Team"
            error={errors.playersPerTeam}
          >
            <Input
              id="tournament-players"
              inputMode="numeric"
              placeholder="e.g. 28"
              value={values.playersPerTeam}
              onChange={(e) =>
                update({ playersPerTeam: e.target.value.replace(/\D/g, '').slice(0, 2) }, [
                  'playersPerTeam',
                ])
              }
              aria-invalid={Boolean(errors.playersPerTeam)}
            />
          </FieldShell>
        </div>

        {showKnockout ? (
          <FieldShell
            id="tournament-knockout"
            field="knockoutTeamCount"
            label="Knockout Teams"
            error={errors.knockoutTeamCount}
            hint={
              knockoutLocked
                ? KNOCKOUT_TEAM_COUNT_MESSAGES.locked
                : !knockoutReady
                  ? isEdit
                    ? KNOCKOUT_TEAM_COUNT_MESSAGES.prerequisites
                    : KNOCKOUT_TEAM_COUNT_MESSAGES.prerequisitesCreate
                  : undefined
            }
          >
            {knockoutLocked ? (
              <ReadOnlyValue id="tournament-knockout">
                {values.knockoutTeamCount ?? 'Not set'}
              </ReadOnlyValue>
            ) : (
              <ChoiceSelect
                id="tournament-knockout"
                value={values.knockoutTeamCount}
                onChange={(knockoutTeamCount) =>
                  update({ knockoutTeamCount }, ['knockoutTeamCount'])
                }
                options={knockoutTeamCountOptions(
                  isEdit ? 'edit' : 'create',
                  values.numberOfTeams,
                  context?.groupCount ?? 0,
                ).map((n) => ({ value: n, label: n }))}
                placeholder="Select knockout team count"
                disabled={!knockoutReady}
                invalid={Boolean(errors.knockoutTeamCount)}
              />
            )}
          </FieldShell>
        ) : null}
      </Section>

      <Section title="Registration & fees">
        <CheckboxRow
          id="has-registration-window"
          label="Have Registration Open and Close Date?"
          checked={values.hasRegistrationWindow}
          onChange={(checked) => toggle('hasRegistrationWindow', checked)}
        />
        {values.hasRegistrationWindow ? (
          <div className="space-y-4 border-l-2 border-primary/30 pl-4">
            <DateTimeRow
              idPrefix="registration-open"
              dateField="registrationOpenDate"
              timeField="registrationOpenTime"
              dateLabel="Registration Open Date"
              timeLabel="Open Time"
              date={values.registrationOpenDate}
              time={values.registrationOpenTime}
              onDateChange={(v) => update({ registrationOpenDate: v }, ['registrationOpenDate'])}
              onTimeChange={(v) => update({ registrationOpenTime: v }, ['registrationOpenTime'])}
              dateError={errors.registrationOpenDate}
              timeError={errors.registrationOpenTime}
            />
            <DateTimeRow
              idPrefix="registration-close"
              dateField="registrationCloseDate"
              timeField="registrationCloseTime"
              dateLabel="Registration Close Date"
              timeLabel="Close Time"
              date={values.registrationCloseDate}
              time={values.registrationCloseTime}
              onDateChange={(v) => update({ registrationCloseDate: v }, ['registrationCloseDate'])}
              onTimeChange={(v) => update({ registrationCloseTime: v }, ['registrationCloseTime'])}
              dateError={errors.registrationCloseDate}
              timeError={errors.registrationCloseTime}
              minDate={values.registrationOpenDate || undefined}
            />
          </div>
        ) : null}

        {values.ballType ? (
          <div className="grid gap-5 @lg:grid-cols-2">
            <FeeInput
              id="fee-full-time"
              label={isLeather ? 'Full-time Player Fees' : 'Tournament Fees'}
              value={values.feeFullTime}
              onChange={(feeFullTime) => update({ feeFullTime })}
            />
            {isLeather ? (
              <FeeInput
                id="fee-part-time"
                label="Part-time Player Fees"
                value={values.feePartTime}
                onChange={(feePartTime) => update({ feePartTime })}
              />
            ) : null}
          </div>
        ) : null}
      </Section>

      {isTennis ? (
        <Section title="Tennis options">
          <CheckboxRow
            id="has-auction-date"
            label="Have Auction Date?"
            checked={values.hasAuctionDate}
            onChange={(checked) => toggle('hasAuctionDate', checked)}
          />
          {values.hasAuctionDate ? (
            <div className="border-l-2 border-primary/30 pl-4">
              <DateTimeRow
                idPrefix="auction"
                dateField="auctionDate"
                timeField="auctionTime"
                dateLabel="Auction Date"
                timeLabel="Auction Time"
                date={values.auctionDate}
                time={values.auctionTime}
                onDateChange={(v) => update({ auctionDate: v }, ['auctionDate'])}
                onTimeChange={(v) => update({ auctionTime: v }, ['auctionTime'])}
                dateError={errors.auctionDate}
                timeError={errors.auctionTime}
              />
            </div>
          ) : null}
          <CheckboxRow
            id="impact-player"
            label="Impact Player"
            description="Enable strategic player substitution during the match"
            checked={values.impactPlayerEnabled}
            onChange={(impactPlayerEnabled) => update({ impactPlayerEnabled })}
          />
          <CheckboxRow
            id="video-required"
            label="Video Required?"
            description="Request players to upload their batting/bowling short video"
            checked={values.videoRequired}
            onChange={(checked) => toggle('videoRequired', checked)}
          />
          {values.videoRequired ? (
            <div className="space-y-4 border-l-2 border-primary/30 pl-4">
              <DateTimeRow
                idPrefix="video-start"
                dateField="videoUploadStartDate"
                timeField="videoUploadStartTime"
                dateLabel="Upload Start Date"
                timeLabel="Upload Start Time"
                date={values.videoUploadStartDate}
                time={values.videoUploadStartTime}
                onDateChange={(v) => update({ videoUploadStartDate: v }, ['videoUploadStartDate'])}
                onTimeChange={(v) => update({ videoUploadStartTime: v }, ['videoUploadStartTime'])}
                dateError={errors.videoUploadStartDate}
                timeError={errors.videoUploadStartTime}
              />
              <DateTimeRow
                idPrefix="video-end"
                dateField="videoUploadEndDate"
                timeField="videoUploadEndTime"
                dateLabel="Upload End Date"
                timeLabel="Upload End Time"
                date={values.videoUploadEndDate}
                time={values.videoUploadEndTime}
                onDateChange={(v) => update({ videoUploadEndDate: v }, ['videoUploadEndDate'])}
                onTimeChange={(v) => update({ videoUploadEndTime: v }, ['videoUploadEndTime'])}
                dateError={errors.videoUploadEndDate}
                timeError={errors.videoUploadEndTime}
                minDate={values.videoUploadStartDate || undefined}
              />
            </div>
          ) : null}
        </Section>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pb-8">
        <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || posterUploading}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          {isEdit ? 'Save changes' : 'Create tournament'}
        </Button>
      </div>
    </form>
  );
}

function FeeInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}): React.ReactElement {
  return (
    <FieldShell id={id} label={label}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          inputMode="decimal"
          placeholder="0.00"
          className="pl-7"
          value={value}
          onChange={(e) => onChange(sanitizeTournamentFeeInput(e.target.value))}
        />
      </div>
    </FieldShell>
  );
}
