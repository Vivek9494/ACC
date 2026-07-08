import {
  APP_ORG_NAME,
  APP_SHORT_NAME,
  type InningsScorecard,
  MatchState,
  type ScorecardResponse,
} from '@acc/types';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ScorecardReader } from './scorecard-reader';

/** Match states for which the scorecard PDF may be exported (§16: completed). */
const EXPORTABLE_STATES: MatchState[] = [
  MatchState.Completed,
  MatchState.NoResult,
  MatchState.ScorecardLocked,
];

export interface ScorecardDocument {
  filename: string;
  contentType: string;
  body: Buffer | string;
}

/**
 * Server-side scorecard export (spec §16). Renders a branded ACC HTML template
 * (summary + ball-by-ball) and converts it to PDF via Puppeteer when available;
 * if Chromium cannot be launched it gracefully falls back to serving the HTML
 * so the feature stays usable everywhere.
 */
@Injectable()
export class ScorecardPdfService {
  private readonly logger = new Logger(ScorecardPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: ScorecardReader,
  ) {}

  async export(matchId: string, forceHtml = false): Promise<ScorecardDocument> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        tournament: { select: { name: true } },
        squads: { include: { players: { include: { user: { select: { firstName: true, lastName: true } } } } } },
        externalPlayers: true,
      },
    });
    if (!match) {
      throw new NotFoundException({ message: 'Match not found', error: 'MATCH_NOT_FOUND' });
    }
    if (!EXPORTABLE_STATES.includes(match.state as MatchState)) {
      throw new BadRequestException({
        message: 'The scorecard PDF is only available for a completed match',
        error: 'MATCH_NOT_COMPLETED',
      });
    }

    const card = await this.reader.build(match);
    const names = new Map<string, string>();
    for (const squad of match.squads) {
      for (const p of squad.players) {
        names.set(p.userId, `${p.user.firstName} ${p.user.lastName}`.trim());
      }
    }
    for (const ext of match.externalPlayers) {
      names.set(ext.id, ext.name);
    }

    const homeName = match.homeTeam?.name ?? 'Home';
    const awayName = match.awayTeam?.name ?? match.externalOpponentName ?? 'Opponent';
    // §16: file name "X vs Y - Match #".
    const matchRef = match.matchCode ?? match.id.slice(0, 8);
    const baseName = `${homeName} vs ${awayName} - Match ${matchRef}`;
    const html = this.renderHtml(baseName, match.tournament.name, card, names);

    if (!forceHtml) {
      const pdf = await this.tryRenderPdf(html);
      if (pdf) {
        return { filename: `${baseName}.pdf`, contentType: 'application/pdf', body: pdf };
      }
    }
    return { filename: `${baseName}.html`, contentType: 'text/html; charset=utf-8', body: html };
  }

  /** Attempts a Puppeteer render; returns null (→ HTML fallback) if unavailable. */
  private async tryRenderPdf(html: string): Promise<Buffer | null> {
    try {
      // Non-literal specifier so the optional dependency is not required at
      // build time; resolves to `any` and is skipped if Puppeteer is absent.
      const moduleName = 'puppeteer';
      const mod: unknown = await import(moduleName).catch(() => null);
      if (!mod) {
        return null;
      }
      const puppeteer = (mod as { default?: unknown }).default ?? mod;
      const launch = (puppeteer as { launch?: (...a: unknown[]) => Promise<unknown> }).launch;
      if (typeof launch !== 'function') {
        return null;
      }
      const browser = (await launch({ headless: true, args: ['--no-sandbox'] })) as {
        newPage: () => Promise<{
          setContent: (h: string, o: unknown) => Promise<void>;
          pdf: (o: unknown) => Promise<Buffer>;
        }>;
        close: () => Promise<void>;
      };
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        return await page.pdf({ format: 'A4', printBackground: true });
      } finally {
        await browser.close();
      }
    } catch (err) {
      this.logger.warn(`PDF render unavailable, serving HTML: ${(err as Error).message}`);
      return null;
    }
  }

  // --- HTML template (§16: branded ACC, summary + ball-by-ball) -------------

  private renderHtml(
    title: string,
    tournamentName: string,
    card: ScorecardResponse,
    names: Map<string, string>,
  ): string {
    const name = (id: string | null): string => (id ? (names.get(id) ?? id) : '—');
    const inningsBlocks = card.innings.map((inn) => this.renderInnings(inn, name)).join('\n');
    const resultLine = this.escape(card.result.note ?? 'Result pending');
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${this.escape(title)}</title>
<style>
  :root { --acc:#0b5; --ink:#111; --muted:#666; --line:#e3e3e3; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: var(--ink); margin: 0; padding: 32px; }
  header { border-bottom: 3px solid var(--acc); padding-bottom: 12px; margin-bottom: 20px; }
  .brand { font-size: 13px; letter-spacing: 2px; color: var(--acc); font-weight: 700; text-transform: uppercase; }
  h1 { font-size: 22px; margin: 4px 0 2px; }
  .sub { color: var(--muted); font-size: 13px; }
  .result { background:#f4fbf6; border:1px solid var(--line); border-radius:8px; padding:10px 14px; margin:14px 0; font-weight:600; }
  h2 { font-size: 16px; margin: 22px 0 6px; }
  table { width:100%; border-collapse: collapse; font-size: 12px; margin-bottom: 6px; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); }
  th { color: var(--muted); font-weight:600; text-transform:uppercase; font-size:10px; letter-spacing:.5px; }
  td.num, th.num { text-align:right; }
  .totals { font-weight:700; }
  .tl { font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
  footer { margin-top: 28px; color: var(--muted); font-size: 11px; border-top:1px solid var(--line); padding-top:10px; }
</style></head>
<body>
<header>
  <div class="brand">${APP_ORG_NAME}</div>
  <h1>${this.escape(title)}</h1>
  <div class="sub">${this.escape(tournamentName)}</div>
</header>
<div class="result">${resultLine}</div>
${inningsBlocks}
<footer>Generated by ${APP_SHORT_NAME} • Append-only scorecard • All times UTC</footer>
</body></html>`;
  }

  private renderInnings(inn: InningsScorecard, name: (id: string | null) => string): string {
    const heading = `Innings ${inn.sequence}${inn.inningsType === 'SUPER_OVER' ? ' (Super Over)' : ''}`;
    const batters = inn.batters
      .map(
        (b) => `<tr><td>${this.escape(name(b.playerId))}${b.isOut ? '' : ' *'}</td>
        <td class="num">${b.runs}</td><td class="num">${b.balls}</td>
        <td class="num">${b.fours}</td><td class="num">${b.sixes}</td>
        <td class="num">${b.strikeRate.toFixed(1)}</td></tr>`,
      )
      .join('');
    const bowlers = inn.bowlers
      .map(
        (b) => `<tr><td>${this.escape(name(b.playerId))}</td>
        <td class="num">${this.escape(b.oversText)}</td><td class="num">${b.maidens}</td>
        <td class="num">${b.runsConceded}</td><td class="num">${b.wickets}</td>
        <td class="num">${b.economy.toFixed(2)}</td></tr>`,
      )
      .join('');
    const fow = inn.fallOfWickets
      .map((f) => `${f.teamRuns}-${f.wicketNumber} (${this.escape(name(f.playerId))}, ${this.escape(f.oversText)})`)
      .join(' · ');
    const timeline = inn.timeline
      .map((t) => `<span class="tl">${this.escape(t.label ? `${t.label} ` : '')}${this.escape(t.code)}</span>`)
      .join(' ');
    return `<h2>${this.escape(heading)} — ${inn.runs}/${inn.wickets} (${this.escape(inn.oversText)} ov)</h2>
<table>
  <thead><tr><th>Batter</th><th class="num">R</th><th class="num">B</th><th class="num">4s</th><th class="num">6s</th><th class="num">SR</th></tr></thead>
  <tbody>${batters}</tbody>
  <tfoot><tr class="totals"><td>Extras</td><td class="num" colspan="5">${inn.extras.total} (wd ${inn.extras.wides}, nb ${inn.extras.noBalls}, b ${inn.extras.byes}, lb ${inn.extras.legByes}, p ${inn.extras.penalties})</td></tr>
  <tr class="totals"><td>Total</td><td class="num" colspan="5">${inn.runs}/${inn.wickets} (${this.escape(inn.oversText)} ov)</td></tr></tfoot>
</table>
<table>
  <thead><tr><th>Bowler</th><th class="num">O</th><th class="num">M</th><th class="num">R</th><th class="num">W</th><th class="num">Econ</th></tr></thead>
  <tbody>${bowlers}</tbody>
</table>
${fow ? `<div class="sub"><strong>Fall of wickets:</strong> ${fow}</div>` : ''}
${timeline ? `<h2>Ball-by-ball</h2><div>${timeline}</div>` : ''}`;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
