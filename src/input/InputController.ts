import type { InputSnapshot, WorldConfig } from '../shared/types';
import { fitWorldToViewport } from '../game/Viewport';
import { GAME_SAFE_AREA_INSETS } from '../game/safeArea';

const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd']);
const ACTION_KEYS = new Set(['r', 'e', 'q', 'g', 'f']);
const AIM_EPSILON = 1.5;
const HEARTBEAT_FRAMES = 15;

export class InputController {
  private keys = new Set<string>();
  private pointer = { x: 0, y: 0 };
  private hasPointer = false;
  private seq = 0;
  private canvas: HTMLCanvasElement | null = null;
  private world: WorldConfig = { width: 1920, height: 1080 };

  private enabled = true;
  private lastSent: Omit<InputSnapshot, 'seq'> | null = null;
  private framesSinceSend = 0;

  attach(canvas: HTMLCanvasElement, world: WorldConfig) {
    this.canvas = canvas;
    this.world = world;
    this.hasPointer = false;
    this.lastSent = null;
    this.framesSinceSend = 0;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('mouseleave', this.handleMouseLeave);
  }

  detach() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas?.removeEventListener('mouseleave', this.handleMouseLeave);
    this.keys.clear();
    this.canvas = null;
    this.hasPointer = false;
    this.lastSent = null;
    this.framesSinceSend = 0;
  }

  setWorld(world: WorldConfig) {
    this.world = world;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.lastSent = null;
      this.framesSinceSend = 0;
    }
  }

  sample(origin: { x: number; y: number } | null): InputSnapshot {
    return {
      ...this.buildSnapshot(origin),
      seq: ++this.seq,
    };
  }

  /** Returns null when input is unchanged and a heartbeat is not due yet. */
  sampleForNetwork(origin: { x: number; y: number } | null): InputSnapshot | null {
    const snapshot = this.buildSnapshot(origin);
    this.framesSinceSend += 1;

    const changed = this.lastSent === null || inputChanged(this.lastSent, snapshot);
    const heartbeat = this.framesSinceSend >= HEARTBEAT_FRAMES;
    if (!changed && !heartbeat) {
      return null;
    }

    this.lastSent = snapshot;
    this.framesSinceSend = 0;
    return {
      ...snapshot,
      seq: ++this.seq,
    };
  }

  private buildSnapshot(origin: { x: number; y: number } | null): Omit<InputSnapshot, 'seq'> {
    if (!this.enabled) {
      return {
        dx: 0,
        dy: 0,
        aim_x: 0,
        aim_y: 0,
        fire: false,
        reload: false,
        ability: false,
        dash: false,
        switch_weapon: false,
        drop_weapon: false,
        interact: false,
      };
    }

    const dx = Number(this.keys.has('d')) - Number(this.keys.has('a'));
    const dy = Number(this.keys.has('s')) - Number(this.keys.has('w'));
    const aimOrigin = origin ?? { x: this.world.width / 2, y: this.world.height / 2 };

    return {
      dx,
      dy,
      aim_x: this.pointer.x - aimOrigin.x,
      aim_y: this.pointer.y - aimOrigin.y,
      fire: this.keys.has('mouse0'),
      reload: this.keys.has('r'),
      ability: this.keys.has('e'),
      dash: false,
      switch_weapon: this.keys.has('q'),
      drop_weapon: this.keys.has('g'),
      interact: this.keys.has('f'),
    };
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (MOVEMENT_KEYS.has(key) || ACTION_KEYS.has(key)) {
      event.preventDefault();
      this.keys.add(key);
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };

  private updatePointerFromEvent(event: MouseEvent) {
    if (!this.canvas) return;
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const transform = fitWorldToViewport(
      this.world,
      width,
      height,
      GAME_SAFE_AREA_INSETS,
    );
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - transform.offsetX) / transform.scale;
    const y = (event.clientY - rect.top - transform.offsetY) / transform.scale;
    this.pointer = {
      x: clamp(x, 0, this.world.width),
      y: clamp(y, 0, this.world.height),
    };
    this.hasPointer = true;
  }

  private handleMouseMove = (event: MouseEvent) => {
    this.updatePointerFromEvent(event);
  };

  private handleMouseLeave = () => {
    // Keep last aim direction when cursor leaves the arena.
  };

  private handleMouseDown = (event: MouseEvent) => {
    this.updatePointerFromEvent(event);
    this.keys.add(`mouse${event.button}`);
  };

  private handleMouseUp = (event: MouseEvent) => {
    this.keys.delete(`mouse${event.button}`);
  };
}

function inputChanged(
  previous: Omit<InputSnapshot, 'seq'>,
  next: Omit<InputSnapshot, 'seq'>,
): boolean {
  return (
    previous.dx !== next.dx ||
    previous.dy !== next.dy ||
    Math.abs(previous.aim_x - next.aim_x) > AIM_EPSILON ||
    Math.abs(previous.aim_y - next.aim_y) > AIM_EPSILON ||
    previous.fire !== next.fire ||
    previous.reload !== next.reload ||
    previous.ability !== next.ability ||
    previous.dash !== next.dash ||
    previous.switch_weapon !== next.switch_weapon ||
    previous.drop_weapon !== next.drop_weapon ||
    previous.interact !== next.interact
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
