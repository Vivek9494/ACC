/**
 * Premium PLAYING XI card — both squads side by side (or single-team).
 * Match-level; independent of innings. Isolation: show/hide are try/catch'd.
 */

import './playing-xi-card.css';
import { concealGraphic, revealGraphic } from './graphic-visibility';
import type { MatchContext, MatchSquadContext, MatchSquadPlayer } from './types';
import { teamInitials } from './view-model';

const XI_SLOTS = 11;
const EXIT_MS = 320;

/** Spec timeline delays (ms) for synchronized section reveal. */
const DELAY = {
  id: 0,
  title: 65,
  headers: 130,
  colHeads: 180,
  row0: 225,
  rowStep: 45,
  legend: 750,
  footer: 795,
} as const;

export type PlayingXiVariant = 'both' | 'single' | 'lineup';

export interface PlayingXiShowOptions {
  teamId?: string | null;
  variant?: PlayingXiVariant;
  /** When false, repaint without replaying entrance (live context refresh). */
  animate?: boolean;
}

export interface PlayingXiPlayerRow {
  name: string;
  roleLabel: string;
  isCaptain: boolean;
  isWicketKeeper: boolean;
}

export interface PlayingXiSide {
  name: string;
  initials: string;
  players: PlayingXiPlayerRow[];
}

export interface PlayingXiCardController {
  readonly host: HTMLElement;
  isOnAir(): boolean;
  hide(): void;
  /** Returns false when match context has no team names. */
  show(ctx: MatchContext | null, options?: PlayingXiShowOptions): boolean;
}

function warnGraphics(err: unknown): void {
  console.warn('[playing-xi]', err);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function qs<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
): T | null {
  return root.querySelector(selector) as T | null;
}

function fullName(player: MatchSquadPlayer): string {
  return `${player.firstName} ${player.lastName}`.trim();
}

function roleLabel(player: MatchSquadPlayer): string {
  if (player.isWicketKeeper && !player.playerRole) {
    return 'WK';
  }
  if (player.playerRole === 'BATSMAN') {
    return 'Batter';
  }
  if (player.playerRole === 'BOWLER') {
    return 'Bowler';
  }
  if (player.playerRole === 'ALL_ROUNDER') {
    return 'All-rounder';
  }
  if (player.isWicketKeeper) {
    return 'WK';
  }
  return '—';
}

function sortXiPlayers(players: MatchSquadPlayer[]): MatchSquadPlayer[] {
  return [...players]
    .filter((p) => p.role === 'PLAYING_XI')
    .sort((a, b) => {
      const ao = a.battingOrder;
      const bo = b.battingOrder;
      if (ao != null && bo != null && ao !== bo) {
        return ao - bo;
      }
      if (ao != null && bo == null) {
        return -1;
      }
      if (ao == null && bo != null) {
        return 1;
      }
      return fullName(a).localeCompare(fullName(b));
    });
}

function toRows(players: MatchSquadPlayer[]): PlayingXiPlayerRow[] {
  return sortXiPlayers(players)
    .map((p) => {
      const name = fullName(p);
      if (!name) {
        return null;
      }
      return {
        name,
        roleLabel: roleLabel(p),
        isCaptain: p.isCaptain === true,
        isWicketKeeper: p.isWicketKeeper === true,
      };
    })
    .filter((row): row is PlayingXiPlayerRow => row != null);
}

function padRows(rows: PlayingXiPlayerRow[]): Array<PlayingXiPlayerRow | null> {
  const out: Array<PlayingXiPlayerRow | null> = rows.slice(0, XI_SLOTS);
  while (out.length < XI_SLOTS) {
    out.push(null);
  }
  return out;
}

function squadLineup(squad: MatchSquadContext | null | undefined): PlayingXiPlayerRow[] {
  if (!squad) {
    return [];
  }
  return squad.players
    .filter((p) => p.role === 'PLAYING_XI')
    .map((p) => {
      const name = fullName(p);
      if (!name) {
        return null;
      }
      return {
        name,
        roleLabel: roleLabel(p),
        isCaptain: p.isCaptain === true,
        isWicketKeeper: p.isWicketKeeper === true,
      };
    })
    .filter((row): row is PlayingXiPlayerRow => row != null);
}

function squadXi(squad: MatchSquadContext | null | undefined): PlayingXiPlayerRow[] {
  if (!squad) {
    return [];
  }
  return toRows(squad.players);
}

