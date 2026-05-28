import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import * as PIXI from 'pixi.js';

const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const container = document.getElementById('game-container');

let app = null;
let players = [];
let myId = null;
let stateReceived = false;
const keys = { w: false, a: false, s: false, d: false };
const graphicsMap = new Map(); // id -> PIXI.Container

const setupListener = async () => {
  try {
    await listen('state', (e) => {
      stateReceived = true;
      players = e.payload || [];
    });
    console.log('Event listener registered');
  } catch (err) {
    console.error('Failed to register listener:', err);
  }
};
setupListener();

function getWindowSize() {
  return { w: window.innerWidth, h: window.innerHeight };
}

async function initPixi() {
  const { w, h } = getWindowSize();

  app = new PIXI.Application();
  await app.init({
    width: w,
    height: h,
    backgroundColor: 0x050505,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.appendChild(app.canvas);
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';

  // Grid background
  const grid = new PIXI.Graphics();
  drawGrid(grid, w, h);
  app.stage.addChild(grid);

  // Border
  const border = new PIXI.Graphics();
  border.lineStyle(2, 0x333333, 1);
  border.drawRect(1, 1, w - 2, h - 2);
  app.stage.addChild(border);

  // Handle resize
  window.addEventListener('resize', () => {
    const { w: nw, h: nh } = getWindowSize();
    app.renderer.resize(nw, nh);
    grid.clear();
    drawGrid(grid, nw, nh);
    border.clear();
    border.lineStyle(2, 0x333333, 1);
    border.drawRect(1, 1, nw - 2, nh - 2);
  });
}

function drawGrid(g, w, h) {
  const spacing = 50;
  g.lineStyle(1, 0x111111, 1);
  for (let x = 0; x < w; x += spacing) {
    g.moveTo(x, 0);
    g.lineTo(x, h);
  }
  for (let y = 0; y < h; y += spacing) {
    g.moveTo(0, y);
    g.lineTo(w, y);
  }
}

function createPlayerGraphics(p) {
  const cont = new PIXI.Container();

  // Glow
  const glow = new PIXI.Graphics();
  glow.beginFill((p.c[0] << 16) | (p.c[1] << 8) | p.c[2], 0.15);
  glow.drawCircle(0, 0, 28);
  glow.endFill();
  cont.addChild(glow);

  // Body
  const body = new PIXI.Graphics();
  body.beginFill((p.c[0] << 16) | (p.c[1] << 8) | p.c[2]);
  body.drawCircle(0, 0, 16);
  body.endFill();
  cont.addChild(body);

  // Outline
  const outline = new PIXI.Graphics();
  outline.lineStyle(p.id === myId ? 3 : 1, 0xffffff, 0.8);
  outline.drawCircle(0, 0, 16);
  cont.addChild(outline);

  // Label
  const label = new PIXI.Text({
    text: `P${p.id}`,
    style: {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 12,
      fill: 0xffffff,
      align: 'center',
    },
  });
  label.anchor.set(0.5);
  label.y = -26;
  cont.addChild(label);

  cont.x = p.x;
  cont.y = p.y;
  return cont;
}

function startGame() {
  menu.style.display = 'none';
  hud.style.display = 'block';
  initPixi().then(() => {
    app.ticker.add(gameLoop);
    setInterval(sendInput, 33);
  });
}

async function host() {
  try {
    const { w, h } = getWindowSize();
    myId = await invoke('start_host', { width: w, height: h });
    console.log('Host started, myId:', myId);
    startGame();
  } catch (err) {
    console.error('Host failed:', err);
    alert('Host failed: ' + err);
  }
}

async function join() {
  try {
    const ip = document.getElementById('join-ip').value || '127.0.0.1';
    const { w, h } = getWindowSize();
    myId = await invoke('join_game', { ip, width: w, height: h });
    console.log('Joined, myId:', myId);
    startGame();
  } catch (err) {
    console.error('Join failed:', err);
    alert('Join failed: ' + err);
  }
}

async function sendInput() {
  if (myId === null || !app) return;
  let dx = 0, dy = 0;
  if (keys.w) dy -= 1;
  if (keys.s) dy += 1;
  if (keys.a) dx -= 1;
  if (keys.d) dx += 1;
  if (dx !== 0 || dy !== 0) {
    try {
      await invoke('send_input', { dx, dy });
    } catch (err) {
      // ignore
    }
  }
}

function gameLoop() {
  if (!app) return;

  const currentIds = new Set();

  for (const p of players) {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;
    currentIds.add(p.id);

    let cont = graphicsMap.get(p.id);
    if (!cont) {
      cont = createPlayerGraphics(p);
      app.stage.addChild(cont);
      graphicsMap.set(p.id, cont);
    }

    // Smooth interpolation
    cont.x += (p.x - cont.x) * 0.3;
    cont.y += (p.y - cont.y) * 0.3;

    // Update outline thickness if myId changed
    const outline = cont.children[2];
    if (outline && outline instanceof PIXI.Graphics) {
      // Recreate outline to update thickness — simple enough for now
      // In a real game you'd track myId changes separately
    }
  }

  // Remove disconnected players
  for (const [id, cont] of graphicsMap) {
    if (!currentIds.has(id)) {
      app.stage.removeChild(cont);
      cont.destroy({ children: true });
      graphicsMap.delete(id);
    }
  }

  // Update HUD
  hud.textContent = `Players: ${players.length} | Me: P${myId ?? '?'} | ${Math.round(app.ticker.FPS)} FPS`;
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = true;
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = false;
});

document.getElementById('btn-host').addEventListener('click', host);
document.getElementById('btn-join').addEventListener('click', join);

console.log('Beauy Smash Flash frontend loaded');
