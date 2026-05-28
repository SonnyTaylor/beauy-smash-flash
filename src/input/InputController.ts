import type { InputSnapshot, WorldConfig } from '../shared/types';

const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd']);

export class InputController {
  private keys = new Set<string>();
  private pointer = { x: 0, y: 0 };
  private seq = 0;
  private canvas: HTMLCanvasElement | null = null;
  private world: WorldConfig = { width: 1920, height: 1080 };

  attach(canvas: HTMLCanvasElement, world: WorldConfig) {
    this.canvas = canvas;
    this.world = world;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  detach() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    this.keys.clear();
    this.canvas = null;
  }

  sample(): InputSnapshot {
    const dx = Number(this.keys.has('d')) - Number(this.keys.has('a'));
    const dy = Number(this.keys.has('s')) - Number(this.keys.has('w'));
    const center = {
      x: this.world.width / 2,
      y: this.world.height / 2,
    };

    return {
      seq: ++this.seq,
      dx,
      dy,
      aim_x: this.pointer.x - center.x,
      aim_y: this.pointer.y - center.y,
      fire: this.keys.has('mouse0'),
      reload: this.keys.has('r'),
      ability: this.keys.has('e'),
      dash: this.keys.has(' '),
    };
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (MOVEMENT_KEYS.has(key) || key === 'r' || key === 'e' || key === ' ') {
      event.preventDefault();
      this.keys.add(key);
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    this.pointer = {
      x: x * this.world.width,
      y: y * this.world.height,
    };
  };

  private handleMouseDown = (event: MouseEvent) => {
    this.keys.add(`mouse${event.button}`);
  };

  private handleMouseUp = (event: MouseEvent) => {
    this.keys.delete(`mouse${event.button}`);
  };
}
