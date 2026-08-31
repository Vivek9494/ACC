import type {
  GraphicsCommandMessage,
  GraphicsKind,
  InningsScorecard,
  MatchDetail,
  ScorecardResponse,
} from '@acc/types';
import { createElement, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Pressable, ScrollView, View, type ViewStyle } from 'react-native';

import { Text } from '../../ui/Text';
import { CockpitPanel } from './CockpitPanel';
import { ObsOverlayLinkButton } from './ObsOverlayLinkButton';
import {
  OVERLAY_INNINGS_BREAK_VIEWS,
  OVERLAY_TEAM_ACTIONS,
  anythingOverlayOnAir,
  battingOverlayTeamSide,
  buildOverlayTeamShowCommand,
  buildOverlayWagonWheelOptions,
  EMPTY_OVERLAY_ON_AIR,
  formatOverlayBoundariesLine,
  formatOverlayChaseLine,
  formatOverlayInningsBreakPreview,
  formatOverlayPlayingXiPreview,
  formatOverlayTossLine,
  isCommonGraphicOnAir,
  isInningsBreakOnAir,
  isTeamActionOnAir,
  overlayOnAirLabel,
  parseOverlayWagonWheelKey,
  resolveOverlayTeam,
  teamMatchesInningsBatting,
  teamMatchesInningsBowling,
  type OverlayInningsBreakView,
  type OverlayOnAirState,
  type OverlayTeamAction,
  type OverlayTeamSide,
} from './overlay-control-logic';
import { useGraphicsCommandRelay } from './useGraphicsCommandRelay';

type PickerKind = 'batsman' | 'bowler' | 'batsman_career' | 'bowler_career';

const TILE_GRID: ViewStyle = {
  display: 'grid' as unknown as ViewStyle['display'],
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 6,
};

const VIEW_GRID: ViewStyle = {
  display: 'grid' as unknown as ViewStyle['display'],
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 4,
};

const SELECT_STYLE: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  margin: 0,
  minHeight: 28,
  padding: '2px 6px',
  border: '1px solid rgba(90, 65, 54, 0.25)',
  borderRadius: 5,
  background: '#ffffff',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  color: '#5A4136',
  lineHeight: '22px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function applyIncomingCommand(
  prev: OverlayOnAirState,
  cmd: GraphicsCommandMessage,
): OverlayOnAirState {
  if (cmd.action === 'hide_all') {
    return { ...EMPTY_OVERLAY_ON_AIR };
  }
  if (!cmd.graphic || cmd.graphic === 'hello') {
    return prev;
  }
  if (cmd.graphic === 'toss') {
    if (cmd.action === 'show') {
      return { ...prev, stripMode: 'toss' };
    }
    if (cmd.action === 'hide' && prev.stripMode === 'toss') {
      return { ...prev, stripMode: 'default' };
    }
    return prev;
  }
  if (cmd.graphic === 'chase') {
    if (cmd.action === 'show') {
      return { ...prev, stripMode: 'chase' };
    }
    if (cmd.action === 'hide' && prev.stripMode === 'chase') {
      return { ...prev, stripMode: 'default' };
    }
    return prev;
  }
  // Momentary strip flash — never latch in cockpit on-air state.
  if (cmd.graphic === 'boundaries') {
    return prev;
  }
  if (cmd.action === 'show') {
    const variant = cmd.payload?.variant ?? 'both';
    const source = cmd.payload?.source === 'scorecard' ? 'scorecard' : 'break';
    return {
      ...prev,
      graphic: cmd.graphic,
      playingXiVariant: variant,
      inningsSource: cmd.graphic === 'innings_break' ? source : prev.inningsSource,
      teamSide: null,
      teamAction: null,
      stripMode: prev.stripMode,
    };
  }
  if (cmd.action === 'hide' && prev.graphic === cmd.graphic) {
    return {
      ...prev,
      graphic: null,
      teamSide: null,
      teamAction: null,
      playingXiVariant: 'both',
      inningsSource: 'break',
    };
  }
  return prev;
}

