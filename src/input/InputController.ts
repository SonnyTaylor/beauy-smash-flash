import type { InputSnapshot, WorldConfig } from '../shared/types';
import { fitWorldToViewport } from '../game/Viewport';
import { GAME_SAFE_AREA_INSETS } from '../game/safeArea';

const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd']);

export class InputController {
  private keys = new Set<string>();
  private pointer = { x: 0, y: 0 };
  private hasPointer = false;
  private seq = 0;
  private canvas: HTMLCanvasElement | null = null;
  private world: WorldConfig = { width: 1920, height: 1080 };

  private enabled = true;

  attach(canvas: HTMLCanvasElement, world: WorldConfig) {
    this.canvas = canvas;
    this.world = world;
    this.hasPointer = false;
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
  }

  setWorld(world: WorldConfig) {
    this.world = world;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
    }
  }

  sample(origin: { x: number; y: number } | null): InputSnapshot {
    if (!this.enabled) {
      return {
        seq: ++this.seq,
        dx: 0,
        dy: 0,
        aim_x: 0,
        aim_y: 0,
        fire: false,
        reload: false,
        ability: false,
        dash: false,
      };
    }

    const dx = Number(this.keys.has('d')) - Number(this.keys.has('a'));
    const dy = Number(this.keys.has('s')) - Number(this.keys.has('w'));
    const aimOrigin = origin ?? { x: this.world.width / 2, y: this.world.height / 2 };

    return {
      seq: ++this.seq,
      dx,
      dy,
      aim_x: this.pointer.x - aimOrigin.x,
      aim_y: this.pointer.y - aimOrigin.y,
      fire: this.keys.has('mouse0'),
      reload: this.keys.has('r'),
      ability: this.keys.has('e'),
      dash: false,
    };
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (MOVEMENT_KEYS.has(key) || key === 'r' || key === 'e') {
      event.preventDefault();
      this.keys.add(key);
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };

  private updatePointerFromEvent(event: MouseEvent) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const transform = fitWorldToViewport(
      this.world,
      rect.width,
      rect.height,
      GAME_SAFE_AREA_INSETS,
    );
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
