import './control.css';
import { fetchScorecard } from './broadcast-fetch';
import { playerName, resolveActiveInnings, shortName } from './graphics-format';
import {
  connectLiveSocket,
  emitGraphicsCommand,
  queryApiAndMatch,
  type GraphicsCommandMessage,
  type GraphicsKind,
} from './live-client';
import type { ScorecardResponse } from './types';
import type { Socket } from 'socket.io-client';

const LABELS: Record<GraphicsKind, string> = {
  partnership: 'Partnership',
  fow: 'Fall of wicket',
  batsman: 'Batsman',
  bowler: 'Bowler',
  innings_break: 'Innings break',
  hello: 'HELLO',
};

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

function start(): void {
  const { matchId, apiBase } = queryApiAndMatch();
  const matchLabel = el<HTMLParagraphElement>('match-label');
  const connLabel = el<HTMLParagraphElement>('conn-label');
  const onAir = el<HTMLParagraphElement>('on-air');
  const pickBatsman = el<HTMLSelectElement>('pick-batsman');
  const pickBowler = el<HTMLSelectElement>('pick-bowler');

  if (!matchId) {
    matchLabel.textContent = 'Missing matchId — add ?matchId=… to the URL';
    connLabel.textContent = 'Offline';
    return;
  }

  const resolvedMatchId = matchId;
  matchLabel.textContent = `Match ${resolvedMatchId}`;
  connLabel.textContent = `Connecting to ${apiBase}…`;
  let socket: Socket | null = null;
  let onAirGraphic: GraphicsKind | null = null;

  function setOnAir(kind: GraphicsKind | null): void {
    onAirGraphic = kind;
    onAir.textContent = kind ? `On air: ${LABELS[kind]}` : 'On air: none';
    onAir.classList.toggle('is-live', kind != null);
  }

  function send(cmd: Omit<GraphicsCommandMessage, 'matchId'>): void {
    if (!socket) {
      return;
    }
    emitGraphicsCommand(socket, { matchId: resolvedMatchId, ...cmd });
  }

  function rebuildPickers(card: ScorecardResponse | null): void {
    const players = card?.display.players ?? {};
    const ids = Object.keys(players).sort((a, b) =>
      (players[a] ?? '').localeCompare(players[b] ?? ''),
    );

    const batPrev = pickBatsman.value;
    const bowlPrev = pickBowler.value;
    const innings = card ? resolveActiveInnings(card) : null;

    pickBatsman.innerHTML = '';
    const batDefault = document.createElement('option');
    batDefault.value = '';
    batDefault.textContent = innings?.currentStrikerId
      ? `Current striker (${shortName(playerName(card!.display, innings.currentStrikerId))})`
      : 'Current striker';
    pickBatsman.appendChild(batDefault);

    pickBowler.innerHTML = '';
    const bowlDefault = document.createElement('option');
    bowlDefault.value = '';
    bowlDefault.textContent = innings?.currentBowlerId
      ? `Current bowler (${shortName(playerName(card!.display, innings.currentBowlerId))})`
      : 'Current bowler';
    pickBowler.appendChild(bowlDefault);

    for (const id of ids) {
      const name = shortName(players[id] ?? id);
      const batOpt = document.createElement('option');
      batOpt.value = id;
      batOpt.textContent = name;
      pickBatsman.appendChild(batOpt);

      const bowlOpt = document.createElement('option');
      bowlOpt.value = id;
      bowlOpt.textContent = name;
      pickBowler.appendChild(bowlOpt);
    }

    if (batPrev && ids.includes(batPrev)) {
      pickBatsman.value = batPrev;
    }
    if (bowlPrev && ids.includes(bowlPrev)) {
      pickBowler.value = bowlPrev;
    }
  }

  void fetchScorecard(apiBase, resolvedMatchId).then((seed) => {
    if (seed) {
      rebuildPickers(seed);
    }
  });

  socket = connectLiveSocket(apiBase, resolvedMatchId, {
    onStatus: (s) => {
      if (s === 'live') {
        connLabel.textContent = `Live · ${apiBase}`;
        connLabel.className = 'conn-label status-live';
        return;
      }
      connLabel.textContent =
        s === 'connecting'
          ? `Connecting to ${apiBase}…`
          : `Offline — check API/CORS (${apiBase})`;
      connLabel.className = `conn-label status-${s}`;
    },
    onLiveState: (state) => {
      rebuildPickers(state);
    },
    onGraphicsCommand: (cmd) => {
      if (cmd.action === 'hide_all') {
        setOnAir(null);
        return;
      }
      if (!cmd.graphic) {
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
    kind: GraphicsKind,
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
  bind('btn-show-hello', 'btn-hide-hello', 'hello');
  bind('btn-show-batsman', 'btn-hide-batsman', 'batsman', () => {
    const playerId = pickBatsman.value.trim();
    return playerId ? { playerId } : undefined;
  });
  bind('btn-show-bowler', 'btn-hide-bowler', 'bowler', () => {
    const playerId = pickBowler.value.trim();
    return playerId ? { playerId } : undefined;
  });

  el<HTMLButtonElement>('btn-hide-all').addEventListener('click', () => {
    send({ action: 'hide_all' });
  });
}

start();
