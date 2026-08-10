import './control.css';
import { fetchMatchContext, fetchScorecard } from './broadcast-fetch';
import {
  battingTeamLabel,
  formatDismissalShort,
  latestFallOfWicket,
  partnershipBatterRuns,
  playerName,
  resolveActiveInnings,
  shortName,
  wicketOrdinal,
} from './graphics-format';
import {
  connectLiveSocket,
  emitGraphicsCommand,
  queryApiAndMatch,
  type GraphicsCommandMessage,
  type GraphicsKind,
} from './live-client';
import type { MatchContext, ScorecardResponse } from './types';
import { formatTossLine } from './view-model';
import type { Socket } from 'socket.io-client';

/** Full-screen OBS graphics (not strip-only toss). */
const LABELS: Record<Exclude<GraphicsKind, 'hello' | 'toss'>, string> = {
  partnership: 'Partnership',
  fow: 'Fall of wicket',
  batsman: 'Batsman',
  bowler: 'Bowler',
  innings_break: 'Innings break',
};

const OPERATOR_KINDS = Object.keys(LABELS) as Array<keyof typeof LABELS>;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

function setEnabled(button: HTMLButtonElement, enabled: boolean): void {
  button.disabled = !enabled;
}

function appendOption(
  select: HTMLSelectElement,
  value: string,
  label: string,
): void {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  select.appendChild(opt);
}

