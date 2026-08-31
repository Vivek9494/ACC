import {
  createGraphicsStage,
  type GraphicsStageController,
  type GraphicsStageOptions,
} from '../graphics-stage';
import type { GraphicsCommandMessage, MatchContext } from '../types';
import {
  buildTournamentGraphicsMarkup,
  isTournamentGraphicKind,
  mountTournamentGraphics,
} from './tournament-graphics';

/** Theme 1 graphics stage — match graphics + tournament aggregate overlays. */
export function createTheme1GraphicsStage(
  root: HTMLElement,
  options: GraphicsStageOptions,
): GraphicsStageController {
  if (options.injectMarkup) {
    root.insertAdjacentHTML('beforeend', buildTournamentGraphicsMarkup());
  }

  const base = createGraphicsStage(root, { ...options, injectMarkup: options.injectMarkup });
  const tournament = mountTournamentGraphics(root, options.apiBase);
  let tournamentId: string | null = null;

  const syncTournamentId = (ctx: MatchContext | null): void => {
    tournamentId = ctx?.tournamentId?.trim() || null;
  };

  return {
    setScorecard(card) {
      base.setScorecard(card);
    },
    setMatchContext(ctx) {
      syncTournamentId(ctx);
      base.setMatchContext(ctx);
    },
    setBallType(next) {
      base.setBallType(next);
    },
    hideAll() {
      base.hideAll();
      tournament.hideAll();
    },
    isOnAir() {
      return base.isOnAir() || tournament.isOnAir();
    },
    activeKind() {
      return base.activeKind();
    },
    applyCommand(cmd: GraphicsCommandMessage) {
      if (cmd.action === 'hide_all') {
        base.hideAll();
        tournament.hideAll();
        return;
      }
      if (cmd.graphic && isTournamentGraphicKind(cmd.graphic)) {
        if (cmd.action === 'show') {
          base.hideAll();
        }
        tournament.applyCommand(cmd, tournamentId);
        return;
      }
      if (cmd.action === 'show' && cmd.graphic) {
        tournament.hideAll();
      }
      base.applyCommand(cmd);
    },
  };
}