/** Collapsed native `<select>` — one line; opens on click (web cockpit only). */
function PlayerSelect({
  options,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder: string;
}): React.ReactElement {
  const isDisabled = Boolean(disabled) || options.length === 0;
  const selectedLabel =
    options.find((o) => o.id === value)?.label ?? placeholder;
  const optionNodes =
    options.length === 0
      ? [createElement('option', { key: '_empty', value: '' }, placeholder)]
      : options.map((opt) =>
          createElement('option', { key: opt.id, value: opt.id }, opt.label),
        );

  return createElement(
    'div',
    {
      style: {
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
      },
    },
    createElement(
      'select',
      {
        value: isDisabled ? '' : value,
        disabled: isDisabled,
        'aria-label': placeholder,
        title: selectedLabel,
        onChange: (e: ChangeEvent<HTMLSelectElement>) => {
          onChange(e.target.value);
        },
        style: {
          ...SELECT_STYLE,
          opacity: isDisabled ? 0.45 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        },
      },
      optionNodes,
    ),
  );
}

function ControlTile({
  title,
  onAir,
  enabled,
  onPress,
  children,
}: {
  title: string;
  onAir: boolean;
  enabled: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}): React.ReactElement {
  const canPress = onAir || enabled;
  return (
    <View
      className={`min-w-0 gap-0.5 overflow-hidden rounded border px-1 py-1 ${
        onAir ? 'border-primary bg-primary-50' : 'border-outline-variant bg-surface'
      }`}
    >
      <View className="min-w-0 flex-row items-center gap-0.5">
        <Text
          className="min-w-0 flex-1 font-sans-semibold text-[12px] text-on-surface"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {onAir ? (
          <Text className="shrink-0 rounded bg-primary px-1 py-0.5 font-sans-bold text-[8px] uppercase tracking-wide text-on-primary">
            On air
          </Text>
        ) : null}
      </View>
      {children}
      <Pressable
        onPress={onPress}
        disabled={!canPress}
        accessibilityRole="button"
        accessibilityLabel={onAir ? `Hide ${title}` : `Show ${title}`}
        className={`mt-auto min-h-[32px] items-center justify-center rounded border px-1.5 py-1.5 ${
          onAir
            ? 'border-primary bg-primary'
            : enabled
              ? 'border-outline-variant bg-surface-container-low'
              : 'border-outline-variant bg-surface-container-low opacity-45'
        }`}
      >
        <Text
          className={`font-sans-bold text-[12px] ${
            onAir ? 'text-on-primary' : 'text-on-surface-variant'
          }`}
        >
          {onAir ? 'Hide' : 'Show'}
        </Text>
      </Pressable>
    </View>
  );
}

