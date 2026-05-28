import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');

let players = [];
let myId = null;
let stateReceived = false;
const keys = { w: false, a: false, s: false, d: false };

// Set up listener BEFORE any game starts
const setupListener = async () => {
  try {
    await listen('state', (e) => {
      console.log('State received:', e.payload);
      stateReceived = true;
      players = e.payload || [];
    });
    console.log('Event listener registered');
  } catch (err) {
    console.error('Failed to register listener:', err);
  }
};
setupListener();

function startGame() {
  menu.style.display = 'none';
  canvas.style.display = 'block';
  hud.style.display = 'block';
  requestAnimationFrame(loop);
  setInterval(sendInput, 33);
}

async function host() {
  try {
    myId = await invoke('start_host');
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
    myId = await invoke('join_game', { ip });
    console.log('Joined, myId:', myId);
    startGame();
  } catch (err) {
    console.error('Join failed:', err);
    alert('Join failed: ' + err);
  }
}

async function sendInput() {
  if (myId === null) return;
  let dx = 0, dy = 0;
  if (keys.w) dy -= 1;
  if (keys.s) dy += 1;
  if (keys.a) dx -= 1;
  if (keys.d) dx += 1;
  if (dx !== 0 || dy !== 0) {
    try {
      await invoke('send_input', { dx, dy });
    } catch (err) {
      // ignore input errors for now
    }
  }
}

function loop() {
  // Clear
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 800, 600);

  // Draw arena border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 798, 598);

  if (!stateReceived) {
    // Show waiting indicator
    ctx.fillStyle = '#555';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for game state...', 400, 300);
  }

  // Draw players
  for (const p of players) {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${p.c?.[0] || 255},${p.c?.[1] || 255},${p.c?.[2] || 255})`;
    ctx.fill();
    ctx.strokeStyle = p.id === myId ? '#fff' : '#888';
    ctx.lineWidth = p.id === myId ? 3 : 1;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`P${p.id}`, p.x, p.y - 22);
  }

  // HUD: player count
  ctx.fillStyle = '#aaa';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Players: ${players.length} | Me: P${myId ?? '?'}`, 10, 20);

  requestAnimationFrame(loop);
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
