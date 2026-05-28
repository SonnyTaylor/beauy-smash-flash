import './styles.css';

import { ArenaRenderer } from './game/ArenaRenderer';
import { InputController } from './input/InputController';
import { TauriGameClient } from './net/TauriGameClient';
import type { SessionInfo, StateSnapshot } from './shared/types';

const menu = getElement('menu');
const hud = getElement('hud');
const gameContainer = getElement('game-container');
const joinIpInput = getElement<HTMLInputElement>('join-ip');
const playerNameInput = getElement<HTMLInputElement>('player-name');
const hostButton = getElement<HTMLButtonElement>('btn-host');
const joinButton = getElement<HTMLButtonElement>('btn-join');

const client = new TauriGameClient();
const renderer = new ArenaRenderer();
const input = new InputController();

let myId = 0;
let latestState: StateSnapshot | null = null;
let inputTimer: number | null = null;

client.listenForState((state) => {
  latestState = state;
  renderer.applyState(state);
  updateHud();
});

hostButton.addEventListener('click', async () => {
  await startSession(() => client.host(playerNameInput.value));
});

joinButton.addEventListener('click', async () => {
  const ip = joinIpInput.value.trim() || '127.0.0.1';
  await startSession(() => client.join(ip, playerNameInput.value));
});

async function startSession(createSession: () => Promise<SessionInfo>) {
  setMenuBusy(true);
  try {
    const session = await createSession();
    myId = session.player_id;
    menu.hidden = true;
    hud.hidden = false;
    await renderer.mount(gameContainer, session.world, myId);
    input.attach(renderer.app.canvas, session.world);
    inputTimer = window.setInterval(sendInput, 1000 / 60);
  } catch (error) {
    console.error(error);
    alert(`Could not start session: ${String(error)}`);
  } finally {
    setMenuBusy(false);
  }
}

async function sendInput() {
  try {
    await client.sendInput(input.sample());
  } catch {
    // UDP input is best-effort; short failures should not interrupt rendering.
  }
}

function updateHud() {
  const state = latestState;
  if (!state) {
    hud.textContent = 'Waiting for host state...';
    return;
  }

  const player = state.players.find((candidate) => candidate.id === myId);
  hud.textContent = [
    `Players: ${state.players.length}`,
    `You: ${player?.name || `P${myId}`}`,
    `Tick: ${state.tick}`,
    `${Math.round(renderer.app.ticker.FPS)} FPS`,
  ].join(' | ');
}

function setMenuBusy(isBusy: boolean) {
  hostButton.disabled = isBusy;
  joinButton.disabled = isBusy;
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

window.addEventListener('beforeunload', () => {
  if (inputTimer !== null) {
    window.clearInterval(inputTimer);
  }
  input.detach();
  client.dispose();
});

console.log('Beauy Smash Flash frontend loaded');