export function OverlayControlPanel({
  matchId,
  match,
  card,
  innings,
  nameOf,
}: {
  matchId: string;
  match: MatchDetail;
  card: ScorecardResponse;
  innings: InningsScorecard;
  nameOf: (id: string | null) => string;
}): React.ReactElement {
  const { status, emit, lastCommand } = useGraphicsCommandRelay(matchId);
  const defaultSide = battingOverlayTeamSide(match, innings);
  const [teamSide, setTeamSide] = useState<OverlayTeamSide>(defaultSide);
  const [onAir, setOnAir] = useState<OverlayOnAirState>(EMPTY_OVERLAY_ON_AIR);
  const [inningsView, setInningsView] = useState<OverlayInningsBreakView>('batting');
  const [wagonKey, setWagonKey] = useState('');
  const [obsLinkFeedback, setObsLinkFeedback] = useState<{
    url: string;
    copied: boolean;
  } | null>(null);
  const [picks, setPicks] = useState<Record<PickerKind, string>>({
    batsman: '',
    bowler: '',
    batsman_career: '',
    bowler_career: '',
  });

  // Keep team toggle on the batting side when the innings batting side changes.
  useEffect(() => {
    setTeamSide(battingOverlayTeamSide(match, innings));
  }, [match, innings.battingTeamId, innings.battingIsExternal, innings.inningsId]);

  useEffect(() => {
    if (!lastCommand) {
      return;
    }
    setOnAir((prev) => applyIncomingCommand(prev, lastCommand));
    if (
      lastCommand.action === 'show' &&
      lastCommand.graphic === 'innings_break' &&
      lastCommand.payload?.view
    ) {
      setInningsView(lastCommand.payload.view);
    }
  }, [lastCommand]);

  const teamA = useMemo(() => resolveOverlayTeam(match, 'a'), [match]);
  const teamB = useMemo(() => resolveOverlayTeam(match, 'b'), [match]);
  const selectedTeam = teamSide === 'a' ? teamA : teamB;

  const battingNow = teamMatchesInningsBatting(selectedTeam, innings);
  const bowlingNow = teamMatchesInningsBowling(selectedTeam, innings);

  const batsmanOptions = useMemo(() => {
    if (!battingNow) {
      return [] as { id: string; label: string }[];
    }
    const ids = [innings.currentStrikerId, innings.currentNonStrikerId].filter(
      (id): id is string => Boolean(id),
    );
    return ids.map((id) => {
      const row = innings.batters.find((b) => b.playerId === id);
      const role =
        id === innings.currentStrikerId
          ? 'Striker'
          : id === innings.currentNonStrikerId
            ? 'Non-striker'
            : null;
      return {
        id,
        label: [nameOf(id), row ? `${row.runs} (${row.balls})` : null, role]
          .filter(Boolean)
          .join(' · '),
      };
    });
  }, [battingNow, innings, nameOf]);

  const bowlerOptions = useMemo(() => {
    if (!bowlingNow) {
      return [] as { id: string; label: string }[];
    }
    const ordered: string[] = [];
    if (innings.currentBowlerId) {
      ordered.push(innings.currentBowlerId);
    }
    for (const b of innings.bowlers) {
      if (!ordered.includes(b.playerId)) {
        ordered.push(b.playerId);
      }
    }
    return ordered.map((id) => {
      const row = innings.bowlers.find((b) => b.playerId === id);
      return {
        id,
        label: [
          nameOf(id),
          row ? `${row.oversText}-${row.runsConceded}-${row.wickets}` : null,
          id === innings.currentBowlerId ? 'Current' : null,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    });
  }, [bowlingNow, innings, nameOf]);

  const careerOptions = useMemo(() => {
    if (selectedTeam.isExternal) {
      return match.externalPlayers.map((p) => ({
        id: p.id,
        label: p.name.trim() || 'External',
      }));
    }
    if (!selectedTeam.teamId) {
      return [] as { id: string; label: string }[];
    }
    const squad = match.squads.find((s) => s.teamId === selectedTeam.teamId);
    const xi = (squad?.players ?? []).filter((p) => p.role === 'PLAYING_XI');
    return xi.map((p) => ({
      id: p.userId,
      label: nameOf(p.userId),
    }));
  }, [match.externalPlayers, match.squads, nameOf, selectedTeam]);

  // Seed pickers when options change.
  useEffect(() => {
    setPicks((prev) => ({
      batsman: batsmanOptions.some((o) => o.id === prev.batsman)
        ? prev.batsman
        : (batsmanOptions[0]?.id ?? ''),
      bowler: bowlerOptions.some((o) => o.id === prev.bowler)
        ? prev.bowler
        : (bowlerOptions[0]?.id ?? ''),
      batsman_career: careerOptions.some((o) => o.id === prev.batsman_career)
        ? prev.batsman_career
        : (innings.currentStrikerId &&
          careerOptions.some((o) => o.id === innings.currentStrikerId)
            ? innings.currentStrikerId
            : (careerOptions[0]?.id ?? '')),
      bowler_career: careerOptions.some((o) => o.id === prev.bowler_career)
        ? prev.bowler_career
        : (innings.currentBowlerId &&
          careerOptions.some((o) => o.id === innings.currentBowlerId)
            ? innings.currentBowlerId
            : (careerOptions[0]?.id ?? '')),
    }));
  }, [batsmanOptions, bowlerOptions, careerOptions, innings.currentBowlerId, innings.currentStrikerId]);

  const tossLine = formatOverlayTossLine(match);
  const chaseLine = formatOverlayChaseLine(card, innings);
  const boundariesLine = formatOverlayBoundariesLine(innings);
  const xiPreview = formatOverlayPlayingXiPreview(match);
  const inningsBreakPreview = formatOverlayInningsBreakPreview(card);
  const inningsBreakLive = isInningsBreakOnAir(onAir);
  const wagonOptions = useMemo(
    () => buildOverlayWagonWheelOptions(card, innings, nameOf),
    [card, innings, nameOf],
  );
  const wagonLive = isCommonGraphicOnAir(onAir, 'wagon_wheel');
  const live = anythingOverlayOnAir(onAir);
  useEffect(() => {
    if (!obsLinkFeedback) {
      return;
    }
    const timer = setTimeout(() => setObsLinkFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [obsLinkFeedback]);

  // Keep wagon dropdown on a valid option as shot list changes.
  useEffect(() => {
    setWagonKey((prev) =>
      wagonOptions.some((o) => o.key === prev) ? prev : (wagonOptions[0]?.key ?? ''),
    );
  }, [wagonOptions]);

  const connLabel =
    status === 'live' ? 'Relay live' : status === 'connecting' ? 'Connecting…' : 'Relay offline';

  function setLocalOnAir(
    graphic: GraphicsKind | null,
    side: OverlayTeamSide | null,
    action: OverlayTeamAction | null,
    variant: OverlayOnAirState['playingXiVariant'] = 'both',
    inningsSource: OverlayOnAirState['inningsSource'] = 'break',
  ): void {
    setOnAir((prev) => ({
      ...prev,
      graphic,
      teamSide: side,
      teamAction: action,
      playingXiVariant: variant,
      inningsSource,
    }));
  }

  function hideGraphic(graphic: GraphicsKind): void {
    emit({ action: 'hide', graphic });
    setOnAir((prev) => {
      if (prev.graphic !== graphic) {
        return prev;
      }
      return {
        ...prev,
        graphic: null,
        teamSide: null,
        teamAction: null,
        playingXiVariant: 'both',
        inningsSource: 'break',
      };
    });
  }

  function hideStrip(mode: 'toss' | 'chase'): void {
    emit({ action: 'hide', graphic: mode });
    setOnAir((prev) =>
      prev.stripMode === mode ? { ...prev, stripMode: 'default' } : prev,
    );
  }

  function showInningsBreak(view: OverlayInningsBreakView = inningsView): void {
    emit({
      action: 'show',
      graphic: 'innings_break',
      payload: { view, source: 'break' },
    });
    setLocalOnAir('innings_break', null, null, 'both', 'break');
  }

  function selectInningsView(view: OverlayInningsBreakView): void {
    setInningsView(view);
    // Same graphic, switch view while already on air (mirrors overlay control tabs).
    if (isInningsBreakOnAir(onAir)) {
      showInningsBreak(view);
    }
  }

  function showTeamAction(action: OverlayTeamAction): void {
    if (isTeamActionOnAir(onAir, teamSide, action)) {
      const graphic =
        action === 'playing_xi' || action === 'batting_lineup'
          ? 'playing_xi'
          : action === 'bowling' || action === 'partnerships'
            ? 'innings_break'
            : action;
      hideGraphic(graphic);
      return;
    }

    const playerId =
      action === 'batsman' ||
      action === 'bowler' ||
      action === 'batsman_career' ||
      action === 'bowler_career'
        ? picks[action]
        : null;
    const cmd = buildOverlayTeamShowCommand(action, selectedTeam, card, match, playerId);
    if (!cmd) {
      return;
    }
    emit(cmd);
    if (action === 'bowling' || action === 'partnerships') {
      setLocalOnAir('innings_break', teamSide, action, 'both', 'scorecard');
      return;
    }
    if (action === 'playing_xi') {
      setLocalOnAir('playing_xi', teamSide, action, 'single');
      return;
    }
    if (action === 'batting_lineup') {
      setLocalOnAir('playing_xi', teamSide, action, 'lineup');
      return;
    }
    setLocalOnAir(action, teamSide, action);
  }

  function teamActionEnabled(action: OverlayTeamAction): boolean {
    const playerId =
      action === 'batsman' ||
      action === 'bowler' ||
      action === 'batsman_career' ||
      action === 'bowler_career'
        ? picks[action]
        : null;
    return buildOverlayTeamShowCommand(action, selectedTeam, card, match, playerId) != null;
  }

  function pickerFor(action: OverlayTeamAction): React.ReactNode {
    if (action === 'batsman') {
      return (
        <PlayerSelect
          options={batsmanOptions}
          value={picks.batsman}
          onChange={(id) => setPicks((p) => ({ ...p, batsman: id }))}
          disabled={!battingNow}
          placeholder="Team not batting…"
        />
      );
    }
    if (action === 'bowler') {
      return (
        <PlayerSelect
          options={bowlerOptions}
          value={picks.bowler}
          onChange={(id) => setPicks((p) => ({ ...p, bowler: id }))}
          disabled={!bowlingNow}
          placeholder="Team not bowling…"
        />
      );
    }
    if (action === 'batsman_career') {
      return (
        <PlayerSelect
          options={careerOptions}
          value={picks.batsman_career}
          onChange={(id) => setPicks((p) => ({ ...p, batsman_career: id }))}
          disabled={careerOptions.length === 0}
          placeholder={selectedTeam.isExternal ? 'External roster…' : 'No Playing XI…'}
        />
      );
    }
    if (action === 'bowler_career') {
      return (
        <PlayerSelect
          options={careerOptions}
          value={picks.bowler_career}
          onChange={(id) => setPicks((p) => ({ ...p, bowler_career: id }))}
          disabled={careerOptions.length === 0}
          placeholder={selectedTeam.isExternal ? 'External roster…' : 'No Playing XI…'}
        />
      );
    }
    return null;
  }

  return (
    <CockpitPanel
      title="Overlay Control"
      live={status === 'live'}
      badge={live ? 'ON AIR' : undefined}
      headerTrailing={
        <ObsOverlayLinkButton
          matchId={matchId}
          onCopied={(url, copied) => setObsLinkFeedback({ url, copied })}
        />
      }
      bodyNoPad
      bodyAbsolute
    >
      <View className="min-h-0 flex-1">
        {obsLinkFeedback ? (
          <View
            className="mx-2 mt-1 rounded border border-primary bg-primary-50 px-2 py-1"
            accessibilityLiveRegion="polite"
          >
            <Text className="font-sans-bold text-[10px] text-primary">
              {obsLinkFeedback.copied ? 'Copied!' : 'Copy failed — select manually'}
            </Text>
            <Text className="font-sans text-[9px] leading-snug text-on-surface-variant" selectable>
              {obsLinkFeedback.url}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center gap-2 border-b border-outline-variant px-2 py-1.5">
          <Text
            className="min-w-0 flex-1 font-sans text-[12px] text-on-surface-variant"
            numberOfLines={2}
          >
            {overlayOnAirLabel(onAir, match)}
          </Text>
          <Text className="font-sans text-[11px] text-on-surface-variant">{connLabel}</Text>
          <Pressable
            onPress={() => {
              if (!anythingOverlayOnAir(onAir)) {
                return;
              }
              emit({ action: 'hide_all' });
              setOnAir({ ...EMPTY_OVERLAY_ON_AIR });
            }}
            disabled={!live}
            accessibilityRole="button"
            accessibilityLabel="Take off air"
            className={`rounded border px-2 py-1 ${
              live ? 'border-secondary bg-secondary-50' : 'border-outline-variant opacity-40'
            }`}
          >
            <Text
              className={`font-sans-bold text-[11px] ${live ? 'text-secondary' : 'text-on-surface-variant'}`}
            >
              Take off air
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="min-h-0 flex-1"
          contentContainerClassName="gap-2 px-2 py-2"
          showsVerticalScrollIndicator
        >
          <View className="flex-row gap-1">
            {([teamA, teamB] as const).map((team) => {
              const selected = teamSide === team.side;
              return (
                <Pressable
                  key={team.side}
                  onPress={() => setTeamSide(team.side)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`min-w-0 flex-1 rounded border px-2 py-1.5 ${
                    selected
                      ? 'border-primary bg-primary-50'
                      : 'border-outline-variant bg-surface-container-lowest'
                  }`}
                >
                  <Text
                    className={`text-center font-sans-semibold text-[12px] ${
                      selected ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                    numberOfLines={1}
                  >
                    {team.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={TILE_GRID}>
            {OVERLAY_TEAM_ACTIONS.map((row) => {
              const rowOnAir = isTeamActionOnAir(onAir, teamSide, row.action);
              return (
                <ControlTile
                  key={row.action}
                  title={row.label}
                  onAir={rowOnAir}
                  enabled={teamActionEnabled(row.action)}
                  onPress={() => showTeamAction(row.action)}
                >
                  {row.needsPicker ? pickerFor(row.action) : null}
                </ControlTile>
              );
            })}
          </View>

          <Text className="mt-0.5 font-sans-semibold text-[11px] uppercase tracking-wider text-on-surface-variant">
            Common
          </Text>

          <View
            className={`min-w-0 gap-1.5 overflow-hidden rounded border px-2 py-2 ${
              inningsBreakLive
                ? 'border-primary bg-primary-50'
                : 'border-outline-variant bg-surface'
            }`}
          >
            <View className="min-w-0 flex-row items-center gap-1.5">
              <Text
                className="shrink-0 font-sans-semibold text-[12px] text-on-surface"
                numberOfLines={1}
              >
                Innings break
              </Text>
              <Text
                className="min-w-0 flex-1 font-sans text-[11px] text-on-surface-variant"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {inningsBreakPreview ?? 'Waiting for innings…'}
              </Text>
              {inningsBreakLive ? (
                <Text className="shrink-0 rounded bg-primary px-1 py-0.5 font-sans-bold text-[8px] uppercase tracking-wide text-on-primary">
                  On air
                </Text>
              ) : null}
            </View>

            <Pressable
              onPress={() => {
                if (inningsBreakLive) {
                  hideGraphic('innings_break');
                  return;
                }
                if (!inningsBreakPreview) {
                  return;
                }
                showInningsBreak();
              }}
              disabled={!inningsBreakLive && !inningsBreakPreview}
              accessibilityRole="button"
              accessibilityLabel={
                inningsBreakLive ? 'Hide innings break' : 'Show innings break'
              }
              className={`min-h-[32px] items-center justify-center rounded border px-2 py-1.5 ${
                inningsBreakLive
                  ? 'border-primary bg-primary'
                  : inningsBreakPreview
                    ? 'border-outline-variant bg-surface-container-low'
                    : 'border-outline-variant bg-surface-container-low opacity-45'
              }`}
            >
              <Text
                className={`font-sans-bold text-[12px] ${
                  inningsBreakLive ? 'text-on-primary' : 'text-on-surface-variant'
                }`}
              >
                {inningsBreakLive ? 'Hide innings break' : 'Show innings break'}
              </Text>
            </Pressable>

            <View style={VIEW_GRID}>
              {OVERLAY_INNINGS_BREAK_VIEWS.map((tab) => {
                const selected = inningsView === tab.view;
                return (
                  <Pressable
                    key={tab.view}
                    onPress={() => selectInningsView(tab.view)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`min-w-0 items-center justify-center rounded border px-1 py-1.5 ${
                      selected
                        ? 'border-primary bg-primary-50'
                        : 'border-outline-variant bg-surface-container-lowest'
                    }`}
                  >
                    <Text
                      className={`text-center font-sans-semibold text-[10px] ${
                        selected ? 'text-primary' : 'text-on-surface-variant'
                      }`}
                      numberOfLines={2}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View
            className={`min-w-0 gap-1.5 overflow-hidden rounded border px-2 py-2 ${
              wagonLive ? 'border-primary bg-primary-50' : 'border-outline-variant bg-surface'
            }`}
          >
            <View className="min-w-0 flex-row items-center gap-1.5">
              <Text
                className="min-w-0 flex-1 font-sans-semibold text-[12px] text-on-surface"
                numberOfLines={1}
              >
                Wagon Wheel
              </Text>
              {wagonLive ? (
                <Text className="shrink-0 rounded bg-primary px-1 py-0.5 font-sans-bold text-[8px] uppercase tracking-wide text-on-primary">
                  On air
                </Text>
              ) : null}
            </View>

            {createElement(
              'div',
              {
                style: {
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  overflow: 'hidden',
                },
              },
              createElement(
                'select',
                {
                  value: wagonKey,
                  disabled: wagonOptions.length === 0,
                  'aria-label': 'Wagon wheel subject',
                  onChange: (e: ChangeEvent<HTMLSelectElement>) => {
                    setWagonKey(e.target.value);
                  },
                  style: {
                    ...SELECT_STYLE,
                    opacity: wagonOptions.length === 0 ? 0.45 : 1,
                    cursor: wagonOptions.length === 0 ? 'not-allowed' : 'pointer',
                  },
                },
                wagonOptions.length === 0
                  ? [
                      createElement(
                        'option',
                        { key: '_empty', value: '' },
                        'No shot placements yet…',
                      ),
                    ]
                  : [
                      ...wagonOptions
                        .filter((o) => o.subject === 'team')
                        .map((o) =>
                          createElement('option', { key: o.key, value: o.key }, o.label),
                        ),
                      createElement(
                        'option',
                        { key: '_div', value: '', disabled: true },
                        '────────',
                      ),
                      ...wagonOptions
                        .filter((o) => o.subject !== 'team')
                        .map((o) =>
                          createElement('option', { key: o.key, value: o.key }, o.label),
                        ),
                    ],
              ),
            )}

            <Pressable
              onPress={() => {
                if (wagonLive) {
                  hideGraphic('wagon_wheel');
                  return;
                }
                const parsed = parseOverlayWagonWheelKey(wagonKey);
                if (!parsed) {
                  return;
                }
                emit({
                  action: 'show',
                  graphic: 'wagon_wheel',
                  payload: {
                    subject: parsed.subject,
                    filter: parsed.filter,
                  },
                });
                setLocalOnAir('wagon_wheel', null, null);
              }}
              disabled={!wagonLive && !parseOverlayWagonWheelKey(wagonKey)}
              accessibilityRole="button"
              accessibilityLabel={wagonLive ? 'Hide wagon wheel' : 'Show wagon wheel'}
              className={`min-h-[32px] items-center justify-center rounded border px-2 py-1.5 ${
                wagonLive
                  ? 'border-primary bg-primary'
                  : parseOverlayWagonWheelKey(wagonKey)
                    ? 'border-outline-variant bg-surface-container-low'
                    : 'border-outline-variant bg-surface-container-low opacity-45'
              }`}
            >
              <Text
                className={`font-sans-bold text-[12px] ${
                  wagonLive ? 'text-on-primary' : 'text-on-surface-variant'
                }`}
              >
                {wagonLive ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>

          <View style={TILE_GRID}>
            <ControlTile
              title="Toss"
              onAir={isCommonGraphicOnAir(onAir, 'toss')}
              enabled={tossLine != null}
              onPress={() => {
                if (isCommonGraphicOnAir(onAir, 'toss')) {
                  hideStrip('toss');
                  return;
                }
                if (!tossLine) {
                  return;
                }
                emit({ action: 'show', graphic: 'toss' });
                setOnAir((p) => ({ ...p, stripMode: 'toss' }));
              }}
            >
              <Text className="font-sans text-[11px] text-on-surface-variant" numberOfLines={2}>
                {tossLine ?? 'Toss not recorded yet'}
              </Text>
            </ControlTile>

            <ControlTile
              title="Runs to win"
              onAir={isCommonGraphicOnAir(onAir, 'chase')}
              enabled={chaseLine != null}
              onPress={() => {
                if (isCommonGraphicOnAir(onAir, 'chase')) {
                  hideStrip('chase');
                  return;
                }
                if (!chaseLine) {
                  return;
                }
                emit({ action: 'show', graphic: 'chase' });
                setOnAir((p) => ({ ...p, stripMode: 'chase' }));
              }}
            >
              <Text className="font-sans text-[11px] text-on-surface-variant" numberOfLines={2}>
                {chaseLine ?? 'No chase yet'}
              </Text>
            </ControlTile>

            <ControlTile
              title="Boundaries"
              onAir={false}
              enabled
              onPress={() => {
                // Momentary strip flash — never latches on-air / never becomes Hide.
                emit({ action: 'show', graphic: 'boundaries' });
              }}
            >
              <Text className="font-sans text-[11px] text-on-surface-variant" numberOfLines={2}>
                {boundariesLine} · flash then revert
              </Text>
            </ControlTile>

            <ControlTile
              title="Both teams XI"
              onAir={isCommonGraphicOnAir(onAir, 'playing_xi')}
              enabled={xiPreview != null}
              onPress={() => {
                if (isCommonGraphicOnAir(onAir, 'playing_xi')) {
                  hideGraphic('playing_xi');
                  return;
                }
                if (!xiPreview) {
                  return;
                }
                emit({
                  action: 'show',
                  graphic: 'playing_xi',
                  payload: { variant: 'both' },
                });
                setLocalOnAir('playing_xi', null, null, 'both');
              }}
            >
              <Text className="font-sans text-[11px] text-on-surface-variant" numberOfLines={2}>
                {xiPreview ?? 'Waiting for squads…'}
              </Text>
            </ControlTile>

            <ControlTile
              title="Toss result"
              onAir={isCommonGraphicOnAir(onAir, 'toss_result')}
              enabled={tossLine != null}
              onPress={() => {
                if (isCommonGraphicOnAir(onAir, 'toss_result')) {
                  hideGraphic('toss_result');
                  return;
                }
                if (!tossLine) {
                  return;
                }
                emit({ action: 'show', graphic: 'toss_result' });
                setLocalOnAir('toss_result', null, null);
              }}
            >
              <Text className="font-sans text-[11px] text-on-surface-variant" numberOfLines={2}>
                {tossLine ?? 'Toss not recorded yet'}
              </Text>
            </ControlTile>
          </View>
        </ScrollView>
      </View>
    </CockpitPanel>
  );
}
