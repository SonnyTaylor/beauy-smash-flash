import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { CHARACTERS, getCharacter } from '../content/characters';
import { getMap, getMapTheme } from '../content/maps';
import type { BulletSnapshot, MapSnapshot, PlayerSnapshot, RectSnapshot, StateSnapshot, WorldConfig } from '../shared/types';
import { fitWorldToViewport } from './Viewport';

const PLAYER_RADIUS = 26;
const PLAYER_DIAMETER = PLAYER_RADIUS * 2;
const BULLET_RADIUS = 4;

function assetUrl(relativePath: string): string {
  return `/assets/${relativePath}`;
}

interface PlayerView {
  container: Container;
  targetX: number;
  targetY: number;
  characterId: string;
}

export class ArenaRenderer {
  private app: Application | null = null;

  private root = new Container();
  private floorLayer = new Container();
  private wallLayer = new Container();
  private entityLayer = new Container();
  private floorFill = new Graphics();
  private grid = new Graphics();
  private wallContainer = new Container();
  private bullets = new Graphics();
  private players = new Map<number, PlayerView>();
  private headTextures = new Map<string, Texture>();
  private mounted = false;
  private myId = 0;
  private mapId: string | null = null;
  private mapSignature = '';
  private mapTheme = getMapTheme(undefined);
  private world: WorldConfig = { width: 1920, height: 1080 };

  get canvas(): HTMLCanvasElement {
    if (!this.app?.canvas) {
      throw new Error('ArenaRenderer is not mounted');
    }
    return this.app.canvas;
  }

  async mount(container: HTMLElement, world: WorldConfig, myId: number) {
    this.world = world;
    this.myId = myId;

    if (this.mounted) {
      this.destroy();
    }

    this.players.clear();
    this.mapId = null;
    this.mapSignature = '';
    this.mapTheme = getMapTheme(undefined);

    this.app = new Application();
    await this.app.init({
      backgroundColor: 0x060810,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      resizeTo: window,
    });
    await this.loadHeadTextures();

    container.appendChild(this.app.canvas);

    this.root = new Container();
    this.floorLayer = new Container();
    this.wallLayer = new Container();
    this.entityLayer = new Container();
    this.floorFill = new Graphics();
    this.grid = new Graphics();
    this.wallContainer = new Container();
    this.bullets = new Graphics();

    this.root.sortableChildren = true;
    this.floorLayer.zIndex = 0;
    this.wallLayer.zIndex = 1;
    this.entityLayer.zIndex = 2;

    this.floorLayer.addChild(this.floorFill, this.grid);
    this.wallLayer.addChild(this.wallContainer);
    this.entityLayer.addChild(this.bullets);
    this.root.addChild(this.floorLayer, this.wallLayer, this.entityLayer);
    this.root.sortChildren();
    this.app.stage.addChild(this.root);
    this.resize();

    window.addEventListener('resize', this.resize);
    this.app.ticker.add(() => this.renderFrame());
    this.mounted = true;
  }

  destroy() {
    window.removeEventListener('resize', this.resize);
    if (!this.mounted || !this.app) return;

    this.app.canvas.remove();
    this.app.destroy(true, { children: true });
    this.app = null;
    this.players.clear();
    this.headTextures.clear();
    this.mounted = false;
    this.mapId = null;
    this.mapSignature = '';
    this.mapTheme = getMapTheme(undefined);
  }

  applyState(snapshot: StateSnapshot) {
    if (!this.mounted || !this.app) return;

    this.world = snapshot.world;
    this.applyMap(snapshot.map);
    this.resize();
    this.applyBullets(snapshot.bullets);

    const aliveIds = new Set<number>();
    for (const player of snapshot.players) {
      if (!player.alive) {
        continue;
      }

      aliveIds.add(player.id);
      let view = this.players.get(player.id);
      if (view && view.characterId !== player.character_id) {
        view.container.destroy({ children: true });
        this.players.delete(player.id);
        view = undefined;
      }

      if (!view) {
        view = this.createPlayer(player);
        this.players.set(player.id, view);
      }

      if (view.container.parent !== this.entityLayer) {
        this.entityLayer.addChild(view.container);
      }

      this.updatePlayerVisuals(view, player);

      view.targetX = player.x;
      view.targetY = player.y;
      view.container.rotation = player.angle;
    }

    for (const [id, view] of this.players) {
      if (!aliveIds.has(id)) {
        view.container.destroy({ children: true });
        this.players.delete(id);
      }
    }
  }

  private updatePlayerVisuals(view: PlayerView, player: PlayerSnapshot) {
    const label = view.container.children.find((child) => child instanceof Text) as Text | undefined;
    if (label) {
      label.text = player.name || getCharacter(player.character_id).initials;
    }

    view.container.alpha = player.spawn_protected ? 0.75 : 1;
  }

  private applyBullets(bullets: BulletSnapshot[]) {
    this.bullets.clear();
    for (const bullet of bullets) {
      this.bullets.circle(bullet.x, bullet.y, BULLET_RADIUS);
    }
    this.bullets.fill({ color: 0xffff32, alpha: 0.95 });
  }

