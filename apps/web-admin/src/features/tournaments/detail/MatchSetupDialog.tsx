import {
  BallType,
  DEFAULT_VENUE_TIMEZONE,
  HOME_AWAY_LABELS,
  HomeAway,
  MATCH_OVERS_PER_INNINGS_OPTIONS,
  MATCH_SCHEDULING_FORMAT_LABELS,
  MATCH_TYPE_SELECT_OPTIONS,
  MatchSchedulingFormat,
  calendarDateFromUtcMidnightIso,
  formatTodayDateOnlyInZone,
  isKnockoutMatchType,
  maxOversPerBowlerOptionsForInnings,
  normalizeTeamPairKey,
  powerplayOversOptionsForInnings,
  type GroupSummary,
  type MatchDetail,
  type MatchType,
  type RoundRobinMatchSetupContext,
  type TournamentDetail,
} from '@acc/types';
import { CalendarDays, Info, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { QueryErrorCard } from '@/components/QueryErrorCard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

import { CheckboxRow, ChoiceSelect, FieldShell, type ChoiceOption } from '../manage/form-fields';
import { LocationField } from '../manage/LocationField';
import {
  emptyMatchSetup,
  hydrateMatchSetup,
  isRoundRobinFormat,
  roundRobinBlockedOpponents,
  serverMatchErrors,
  showGroupFieldFor,
  showLeatherFixtureFields,
  toMatchRequest,
  validateMatchSetup,
  withOvers,
  type MatchSetupContext,
  type MatchSetupErrors,
  type MatchSetupField,
  type MatchSetupValues,
} from './match-setup';
import { formatCalendarDay } from './tournament-details';
import {
  useMatchDetail,
  useMatchMutations,
  useRoundRobinSetup,
  useTournamentGroups,
} from './tournament-detail-api';

export interface MatchSetupDialogProps {
  tournament: TournamentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: MatchSchedulingFormat;
  /** Null = New Match Setup; otherwise the scheduled match being edited. */
  matchId: string | null;
}

/** Web counterpart of the mobile Match Setup screen (schedule or edit an upcoming fixture). */
export function MatchSetupDialog({
  tournament,
  open,
  onOpenChange,
  format,
  matchId,
}: MatchSetupDialogProps): React.ReactElement {
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-2xl">
        {open ? (
          <MatchSetupLoader
            tournament={tournament}
            format={format}
            matchId={matchId}
            onClose={() => onOpenChange(false)}
            onPendingChange={setPending}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MatchSetupLoader({
  tournament,
  format,
  matchId,
  onClose,
  onPendingChange,
}: {
  tournament: TournamentDetail;
  format: MatchSchedulingFormat;
  matchId: string | null;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}): React.ReactElement {
  const match = useMatchDetail(matchId);
  const roundRobin = useRoundRobinSetup(tournament.id, isRoundRobinFormat(format));
  const groupCapable = showGroupFieldFor(tournament, format, null);
  const groupsFallback = useTournamentGroups(
    tournament.id,
    groupCapable && tournament.groups.length === 0,
  );

  const error = match.error ?? roundRobin.error;
  if (error) {
    return (
      <QueryErrorCard
        title="Couldn't load match setup"
        error={error}
        onRetry={() => void Promise.all([match.refetch(), roundRobin.refetch()])}
      />
    );
  }
  const loading =
    (matchId !== null && !match.data) || (isRoundRobinFormat(format) && !roundRobin.data);
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <MatchSetupForm
      tournament={tournament}
      format={format}
      existing={match.data ?? null}
      roundRobin={roundRobin.data ?? null}
      groups={tournament.groups.length > 0 ? tournament.groups : (groupsFallback.data ?? [])}
      onClose={onClose}
      onPendingChange={onPendingChange}
    />
  );
}

const withOption = (
  options: ChoiceOption[],
  value: string | null,
  label: string | null,
): ChoiceOption[] =>
  !value || options.some((o) => o.value === value)
    ? options
    : [...options, { value, label: label ?? 'Unknown' }];

const numberOrNull = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function MatchSetupForm({
  tournament,
  format,
  existing,
  roundRobin,
  groups,
  onClose,
  onPendingChange,
}: {
  tournament: TournamentDetail;
  format: MatchSchedulingFormat;
  existing: MatchDetail | null;
  roundRobin: RoundRobinMatchSetupContext | null;
  groups: readonly GroupSummary[];
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}): React.ReactElement {
  const { create, update } = useMatchMutations(tournament.id);
  const isEdit = existing !== null;
  const [values, setValues] = useState<MatchSetupValues>(() =>
    existing ? hydrateMatchSetup(existing, tournament.teams) : emptyMatchSetup(format),
  );
  const [initialMatchDate] = useState(() => (existing ? values.matchDate || null : null));
  const [errors, setErrors] = useState<MatchSetupErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isLeather = tournament.ballType === BallType.Leather;
  const isTennis = tournament.ballType === BallType.Tennis;
  const isRoundRobin = isRoundRobinFormat(format);
  const timezone = tournament.timezone ?? DEFAULT_VENUE_TIMEZONE;
  const ctx: MatchSetupContext = {
    ballType: tournament.ballType,
    format,
    showGroupField: showGroupFieldFor(tournament, format, values.matchType),
    existingPairKeys: roundRobin?.existingPairKeys ?? [],
    isEdit,
    initialMatchDate,
    timezone,
  };
  const leatherFixture = showLeatherFixtureFields(ctx);

  const set = (patch: Partial<MatchSetupValues>, clear: readonly MatchSetupField[]) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of clear) delete next[key];
      return next;
    });
  };

  const groupOptions = useMemo(() => {
    const options = groups.map((g) => ({ value: g.id, label: g.name }));
    return withOption(options, values.groupId, existing?.groupName ?? null).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [groups, values.groupId, existing?.groupName]);

  const teamOptions = useMemo(() => {
    const inGroup = ctx.showGroupField && values.groupId;
    let options = tournament.teams
      .filter(
        (t) =>
          !inGroup ||
          t.groupId === values.groupId ||
          t.id === values.teamAId ||
          t.id === values.teamBId,
      )
      .map((t) => ({ value: t.id, label: t.name }));
    options = withOption(options, values.teamAId, existing?.homeTeamName ?? null);
    return withOption(options, values.teamBId, existing?.awayTeamName ?? null);
  }, [
    tournament.teams,
    ctx.showGroupField,
    values.groupId,
    values.teamAId,
    values.teamBId,
    existing,
  ]);

  const teamBOptions = useMemo(() => {
    const base = teamOptions.filter((o) => o.value !== values.teamAId);
    if (!isRoundRobin || !values.teamAId) return base;
    const ownPair =
      isEdit && values.teamBId ? normalizeTeamPairKey(values.teamAId, values.teamBId) : null;
    const blocked = roundRobinBlockedOpponents(values.teamAId, ctx.existingPairKeys, ownPair);
    return base.filter((o) => !blocked.has(o.value)).sort((a, b) => a.label.localeCompare(b.label));
  }, [teamOptions, values.teamAId, values.teamBId, isRoundRobin, isEdit, ctx.existingPairKeys]);

  const dateOptions = useMemo(() => {
    const options = [...tournament.dates]
      .sort()
      .map((d) => ({ value: d, label: formatCalendarDay(d) }));
    return withOption(
      options,
      values.matchDate || null,
      values.matchDate ? formatCalendarDay(values.matchDate) : null,
    );
  }, [tournament.dates, values.matchDate]);

  const oversOptions = MATCH_OVERS_PER_INNINGS_OPTIONS.map((o) => ({
    value: String(o.value),
    label: o.label,
  }));
  const perBowlerOptions =
    values.oversPerInnings == null
      ? []
      : maxOversPerBowlerOptionsForInnings(values.oversPerInnings).map((n) => ({
          value: String(n),
          label: `Max ${n} Overs`,
        }));
  const powerplayOptions =
    values.oversPerInnings == null
      ? []
      : powerplayOversOptionsForInnings(values.oversPerInnings).map((n) => ({
          value: String(n),
          label: n === 0 ? '0 (none)' : `${n} Overs`,
        }));
  const oversFirst = (placeholder: string) =>
    values.oversPerInnings == null ? 'Select overs first' : placeholder;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateMatchSetup(values, ctx);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError('Please complete all required fields.');
      return;
    }
    setFormError(null);
    setPending(true);
    onPendingChange(true);
    try {
      const body = toMatchRequest(values, ctx);
      if (existing) await update.mutateAsync({ matchId: existing.id, body });
      else await create.mutateAsync(body);
      toast.success(isEdit ? 'Match updated' : 'Match scheduled');
      onPendingChange(false);
      onClose();
    } catch (err) {
      const mapped = err instanceof ApiError ? serverMatchErrors(err.fields, values.matchType) : {};
      setErrors(mapped);
      setFormError(
        Object.values(mapped)[0] ??
          errorMessage(err, isEdit ? 'Could not update match.' : 'Could not schedule match.'),
      );
      onPendingChange(false);
    } finally {
      setPending(false);
    }
  };

  const formatLabel = MATCH_SCHEDULING_FORMAT_LABELS[format];
  const title = isEdit
    ? 'Edit Match Setup'
    : format === MatchSchedulingFormat.GroupStageKnockout
      ? 'Match Setup'
      : 'New Match Setup';
  const description = isEdit
    ? 'Update the match details below and save your changes.'
    : isRoundRobin
      ? `Tournament: ${tournament.name} ${formatLabel}`
      : format === MatchSchedulingFormat.Manual
        ? `Tournament: ${tournament.name}`
        : `Configure details for the upcoming ${formatLabel} fixture.`;

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <FieldShell id="match-type" label="Match Type" error={errors.matchType}>
        <ChoiceSelect
          id="match-type"
          value={values.matchType}
          onChange={(v) => {
            const matchType: MatchType | null =
              MATCH_TYPE_SELECT_OPTIONS.find((o) => o.value === v)?.value ?? null;
            set(isKnockoutMatchType(matchType) ? { matchType, groupId: null } : { matchType }, [
              'matchType',
              'groupId',
            ]);
          }}
          options={MATCH_TYPE_SELECT_OPTIONS}
          placeholder="Select Match Type"
          invalid={Boolean(errors.matchType)}
        />
      </FieldShell>

      {ctx.showGroupField ? (
        <FieldShell id="match-group" label="Group Name" error={errors.groupId}>
          <ChoiceSelect
            id="match-group"
            value={values.groupId}
            onChange={(groupId) =>
              set(
                groupId === values.groupId
                  ? { groupId }
                  : { groupId, teamAId: null, teamBId: null },
                ['groupId'],
              )
            }
            options={groupOptions}
            placeholder="Select group"
            invalid={Boolean(errors.groupId)}
          />
        </FieldShell>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell id="match-team-a" label="Team A" error={errors.teamAId}>
          <ChoiceSelect
            id="match-team-a"
            value={values.teamAId}
            onChange={(teamAId) => set({ teamAId, teamBId: null }, ['teamAId', 'teamBId'])}
            options={teamOptions}
            placeholder="Select Team A"
            invalid={Boolean(errors.teamAId)}
          />
        </FieldShell>

        {leatherFixture && !values.opponentIsAccTeam ? (
          <FieldShell
            id="match-team-b-name"
            label="Team B Name"
            error={errors.externalOpponentName}
          >
            <Input
              id="match-team-b-name"
              value={values.teamBExternalName}
              onChange={(e) => set({ teamBExternalName: e.target.value }, ['externalOpponentName'])}
              placeholder="Enter Team B name"
              aria-invalid={Boolean(errors.externalOpponentName)}
            />
          </FieldShell>
        ) : (
          <FieldShell id="match-team-b" label="Team B" error={errors.teamBId}>
            <ChoiceSelect
              id="match-team-b"
              value={values.teamBId}
              onChange={(teamBId) => set({ teamBId }, ['teamBId'])}
              options={teamBOptions}
              placeholder="Select Team B"
              invalid={Boolean(errors.teamBId)}
            />
          </FieldShell>
        )}
      </div>

      {leatherFixture ? (
        <CheckboxRow
          id="match-opponent-acc"
          label="Opposite team is an ACC team"
          checked={values.opponentIsAccTeam}
          onChange={(opponentIsAccTeam) =>
            set({ opponentIsAccTeam, teamBId: null, teamBExternalName: '' }, [
              'teamBId',
              'externalOpponentName',
            ])
          }
        />
      ) : null}

      {isLeather ? (
        <LocationField
          id="match-ground"
          label="Ground Location"
          field={null}
          address={values.groundAddress}
          latitude={values.groundLat}
          longitude={values.groundLng}
          onChange={(groundAddress, groundLat, groundLng) =>
            set({ groundAddress, groundLat, groundLng }, ['groundLocation'])
          }
          error={errors.groundLocation}
        />
      ) : null}

      {leatherFixture ? (
        <FieldShell id="match-home-away" label="Home / Away">
          <div
            id="match-home-away"
            role="radiogroup"
            aria-label="Home or Away ground setup responsibility"
            className="grid grid-cols-2 gap-2"
          >
            {[HomeAway.Home, HomeAway.Away].map((side) => (
              <button
                key={side}
                type="button"
                role="radio"
                aria-checked={values.homeAway === side}
                onClick={() => set({ homeAway: side }, [])}
                className={cn(
                  'h-9 rounded-md border px-3 text-sm font-medium shadow-xs transition-colors',
                  values.homeAway === side
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-muted',
                )}
              >
                {HOME_AWAY_LABELS[side]}
              </button>
            ))}
          </div>
        </FieldShell>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell id="match-overs" label="Overs" error={errors.oversPerInnings}>
          <ChoiceSelect
            id="match-overs"
            value={values.oversPerInnings != null ? String(values.oversPerInnings) : null}
            onChange={(v) => {
              setValues((current) => withOvers(current, numberOrNull(v)));
              setErrors((e) => ({
                ...e,
                oversPerInnings: undefined,
                maxOversPerBowler: undefined,
                powerplayOvers: undefined,
                battingPowerplayOvers: undefined,
              }));
            }}
            options={oversOptions}
            placeholder="Select overs"
            invalid={Boolean(errors.oversPerInnings)}
          />
        </FieldShell>
        <FieldShell id="match-powerplay" label="Powerplay Overs" error={errors.powerplayOvers}>
          <ChoiceSelect
            id="match-powerplay"
            value={values.powerplayOvers != null ? String(values.powerplayOvers) : null}
            onChange={(v) => set({ powerplayOvers: numberOrNull(v) }, ['powerplayOvers'])}
            options={powerplayOptions}
            placeholder={oversFirst('Select powerplay overs')}
            disabled={values.oversPerInnings == null}
            invalid={Boolean(errors.powerplayOvers)}
          />
        </FieldShell>
        <FieldShell id="match-per-bowler" label="Overs per Bowler" error={errors.maxOversPerBowler}>
          <ChoiceSelect
            id="match-per-bowler"
            value={values.maxOversPerBowler != null ? String(values.maxOversPerBowler) : null}
            onChange={(v) => set({ maxOversPerBowler: numberOrNull(v) }, ['maxOversPerBowler'])}
            options={perBowlerOptions}
            placeholder={oversFirst('Select max overs')}
            disabled={values.oversPerInnings == null}
            invalid={Boolean(errors.maxOversPerBowler)}
          />
        </FieldShell>
        {isTennis ? (
          <FieldShell
            id="match-batting-powerplay"
            label="Batting Powerplay Overs"
            error={errors.battingPowerplayOvers}
          >
            <ChoiceSelect
              id="match-batting-powerplay"
              value={
                values.battingPowerplayOvers != null ? String(values.battingPowerplayOvers) : null
              }
              onChange={(v) =>
                set({ battingPowerplayOvers: numberOrNull(v) }, ['battingPowerplayOvers'])
              }
              options={powerplayOptions}
              placeholder={oversFirst('Select batting powerplay overs')}
              disabled={values.oversPerInnings == null}
              invalid={Boolean(errors.battingPowerplayOvers)}
            />
          </FieldShell>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldShell id="match-date" label="Match Date" error={errors.matchDate}>
          {isLeather ? (
            <Input
              id="match-date"
              type="date"
              value={values.matchDate}
              min={formatTodayDateOnlyInZone(timezone)}
              max={calendarDateFromUtcMidnightIso(tournament.endAt)}
              onChange={(e) => set({ matchDate: e.target.value }, ['matchDate'])}
              aria-invalid={Boolean(errors.matchDate)}
            />
          ) : (
            <ChoiceSelect
              id="match-date"
              value={values.matchDate || null}
              onChange={(matchDate) => set({ matchDate }, ['matchDate'])}
              options={dateOptions}
              placeholder="Select match day"
              invalid={Boolean(errors.matchDate)}
            />
          )}
        </FieldShell>
        <FieldShell id="match-time" label="Match Time" error={errors.matchTime}>
          <Input
            id="match-time"
            type="time"
            value={values.matchTime}
            onChange={(e) => set({ matchTime: e.target.value }, ['matchTime'])}
            aria-invalid={Boolean(errors.matchTime)}
          />
        </FieldShell>
        {leatherFixture ? (
          <FieldShell id="match-reporting-time" label="Reporting Time" error={errors.reportingTime}>
            <Input
              id="match-reporting-time"
              type="time"
              value={values.reportingTime}
              onChange={(e) => set({ reportingTime: e.target.value }, ['reportingTime'])}
            />
          </FieldShell>
        ) : null}
      </div>

      {isRoundRobin && roundRobin ? <RoundRobinInfo context={roundRobin} /> : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {formError}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <CalendarDays />}
          {pending
            ? isEdit
              ? 'Saving…'
              : 'Scheduling…'
            : isEdit
              ? 'Save Changes'
              : 'Schedule Match'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Round-robin footer card — fixture progress and current standings (mobile RoundRobinSetupInfoCard). */
function RoundRobinInfo({ context }: { context: RoundRobinMatchSetupContext }): React.ReactElement {
  const anyPoints = context.standings.some((row) => row.points > 0);
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="font-semibold">Round Robin Format</p>
        <p className="text-sm text-muted-foreground">
          You are scheduling Match #{context.nextMatchNumber} of the tournament. Each team will play
          against every other team once.
        </p>
      </div>
      <div className="space-y-1.5 rounded-md bg-primary/5 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <Info className="size-4 text-primary" />
          Current Standings
        </p>
        {context.standings.length === 0 ? (
          <p className="text-muted-foreground">No teams in this tournament yet.</p>
        ) : (
          <>
            {anyPoints ? null : <p className="text-muted-foreground">No matches played yet.</p>}
            {context.standings.map((row) => (
              <p key={row.teamId} className={anyPoints ? undefined : 'text-muted-foreground'}>
                {row.teamName} <span className="font-semibold text-primary">{row.points} pts</span>
              </p>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
