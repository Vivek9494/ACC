import './graphics.css';
import {
  connectLiveSocket,
  queryApiAndMatch,
  type GraphicsCommandMessage,
} from './live-client';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing #${id}`);
  }
  return node as T;
}

const hello = el<HTMLDivElement>('hello');
const status = el<HTMLDivElement>('status');

function setHelloVisible(visible: boolean): void {
  if (visible) {
    hello.hidden = false;
    requestAnimationFrame(() => hello.classList.add('is-visible'));
  } else {
    hello.classList.remove('is-visible');
    window.setTimeout(() => {
      if (!hello.classList.contains('is-visible')) {
        hello.hidden = true;
      }
    }, 280);
  }
}

function applyCommand(cmd: GraphicsCommandMessage): void {
  if (cmd.action === 'hide_all') {
    setHelloVisible(false);
    return;
  }
  if (cmd.graphic !== 'hello') {
    return;
  }
  if (cmd.action === 'show') {
    setHelloVisible(true);
  } else if (cmd.action === 'hide') {
    setHelloVisible(false);
  }
}

function start(): void {
  const { matchId, apiBase } = queryApiAndMatch();
  if (!matchId) {
    status.hidden = false;
    status.textContent = 'Add ?matchId=…';
    return;
  }

  status.hidden = false;
  status.textContent = `Connecting to ${apiBase}…`;

  connectLiveSocket(apiBase, matchId, {
    onStatus: (s) => {
      if (s === 'live') {
        status.hidden = true;
        return;
      }
      status.hidden = false;
      status.textContent =
        s === 'connecting' ? `Connecting to ${apiBase}…` : `Reconnecting (${apiBase})…`;
    },
    onGraphicsCommand: applyCommand,
  });
}

start();