  private createPlayer(player: PlayerSnapshot): PlayerView {
    const character = getCharacter(player.character_id);
    const isMe = player.id === this.myId;
    const color = rgbToHex(player.color);
    const container = new Container();

    const shadow = new Graphics()
      .circle(0, 4, PLAYER_RADIUS + 10)
      .fill({ color: 0x000000, alpha: 0.35 });
    container.addChild(shadow);

    const avatar = this.createAvatar(character.sprite, character.initials, color);
    container.addChild(avatar);

    const aim = new Graphics()
      .moveTo(PLAYER_RADIUS - 2, 0)
      .lineTo(PLAYER_RADIUS + 16, 0)
      .stroke({ color: isMe ? 0xffffff : color, width: isMe ? 4 : 3, alpha: 0.9 });
    container.addChild(aim);

    const label = new Text({
      text: player.name || character.initials,
      style: {
        fontFamily: 'Impact, Haettenschweiler, Arial Narrow Bold, sans-serif',
        fontSize: 15,
        fontWeight: '700',
        fill: isMe ? 0xffffff : color,
        stroke: { color: 0x000000, width: 3 },
        align: 'center',
      },
    });
    label.anchor.set(0.5);
    label.y = -PLAYER_RADIUS - 18;
    container.addChild(label);

    container.x = player.x;
    container.y = player.y;

    return {
      container,
      characterId: player.character_id,
      targetX: player.x,
      targetY: player.y,
    };
  }

  private createAvatar(spritePath: string, initials: string, accentColor: number): Container {
    const avatar = new Container();
    const texture = this.headTextures.get(spritePath);

    if (texture) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      const scale = PLAYER_DIAMETER / Math.max(texture.width, texture.height);
      sprite.scale.set(scale);
      avatar.addChild(sprite);
    } else {
      const fallback = new Graphics()
        .circle(0, 0, PLAYER_RADIUS)
        .fill({ color: accentColor, alpha: 0.9 })
        .circle(0, 0, PLAYER_RADIUS)
        .stroke({ color: 0xffffff, width: 2, alpha: 0.5 });
      avatar.addChild(fallback);

      const initialsText = new Text({
        text: initials,
        style: {
          fontFamily: 'Impact, Haettenschweiler, Arial Narrow Bold, sans-serif',
          fontSize: 18,
          fontWeight: '900',
          fill: 0xffffff,
        },
      });
      initialsText.anchor.set(0.5);
      avatar.addChild(initialsText);
    }

    const ring = new Graphics()
      .circle(0, 0, PLAYER_RADIUS + 2)
      .stroke({ color: accentColor, width: 3, alpha: 0.95 })
      .circle(0, 0, PLAYER_RADIUS + 5)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.25 });
    avatar.addChild(ring);

    return avatar;
  }

  private renderFrame() {
    for (const view of this.players.values()) {
      view.container.x += (view.targetX - view.container.x) * 0.35;
      view.container.y += (view.targetY - view.container.y) * 0.35;
      const label = view.container.children.find((child) => child instanceof Text) as Text | undefined;
      if (label) {
        label.rotation = -view.container.rotation;
      }
    }
  }

  private resize = () => {
    if (!this.app) return;
    const transform = fitWorldToViewport(this.world, this.app.screen.width, this.app.screen.height);
    this.root.scale.set(transform.scale);
    this.root.position.set(transform.offsetX, transform.offsetY);
    this.drawFloor();
  };

  private drawFloor() {
    const floor = hexToNumber(this.mapTheme.floor);
    const gridColor = hexToNumber(this.mapTheme.grid);
    const border = hexToNumber(this.mapTheme.wallStroke);

    this.floorFill.clear();
    this.floorFill
      .rect(0, 0, this.world.width, this.world.height)
      .fill({ color: floor, alpha: 1 })
      .stroke({ color: border, width: 4, alpha: 0.7 });

    this.grid.clear();
    const spacing = 80;
    for (let x = 0; x <= this.world.width; x += spacing) {
      this.grid.moveTo(x, 0).lineTo(x, this.world.height);
    }
    for (let y = 0; y <= this.world.height; y += spacing) {
      this.grid.moveTo(0, y).lineTo(this.world.width, y);
    }
    this.grid.stroke({ color: gridColor, width: 1, alpha: 0.45 });
  }

  private applyMap(map: MapSnapshot) {
    if (!map?.id) return;

    const walls = getMap(map.id).walls;
    const needsRebuild = map.id !== this.mapSignature || this.wallContainer.children.length === 0;

    if (!needsRebuild) return;

    this.mapId = map.id;
    this.mapSignature = map.id;
    this.mapTheme = getMapTheme(map.id);
    this.rebuildWalls(walls);
  }

  private rebuildWalls(walls: RectSnapshot[]) {
    this.wallContainer.removeChildren().forEach((child) => child.destroy(true));

    const fillColor = hexToNumber(this.mapTheme.walls);
    const strokeColor = hexToNumber(this.mapTheme.wallStroke);

    for (const wall of walls) {
      if (wall.w <= 0 || wall.h <= 0) continue;

      const outline = new Sprite(Texture.WHITE);
      outline.position.set(wall.x - 2, wall.y - 2);
      outline.width = wall.w + 4;
      outline.height = wall.h + 4;
      outline.tint = strokeColor;
      outline.alpha = 0.95;

      const block = new Sprite(Texture.WHITE);
      block.position.set(wall.x, wall.y);
      block.width = wall.w;
      block.height = wall.h;
      block.tint = fillColor;
      block.alpha = 1;

      this.wallContainer.addChild(outline, block);
    }
  }

  private async loadHeadTextures() {
    await Promise.all(
      CHARACTERS.map(async (character) => {
        const texture = await loadTextureFromUrl(assetUrl(character.sprite));
        if (texture) {
          this.headTextures.set(character.sprite, texture);
        }
      }),
    );
  }
}

function loadTextureFromUrl(url: string): Promise<Texture | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(Texture.from(image));
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function rgbToHex([r, g, b]: [number, number, number]): number {
  return (r << 16) | (g << 8) | b;
}

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}