function externalXi(ctx: MatchContext): PlayingXiPlayerRow[] {
  return [...ctx.externalPlayers]
    .sort((a, b) => a.slot - b.slot)
    .map((p) => {
      const name = p.name.trim();
      if (!name) {
        return null;
      }
      return {
        name,
        roleLabel: '—',
        isCaptain: false,
        isWicketKeeper: false,
      };
    })
    .filter((row): row is PlayingXiPlayerRow => row != null);
}

function pickSquad(
  ctx: MatchContext,
  teamId: string | null,
  used: Set<string>,
): MatchSquadContext | null {
  if (teamId) {
    const hit = ctx.squads.find((s) => s.teamId === teamId);
    if (hit) {
      return hit;
    }
  }
  return ctx.squads.find((s) => !used.has(s.teamId)) ?? null;
}

export function resolvePlayingXiSides(ctx: MatchContext): {
  a: PlayingXiSide;
  b: PlayingXiSide;
} {
  const nameA = ctx.homeTeamName?.trim() || 'Home';
  const nameB =
    ctx.awayTeamName?.trim() ||
    ctx.externalOpponentName?.trim() ||
    'Away';

  const used = new Set<string>();
  const squadA = pickSquad(ctx, ctx.homeTeamId, used);
  if (squadA) {
    used.add(squadA.teamId);
  }

  let playersB: PlayingXiPlayerRow[];
  if (ctx.awayTeamId) {
    const squadB = pickSquad(ctx, ctx.awayTeamId, used);
    playersB = squadXi(squadB);
  } else {
    playersB = externalXi(ctx);
  }

  return {
    a: {
      name: nameA,
      initials: teamInitials(nameA),
      players: squadXi(squadA),
    },
    b: {
      name: nameB,
      initials: teamInitials(nameB),
      players: playersB,
    },
  };
}

export function resolveTeamPlayingXiSide(
  ctx: MatchContext,
  teamId: string | null,
  isExternal: boolean,
  variant: PlayingXiVariant,
): PlayingXiSide | null {
  const homeId = ctx.homeTeamId?.trim() || null;
  const awayId = ctx.awayTeamId?.trim() || null;
  const useLineup = variant === 'lineup';
  const pickPlayers = useLineup ? squadLineup : squadXi;

  if (isExternal || (!teamId && ctx.externalOpponentName?.trim())) {
    const name =
      ctx.awayTeamName?.trim() ||
      ctx.externalOpponentName?.trim() ||
      'Away';
    return {
      name,
      initials: teamInitials(name),
      players: externalXi(ctx),
    };
  }

  if (teamId && homeId === teamId) {
    const name = ctx.homeTeamName?.trim() || 'Home';
    const squad = ctx.squads.find((s) => s.teamId === teamId) ?? null;
    return {
      name,
      initials: teamInitials(name),
      players: pickPlayers(squad),
    };
  }

  if (teamId) {
    const squad = ctx.squads.find((s) => s.teamId === teamId) ?? null;
    const name =
      (teamId === awayId ? ctx.awayTeamName?.trim() : null) ||
      (teamId === homeId ? ctx.homeTeamName?.trim() : null) ||
      'Team';
    return {
      name,
      initials: teamInitials(name),
      players: pickPlayers(squad),
    };
  }

  return null;
}

export function formatPlayingXiPreview(ctx: MatchContext | null): string | null {
  if (!ctx) {
    return null;
  }
  const a = ctx.homeTeamName?.trim();
  const b = ctx.awayTeamName?.trim() || ctx.externalOpponentName?.trim();
  if (!a && !b) {
    return null;
  }
  return `${a || 'Home'} vs ${b || 'Away'}`;
}

function setShield(root: ParentNode, side: 'a' | 'b', initials: string): void {
  const abbr = qs<HTMLSpanElement>(root, `[data-pxi-abbr="${side}"]`);
  if (abbr) {
    abbr.textContent = initials || '—';
  }
  const code = qs<HTMLElement>(root, `[data-pxi-team-code="${side}"]`);
  if (code) {
    code.textContent = initials || '';
  }
}

function paintCell(
  cell: HTMLElement,
  slot: number,
  row: PlayingXiPlayerRow | null,
): void {
  const num = qs<HTMLElement>(cell, '.pxi-num');
  const name = qs<HTMLElement>(cell, '.pxi-name');
  const role = qs<HTMLElement>(cell, '.pxi-role');
  const badges = qs<HTMLElement>(cell, '.pxi-badges');
  if (!num || !name || !role || !badges) {
    return;
  }

  num.textContent = String(slot).padStart(2, '0');
  cell.classList.toggle('is-blank', row == null);
  cell.classList.toggle('is-captain', row?.isCaptain === true);

  if (!row) {
    name.textContent = '';
    role.textContent = '';
    badges.replaceChildren();
    return;
  }

  name.textContent = row.name;
  role.textContent = row.roleLabel;
  badges.replaceChildren();
  if (row.isCaptain) {
    const c = document.createElement('span');
    c.className = 'pxi-badge pxi-badge-c';
    c.textContent = 'C';
    badges.appendChild(c);
  }
  if (row.isWicketKeeper) {
    const wk = document.createElement('span');
    wk.className = 'pxi-badge pxi-badge-wk';
    wk.textContent = 'WK';
    badges.appendChild(wk);
  }
}