function start(): void {
  const { matchId, apiBase } = queryApiAndMatch();
  const matchLabel = el<HTMLParagraphElement>('match-label');
  const connLabel = el<HTMLParagraphElement>('conn-label');
  const onAirDock = el<HTMLElement>('on-air-dock');
  const onAir = el<HTMLParagraphElement>('on-air');
  const onAirDetail = el<HTMLParagraphElement>('on-air-detail');
  const btnClearAir = el<HTMLButtonElement>('btn-clear-air');
  const pickBatsman = el<HTMLSelectElement>('pick-batsman');
  const pickBowler = el<HTMLSelectElement>('pick-bowler');

  const btnShowPartnership = el<HTMLButtonElement>('btn-show-partnership');
  const btnShowFow = el<HTMLButtonElement>('btn-show-fow');
  const btnShowBatsman = el<HTMLButtonElement>('btn-show-batsman');
  const btnShowBowler = el<HTMLButtonElement>('btn-show-bowler');
  const btnShowInnings = el<HTMLButtonElement>('btn-show-innings');
  const btnShowToss = el<HTMLButtonElement>('btn-show-toss');

  if (!matchId) {
    matchLabel.textContent = 'Missing matchId — add ?matchId=… to the URL';
    connLabel.textContent = 'Offline';
    return;
  }

  const resolvedMatchId = matchId;
  matchLabel.textContent = `Match ${resolvedMatchId}`;
  connLabel.textContent = `Connecting to ${apiBase}…`;

  let socket: Socket | null = null;
  let onAirGraphic: keyof typeof LABELS | null = null;
  let onAirDetailText = '';
  let scorecard: ScorecardResponse | null = null;
  let matchCtx: MatchContext | null = null;

  function send(cmd: Omit<GraphicsCommandMessage, 'matchId'>): void {
    if (!socket) {
      return;
    }
    emitGraphicsCommand(socket, { matchId: resolvedMatchId, ...cmd });
  }

  function nameOf(id: string | null | undefined): string {
    if (!scorecard || !id) {
      return '—';
    }
    return shortName(playerName(scorecard.display, id));
  }

  function resolveBatsmanId(): string | null {
    const picked = pickBatsman.value.trim();
    if (picked) {
      return picked;
    }
    if (!scorecard) {
      return null;
    }
    return resolveActiveInnings(scorecard)?.currentStrikerId ?? null;
  }

  function resolveBowlerId(): string | null {
    const picked = pickBowler.value.trim();
    if (picked) {
      return picked;
    }
    if (!scorecard) {
      return null;
    }
    return resolveActiveInnings(scorecard)?.currentBowlerId ?? null;
  }

  function previewPartnership(): string | null {
    if (!scorecard) {
      return null;
    }
    const innings = resolveActiveInnings(scorecard);
    const ps = innings?.partnership;
    if (!ps || ps.batterIds.length < 2) {
      return null;
    }
    const [a, b] = ps.batterIds;
    return `${ps.runs} (${ps.balls}) · ${nameOf(a)} ${partnershipBatterRuns(ps, a ?? '')} & ${nameOf(b)} ${partnershipBatterRuns(ps, b ?? '')}`;
  }

  function previewFow(): string | null {
    if (!scorecard) {
      return null;
    }
    const innings = resolveActiveInnings(scorecard);
    const fow = latestFallOfWicket(innings);
    if (!fow || !innings) {
      return null;
    }
    const batter = innings.batters.find((row) => row.playerId === fow.playerId);
    const dismissal = batter
      ? formatDismissalShort(batter, (id) => nameOf(id))
      : '';
    return `${wicketOrdinal(fow.wicketNumber)} · ${nameOf(fow.playerId)}${dismissal ? ` · ${dismissal}` : ''} · ${fow.wicketNumber}-${fow.teamRuns} (${fow.oversText})`;
  }

  function previewInnings(): string | null {
    if (!scorecard || scorecard.innings.length === 0) {
      return null;
    }
    const parts = scorecard.innings.map((inn) => {
      const team = battingTeamLabel(scorecard!, inn);
      return `${team} ${inn.runs}/${inn.wickets} (${inn.oversText})`;
    });
    const target =
      scorecard.effectiveTarget != null && scorecard.effectiveTarget > 0
        ? ` · Target ${scorecard.effectiveTarget}`
        : '';
    return `${parts.join(' · ')}${target}`;
  }

  function previewBatsman(): string | null {
    const playerId = resolveBatsmanId();
    if (!playerId || !scorecard) {
      return null;
    }
    const innings = resolveActiveInnings(scorecard);
    const batter = innings?.batters.find((b) => b.playerId === playerId);
    const figs = batter
      ? `${innings?.currentStrikerId === playerId && !batter.isOut ? `${batter.runs}*` : batter.runs} (${batter.balls})`
      : '0 (0)';
    return `${nameOf(playerId)} · ${figs}`;
  }

  function previewBowler(): string | null {
    const playerId = resolveBowlerId();
    if (!playerId || !scorecard) {
      return null;
    }
    const innings = resolveActiveInnings(scorecard);
    const bowler = innings?.bowlers.find((b) => b.playerId === playerId);
    const figs = bowler
      ? `${bowler.oversText}-${bowler.runsConceded}-${bowler.wickets}`
      : '0-0-0';
    return `${nameOf(playerId)} · ${figs}`;
  }

  function previewToss(): string | null {
    return formatTossLine(matchCtx);
  }

  function detailForKind(kind: keyof typeof LABELS): string {
    switch (kind) {
      case 'partnership':
        return previewPartnership() ?? '';
      case 'fow':
        return previewFow() ?? '';
      case 'batsman':
        return previewBatsman() ?? '';
      case 'bowler':
        return previewBowler() ?? '';
      case 'innings_break':
        return previewInnings() ?? '';
      default:
        return '';
    }
  }

  function setTossOnStrip(live: boolean): void {
    const section = el<HTMLElement>('sec-toss');
    section.classList.toggle('is-on-air', live);
    const badge = section.querySelector<HTMLElement>('.on-air-badge');
    if (badge) {
      badge.hidden = !live;
    }
  }

  function setOnAir(kind: keyof typeof LABELS | null): void {
    onAirGraphic = kind;
    onAirDetailText = kind ? detailForKind(kind) : '';
    onAir.textContent = kind ? LABELS[kind] : 'None';
    onAirDetail.textContent = onAirDetailText;
    onAirDock.classList.toggle('is-live', kind != null);
    setEnabled(btnClearAir, kind != null);

    for (const k of OPERATOR_KINDS) {
      const section = document.querySelector<HTMLElement>(
        `.control-section[data-graphic="${k}"]`,
      );
      if (!section) {
        continue;
      }
      const live = kind === k;
      section.classList.toggle('is-on-air', live);
      const badge = section.querySelector<HTMLElement>('.on-air-badge');
      if (badge) {
        badge.hidden = !live;
      }
    }
  }

  function refreshPreviews(): void {
    const toss = previewToss();
    el<HTMLParagraphElement>('preview-toss').textContent =
      toss ?? 'Toss not recorded yet';
    setEnabled(btnShowToss, toss != null);

    const ps = previewPartnership();
    el<HTMLParagraphElement>('preview-partnership').textContent =
      ps ?? 'No current partnership';
    setEnabled(btnShowPartnership, ps != null);

    const fow = previewFow();
    el<HTMLParagraphElement>('preview-fow').textContent = fow ?? 'No wicket yet';
    setEnabled(btnShowFow, fow != null);

    const bat = previewBatsman();
    el<HTMLParagraphElement>('preview-batsman').textContent =
      bat ?? 'Select a batsman (or wait for striker)';
    setEnabled(btnShowBatsman, bat != null);

    const bowl = previewBowler();
    el<HTMLParagraphElement>('preview-bowler').textContent =
      bowl ?? 'Select a bowler (or wait for current bowler)';
    setEnabled(btnShowBowler, bowl != null);

    const inn = previewInnings();
    el<HTMLParagraphElement>('preview-innings').textContent =
      inn ?? 'Waiting for innings…';
    setEnabled(btnShowInnings, inn != null);

    if (onAirGraphic) {
      onAirDetailText = detailForKind(onAirGraphic);
      onAirDetail.textContent = onAirDetailText;
    }
  }

  function rebuildPickers(card: ScorecardResponse | null): void {
    const batPrev = pickBatsman.value;
    const bowlPrev = pickBowler.value;
    const innings = card ? resolveActiveInnings(card) : null;
    const players = card?.display.players ?? {};

    const creaseIds = [
      innings?.currentStrikerId,
      innings?.currentNonStrikerId,
    ].filter((id): id is string => Boolean(id));
    const bowlerIds = innings?.currentBowlerId ? [innings.currentBowlerId] : [];
    const batterIds = (innings?.batters ?? []).map((b) => b.playerId);
    const bowlingIds = (innings?.bowlers ?? []).map((b) => b.playerId);

    const used = new Set<string>();

    pickBatsman.innerHTML = '';
    appendOption(
      pickBatsman,
      '',
      innings?.currentStrikerId
        ? `Current striker — ${nameOf(innings.currentStrikerId)}`
        : 'Current striker',
    );

    if (creaseIds.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'At the crease';
      for (const id of creaseIds) {
        if (used.has(id)) {
          continue;
        }
        used.add(id);
        const row = innings?.batters.find((b) => b.playerId === id);
        const figs = row ? `${row.runs} (${row.balls})` : '';
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = figs ? `${nameOf(id)} · ${figs}` : nameOf(id);
        group.appendChild(opt);
      }
      if (group.childElementCount > 0) {
        pickBatsman.appendChild(group);
      }
    }

    if (batterIds.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'This innings';
      for (const id of batterIds) {
        if (used.has(id)) {
          continue;
        }
        used.add(id);
        const row = innings?.batters.find((b) => b.playerId === id);
        const figs = row ? `${row.runs} (${row.balls})` : '';
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = figs ? `${nameOf(id)} · ${figs}` : nameOf(id);
        group.appendChild(opt);
      }
      if (group.childElementCount > 0) {
        pickBatsman.appendChild(group);
      }
    }

    const squadGroup = document.createElement('optgroup');
    squadGroup.label = 'All players';
    for (const id of Object.keys(players).sort((a, b) =>
      (players[a] ?? '').localeCompare(players[b] ?? ''),
    )) {
      if (used.has(id)) {
        continue;
      }
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = nameOf(id);
      squadGroup.appendChild(opt);
    }
    if (squadGroup.childElementCount > 0) {
      pickBatsman.appendChild(squadGroup);
    }

    used.clear();
    pickBowler.innerHTML = '';
    appendOption(
      pickBowler,
      '',
      innings?.currentBowlerId
        ? `Current bowler — ${nameOf(innings.currentBowlerId)}`
        : 'Current bowler',
    );

    if (bowlerIds.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'Current';
      for (const id of bowlerIds) {
        used.add(id);
        const row = innings?.bowlers.find((b) => b.playerId === id);
        const figs = row
          ? `${row.oversText}-${row.runsConceded}-${row.wickets}`
          : '';
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = figs ? `${nameOf(id)} · ${figs}` : nameOf(id);
        group.appendChild(opt);
      }
      pickBowler.appendChild(group);
    }

    if (bowlingIds.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'This innings';
      for (const id of bowlingIds) {
        if (used.has(id)) {
          continue;
        }
        used.add(id);
        const row = innings?.bowlers.find((b) => b.playerId === id);
        const figs = row
          ? `${row.oversText}-${row.runsConceded}-${row.wickets}`
          : '';
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = figs ? `${nameOf(id)} · ${figs}` : nameOf(id);
        group.appendChild(opt);
      }
      if (group.childElementCount > 0) {
        pickBowler.appendChild(group);
      }
    }

    const bowlSquad = document.createElement('optgroup');
    bowlSquad.label = 'All players';
    for (const id of Object.keys(players).sort((a, b) =>
      (players[a] ?? '').localeCompare(players[b] ?? ''),
    )) {
      if (used.has(id)) {
        continue;
      }
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = nameOf(id);
      bowlSquad.appendChild(opt);
    }
    if (bowlSquad.childElementCount > 0) {
      pickBowler.appendChild(bowlSquad);
    }

    if ([...pickBatsman.options].some((o) => o.value === batPrev)) {
      pickBatsman.value = batPrev;
    }
    if ([...pickBowler.options].some((o) => o.value === bowlPrev)) {
      pickBowler.value = bowlPrev;
    }
  }

  function applyScorecard(card: ScorecardResponse | null): void {
    scorecard = card;
    rebuildPickers(card);
    refreshPreviews();
  }

  void Promise.all([
    fetchScorecard(apiBase, resolvedMatchId),
    fetchMatchContext(apiBase, resolvedMatchId),
  ]).then(([seed, ctx]) => {
    if (ctx) {
      matchCtx = ctx;
    }
    if (seed) {
      applyScorecard(seed);
    } else {
      refreshPreviews();
    }
  });

  socket = connectLiveSocket(apiBase, resolvedMatchId, {
    onStatus: (s) => {
      if (s === 'live') {
        connLabel.textContent = 'Live';
        connLabel.title = apiBase;
        connLabel.className = 'conn-label status-live';
        return;
      }
      connLabel.textContent = s === 'connecting' ? 'Connecting…' : 'Offline';
      connLabel.title = apiBase;
      connLabel.className = `conn-label status-${s}`;
    },
    onLiveState: (state) => {
      applyScorecard(state);
    },
    onGraphicsCommand: (cmd) => {
      if (cmd.action === 'hide_all') {
        setOnAir(null);
        setTossOnStrip(false);
        return;
      }
      if (!cmd.graphic || cmd.graphic === 'hello') {
        return;
      }
      if (cmd.graphic === 'toss') {
        if (cmd.action === 'show') {
          setTossOnStrip(true);
        } else if (cmd.action === 'hide') {
          setTossOnStrip(false);
        }
        return;
      }
      if (cmd.action === 'show') {
        setOnAir(cmd.graphic);
      } else if (cmd.action === 'hide' && onAirGraphic === cmd.graphic) {
        setOnAir(null);
      }
    },
  });

  const bind = (
    showId: string,
    hideId: string,
    kind: keyof typeof LABELS,
    payloadFn?: () => GraphicsCommandMessage['payload'] | undefined,
  ): void => {
    el<HTMLButtonElement>(showId).addEventListener('click', () => {
      send({ action: 'show', graphic: kind, payload: payloadFn?.() });
    });
    el<HTMLButtonElement>(hideId).addEventListener('click', () => {
      send({ action: 'hide', graphic: kind });
    });
  };

  bind('btn-show-partnership', 'btn-hide-partnership', 'partnership');
  bind('btn-show-fow', 'btn-hide-fow', 'fow');
  bind('btn-show-innings', 'btn-hide-innings', 'innings_break');
  bind('btn-show-batsman', 'btn-hide-batsman', 'batsman', () => {
    const playerId = pickBatsman.value.trim();
    return playerId ? { playerId } : undefined;
  });
  bind('btn-show-bowler', 'btn-hide-bowler', 'bowler', () => {
    const playerId = pickBowler.value.trim();
    return playerId ? { playerId } : undefined;
  });

  el<HTMLButtonElement>('btn-show-toss').addEventListener('click', () => {
    send({ action: 'show', graphic: 'toss' });
  });
  el<HTMLButtonElement>('btn-hide-toss').addEventListener('click', () => {
    send({ action: 'hide', graphic: 'toss' });
  });

  pickBatsman.addEventListener('change', () => refreshPreviews());
  pickBowler.addEventListener('change', () => refreshPreviews());

  btnClearAir.addEventListener('click', () => {
    if (onAirGraphic) {
      send({ action: 'hide', graphic: onAirGraphic });
    } else {
      send({ action: 'hide_all' });
    }
  });

  el<HTMLButtonElement>('btn-hide-all').addEventListener('click', () => {
    send({ action: 'hide_all' });
  });
}

start();
