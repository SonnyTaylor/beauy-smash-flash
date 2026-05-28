import { Application, Container, Graphics, Text } from 'pixi.js';
import { getCharacter } from '../content/characters';
import type { PlayerSnapshot, StateSnapshot, WorldConfig } from '../shared/types';
import { fitWorldToViewport } from './Viewport';

interface PlayerView {
  container: Container;
  body: Graphics;
  label: Text;
  targetX: number;
  targetY: number;
}

export class ArenaRenderer {
  readonly app = new Application();

  private root = new Container();
  private grid = new Graphics();
  private players = new Map<number, PlayerView>();
  private myId = 0;
  private world: WorldConfig = { width: 1920, height: 1080 };

  async mount(container: HTMLElement, world: WorldConfig, myId: number) {
    this.world = world;
    this.myId = myId;

    await this.app.init({
      backgroundColor: 0x050505,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      resizeTo: window,
    });

    container.appendChild(this.app.canvas);
    this.root.addChild(this.grid);
    this.app.stage.addChild(this.root);
    this.resize();

    window.addEventListener('resize', this.resize);
    this.app.ticker.add(() => this.renderFrame());
  }

  destroy() {
    window.removeEventListener('resize', this.resize);
    this.app.destroy(true, { children: true });
    this.players.clear();
  }

  applyState(snapshot: StateSnapshot) {
    this.world = snapshot.world;
    this.resize();

    const aliveIds = new Set<number>();
    for (const player of snapshot.players) {
      aliveIds.add(player.id);
      let view = this.players.get(player.id);
      if (!view) {
        view = this.createPlayer(player);
        this.players.set(player.id, view);
        this.root.addChild(view.container);
      }

      view.targetX = player.x;
      view.targetY = player.y;
      view.label.text = player.name || `P${player.id}`;
      view.container.rotation = player.angle;
    }

    for (const [id, view] of this.players) {
      if (!aliveIds.has(id)) {
        view.container.destroy({ children: true });
        this.players.delete(id);
      }
    }
  }

  private createPlayer(player: PlayerSnapshot): PlayerView {
    const character = getCharacter(player.character_id);
    const container = new Container();
    const color = rgbToHex(player.color);
    const body = new Graphics()
      .circle(0, 0, 24)
      .fill({ color, alpha: 0.95 })
      .circle(0, 0, 34)
      .stroke({ color, width: 2, alpha: 0.35 })
      .moveTo(20, 0)
      .lineTo(38, 0)
      .stroke({ color: 0xffffff, width: 3, alpha: 0.85 });

    const label = new Text({
      text: player.name || character.initials,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 16,
        fontWeight: '700',
        fill: player.id === this.myId ? 0xffffff : color,
        align: 'center',
      },
    });
    label.anchor.set(0.5);
    label.y = -44;
    label.rotation = 0;

    container.x = player.x;
    container.y = player.y;
    container.addChild(body, label);

    return {
      container,
      body,
      label,
      targetX: player.x,
      targetY: player.y,
    };
  }

  private renderFrame() {
    for (const view of this.players.values()) {
      view.container.x += (view.targetX - view.container.x) * 0.35;
      view.container.y += (view.targetY - view.container.y) * 0.35;
      view.label.rotation = -view.container.rotation;
    }
  }

  private resize = () => {
    const transform = fitWorldToViewport(this.world, this.app.screen.width, this.app.screen.height);
    this.root.scale.set(transform.scale);
    this.root.position.set(transform.offsetX, transform.offsetY);
    this.drawGrid();
  };

  private drawGrid() {
    this.grid.clear();
    this.grid.rect(0, 0, this.world.width, this.world.height).stroke({ color: 0x333333, width: 3 });

    const spacing = 80;
    for (let x = 0; x <= this.world.width; x += spacing) {
      this.grid.moveTo(x, 0).lineTo(x, this.world.height);
    }
    for (let y = 0; y <= this.world.height; y += spacing) {
      this.grid.moveTo(0, y).lineTo(this.world.width, y);
    }
    this.grid.stroke({ color: 0x141414, width: 1 });
  }
}

function rgbToHex([r, g, b]: [number, number, number]): number {
  return (r << 16) | (g << 8) | b;
}