function paintSide(
  host: HTMLElement,
  side: 'a' | 'b',
  players: PlayingXiPlayerRow[],
): void {
  const padded = padRows(players);
  for (let i = 0; i < XI_SLOTS; i += 1) {
    const cell = qs<HTMLElement>(
      host,
      `[data-pxi-cell="${side}"][data-pxi-slot="${i}"]`,
    );
    if (cell) {
      paintCell(cell, i + 1, padded[i] ?? null);
    }
  }
}

function buildCellMarkup(side: 'a' | 'b', slot: number): string {
  return `
    <div
      class="pxi-cell is-blank"
      data-pxi-cell="${side}"
      data-pxi-side="${side}"
      data-pxi-slot="${slot}"
    >
      <span class="pxi-num"></span>
      <div class="pxi-player">
        <span class="pxi-name"></span>
        <span class="pxi-badges" aria-hidden="true"></span>
      </div>
      <span class="pxi-role"></span>
    </div>
  `.trim();
}

function buildRowPairsMarkup(): string {
  const rows: string[] = [];
  for (let i = 0; i < XI_SLOTS; i += 1) {
    const delay = DELAY.row0 + i * DELAY.rowStep;
    rows.push(`
      <div
        class="pxi-row-pair pxi-section"
        data-pxi-section="row"
        data-pxi-delay="${delay}"
      >
        ${buildCellMarkup('a', i)}
        ${buildCellMarkup('b', i)}
      </div>
    `);
  }
  return rows.join('');
}

function buildCardMarkup(): string {
  return `
    <div class="panel panel-playing-xi">
      <div
        class="pxi-id-strip pxi-section"
        data-pxi-section="id"
        data-pxi-delay="${DELAY.id}"
      >
        <p data-pxi-id-left class="pxi-id-left">ASC</p>
        <p data-pxi-id-center class="pxi-id-center">ASC LIVE</p>
        <p data-pxi-id-right class="pxi-id-right">TEAM SHEET</p>
      </div>
      <div
        class="pxi-title-bar pxi-section"
        data-pxi-section="title"
        data-pxi-delay="${DELAY.title}"
      >
        <div class="pxi-title-left">
          <p data-pxi-title-kicker class="pxi-title-kicker">Lineups</p>
          <p class="pxi-title" data-pxi-title>
            <span data-pxi-title-main class="pxi-title-main">Playing</span>
            <span data-pxi-title-accent class="pxi-title-accent">XI</span>
          </p>
        </div>
        <div class="pxi-title-right">
          <p data-pxi-title-right-label class="pxi-title-right-label">The lineup</p>
          <p data-pxi-title-right-value class="pxi-title-right-value">11 players</p>
        </div>
        <div class="pxi-title-sweep" aria-hidden="true"></div>
      </div>
      <div
        class="pxi-team-headers pxi-section"
        data-pxi-section="headers"
        data-pxi-delay="${DELAY.headers}"
      >
        <header class="pxi-team-head" data-pxi-side="a" aria-label="Team A">
          <div class="pxi-mono-shield" aria-hidden="true">
            <span class="pxi-mono-star">★</span>
            <span data-pxi-abbr="a" class="pxi-mono-abbr">—</span>
            <span class="pxi-mono-stripe"></span>
          </div>
          <div class="pxi-team-copy">
            <p data-pxi-team="a" class="pxi-team-name">—</p>
            <p class="pxi-team-sub">Playing XI</p>
          </div>
          <p data-pxi-team-code="a" class="pxi-team-code" aria-hidden="true"></p>
        </header>
        <header class="pxi-team-head" data-pxi-side="b" aria-label="Team B">
          <div class="pxi-mono-shield" aria-hidden="true">
            <span class="pxi-mono-star">★</span>
            <span data-pxi-abbr="b" class="pxi-mono-abbr">—</span>
            <span class="pxi-mono-stripe"></span>
          </div>
          <div class="pxi-team-copy">
            <p data-pxi-team="b" class="pxi-team-name">—</p>
            <p class="pxi-team-sub">Playing XI</p>
          </div>
          <p data-pxi-team-code="b" class="pxi-team-code" aria-hidden="true"></p>
        </header>
      </div>
      <div
        class="pxi-col-heads pxi-section"
        data-pxi-section="col-heads"
        data-pxi-delay="${DELAY.colHeads}"
      >
        <div class="pxi-col-head" data-pxi-side="a">
          <span>No.</span><span>Player</span><span>Role</span>
        </div>
        <div class="pxi-col-head" data-pxi-side="b">
          <span>No.</span><span>Player</span><span>Role</span>
        </div>
      </div>
      <div class="pxi-rows" data-pxi-rows>
        ${buildRowPairsMarkup()}
      </div>
      <div
        class="pxi-legend pxi-section"
        data-pxi-section="legend"
        data-pxi-delay="${DELAY.legend}"
      >
        <div class="pxi-legend-keys">
          <span class="pxi-legend-item">
            <span class="pxi-badge pxi-badge-c">C</span> Captain
          </span>
          <span class="pxi-legend-item">
            <span class="pxi-badge pxi-badge-wk">WK</span> Wicketkeeper
          </span>
          <span class="pxi-legend-item">White row = captain</span>
        </div>
        <p data-pxi-legend-format class="pxi-legend-format">Team sheet</p>
      </div>
      <div
        class="pxi-footer pxi-section"
        data-pxi-section="footer"
        data-pxi-delay="${DELAY.footer}"
      >
        <p class="pxi-footer-mark">ASC</p>
        <p class="pxi-footer-brand">Cricket <span class="pxi-footer-slash">/</span> ASC</p>
      </div>
    </div>
  `.trim();
}

export function mountPlayingXiCard(host: HTMLElement): PlayingXiCardController {
  let onAir = false;
  let motionGen = 0;
  let exitTimer: number | null = null;
  const entranceTimers: number[] = [];

  const panel = (): HTMLElement | null =>
    host.querySelector('.panel-playing-xi');

  const ensureMarkup = (): void => {
    // Rebuild when upgrading from the prior centered single-line title/ID strip.
    if (!host.querySelector('.panel-playing-xi .pxi-title-accent')) {
      host.innerHTML = buildCardMarkup();
    }
  };

  const cancelMotion = (): void => {
    motionGen += 1;
    for (const t of entranceTimers) {
      window.clearTimeout(t);
    }
    entranceTimers.length = 0;
    if (exitTimer != null) {
      window.clearTimeout(exitTimer);
      exitTimer = null;
    }
    const p = panel();
    if (p) {
      p.classList.remove('pxi-exiting', 'pxi-entering');
      for (const section of p.querySelectorAll('.pxi-section')) {
        section.classList.remove('pxi-section-visible');
      }
    }
  };

  const runEntrance = (): void => {
    cancelMotion();
    const p = panel();
    if (!p) {
      return;
    }
    const gen = motionGen;
    const sections = [...p.querySelectorAll<HTMLElement>('.pxi-section')];
    if (prefersReducedMotion()) {
      p.classList.add('pxi-entering');
      for (const section of sections) {
        section.classList.add('pxi-section-visible');
      }
      return;
    }
    p.classList.remove('pxi-exiting');
    p.classList.add('pxi-entering');
    for (const section of sections) {
      section.classList.remove('pxi-section-visible');
    }
    for (const section of sections) {
      const raw = section.getAttribute('data-pxi-delay');
      const delay = raw != null ? Number(raw) : 0;
      const timer = window.setTimeout(() => {
        if (gen !== motionGen) {
          return;
        }
        section.classList.add('pxi-section-visible');
      }, Number.isFinite(delay) ? delay : 0);
      entranceTimers.push(timer);
    }
    const sweep = p.querySelector<HTMLElement>('.pxi-title-sweep');
    if (sweep) {
      sweep.style.animation = 'none';
      void sweep.offsetWidth;
      sweep.style.animation = '';
    }
  };

  const hideNode = (): void => {
    cancelMotion();
    onAir = false;
    const p = panel();
    const reduced = prefersReducedMotion();
    const ms = reduced ? 0 : EXIT_MS;

    if (p && !reduced) {
      p.classList.add('pxi-exiting');
      p.classList.remove('pxi-entering');
      for (const section of p.querySelectorAll('.pxi-section')) {
        section.classList.remove('pxi-section-visible');
      }
    }

    host.classList.remove('is-visible');
    exitTimer = window.setTimeout(() => {
      exitTimer = null;
      concealGraphic(host);
    }, ms);
  };

  const reveal = (animate: boolean): void => {
    revealGraphic(host);
    if (animate) {
      requestAnimationFrame(() => runEntrance());
      return;
    }
    const p = panel();
    if (p) {
      p.classList.add('pxi-entering');
      for (const section of p.querySelectorAll('.pxi-section')) {
        section.classList.add('pxi-section-visible');
      }
    }
  };

  const paint = (
    ctx: MatchContext,
    options?: PlayingXiShowOptions,
  ): boolean => {
    ensureMarkup();
    const p = panel();
    const titleMain = qs<HTMLElement>(host, '[data-pxi-title-main]');
    const titleAccent = qs<HTMLElement>(host, '[data-pxi-title-accent]');
    const titleKicker = qs<HTMLElement>(host, '[data-pxi-title-kicker]');
    const titleRightLabel = qs<HTMLElement>(host, '[data-pxi-title-right-label]');
    const titleRightValue = qs<HTMLElement>(host, '[data-pxi-title-right-value]');
    const idLeft = qs<HTMLElement>(host, '[data-pxi-id-left]');
    const idCenter = qs<HTMLElement>(host, '[data-pxi-id-center]');
    const idRight = qs<HTMLElement>(host, '[data-pxi-id-right]');
    const nameA = qs<HTMLElement>(host, '[data-pxi-team="a"]');
    const nameB = qs<HTMLElement>(host, '[data-pxi-team="b"]');
    const legendFormat = qs<HTMLElement>(host, '[data-pxi-legend-format]');
    if (
      !p ||
      !titleMain ||
      !titleAccent ||
      !titleKicker ||
      !titleRightLabel ||
      !titleRightValue ||
      !idLeft ||
      !idCenter ||
      !idRight ||
      !nameA ||
      !nameB ||
      !legendFormat
    ) {
      return false;
    }

    const variant = options?.variant ?? 'both';
    const preview = formatPlayingXiPreview(ctx);

    idLeft.textContent = 'ASC';
    idCenter.textContent = preview ? preview.toUpperCase() : 'ASC LIVE';
    idRight.textContent = variant === 'lineup' ? 'BATTING ORDER' : 'TEAM SHEET';

    if (variant === 'lineup') {
      titleKicker.textContent = 'Batting order';
      titleMain.textContent = 'Batting';
      titleAccent.textContent = 'XI';
      titleRightLabel.textContent = 'The lineup';
    } else {
      titleKicker.textContent = 'Lineups';
      titleMain.textContent = 'Playing';
      titleAccent.textContent = 'XI';
      titleRightLabel.textContent = 'The lineup';
    }

    if (variant === 'both') {
      if (!preview) {
        return false;
      }
      p.classList.remove('is-single');
      const sides = resolvePlayingXiSides(ctx);
      nameA.textContent = sides.a.name;
      nameB.textContent = sides.b.name;
      setShield(host, 'a', sides.a.initials);
      setShield(host, 'b', sides.b.initials);
      paintSide(host, 'a', sides.a.players);
      paintSide(host, 'b', sides.b.players);
      const count =
        sides.a.players.filter((row) => row.name.trim()).length +
        sides.b.players.filter((row) => row.name.trim()).length;
      titleRightValue.textContent = `${count || 22} players`;
      legendFormat.textContent = preview.toUpperCase();
      return true;
    }

    const teamId = options?.teamId?.trim() || null;
    const isExternal =
      !teamId &&
      Boolean(ctx.externalOpponentName?.trim()) &&
      !ctx.awayTeamId?.trim();
    const side = resolveTeamPlayingXiSide(ctx, teamId, isExternal, variant);
    if (!side) {
      return false;
    }
    p.classList.add('is-single');
    nameA.textContent = side.name;
    nameB.textContent = '';
    setShield(host, 'a', side.initials);
    setShield(host, 'b', '—');
    paintSide(host, 'a', side.players);
    paintSide(host, 'b', []);
    const count = side.players.filter((row) => row.name.trim()).length;
    titleRightValue.textContent = `${count || XI_SLOTS} players`;
    legendFormat.textContent = side.name.toUpperCase();
    return true;
  };

  return {
    host,
    isOnAir: () => onAir,
    hide() {
      try {
        hideNode();
      } catch (err) {
        warnGraphics(err);
        onAir = false;
        host.hidden = true;
        host.classList.remove('is-visible');
      }
    },
    show(ctx, options) {
      try {
        if (!ctx || !paint(ctx, options)) {
          hideNode();
          return false;
        }
        onAir = true;
        reveal(options?.animate !== false);
        return true;
      } catch (err) {
        warnGraphics(err);
        hideNode();
        return false;
      }
    },
  };
}
