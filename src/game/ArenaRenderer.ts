import { Application, ColorMatrixFilter, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { CHARACTERS, getCharacter } from '../content/characters';
import { getMap, getMapTheme } from '../content/maps';
import { getWeapon, listWeapons, weaponOrbitPosition } from '../content/weapons';
import type {
  BulletSnapshot,
  MapSnapshot,
  PlayerSnapshot,
  RectSnapshot,
  StateSnapshot,
  WeaponPickupSnapshot,
  WorldConfig,
  WorldEffectSnapshot,
} from '../shared/types';
import { VfxManager } from './vfx/VfxManager';
import { fitWorldToViewport } from './Viewport';
import { GAME_SAFE_AREA_INSETS } from './safeArea';
import {
  computeVisibilityPolygon,
  hasLineOfSight,
  isSimpleVisibilityPolygon,
  rectsToSegments,
  type Point,
  type Segment,
} from './fog/visibility';

const PLAYER_RADIUS = 26;
const PLAYER_DIAMETER = PLAYER_RADIUS * 2;
const BULLET_RADIUS = 4;
const FOOT_OFFSET_Y = 22;
const MOVE_DUST_SPEED = 100;
const MOVE_DUST_INTERVAL_MS = 100;
const BULLET_LERP_RATE = 32;
const PLAYER_LERP_RATE = 24;
const BULLET_TRAIL_LENGTH = 4;
const BULLET_COLORS: Record<string, number> = {
  glock: 0xffff32,
  scar: 0xffaa44,
  shotgun: 0xd4d4d4,
  raygun: 0x44ffcc,
  laser_gun: 0xff3344,
  chicken_bucket: 0xe8940a,
  jarate: 0xffdd44,
  feces: 0x8b5a2b,
  yoghurt_effect: 0xff6eb4,
  popcorn: 0xfff2c4,
};
const POPCORN_TRAIL_LENGTH = 10;
const BULLET_RADIUS_BY_WEAPON: Record<string, number> = {
  glock: BULLET_RADIUS,
  scar: 4,
  shotgun: 3,
  raygun: 5,
  laser_gun: 3,
  chicken_bucket: 7,
  jarate: 4,
  feces: 5,
  yoghurt_effect: 6,
  popcorn: 5,
};
const RELOAD_GUN_TILT = Math.PI * 0.42;
const MELEE_SWING_DURATION = 0.18;
const MELEE_SWING_ARC = Math.PI * 0.72;
const FOG_VISION_RADIUS = 420;

const HACK_GREEN_BRIGHT = 0x00ff41;
const HACK_GREEN_NEON = 0x39ff14;
const HACK_GREEN_DIM = 0x00b32d;

function assetUrl(relativePath: string): string {
  return `/assets/${relativePath}`;
}

const MARK_GOLD = 0xffcc00;

interface PlayerView {
  container: Container;
  gun: Sprite | null;
  shield: Graphics;
  hackAura: Graphics;
  markAura: Graphics;
  truthReticle: Graphics;
  weaponId: string;
  targetX: number;
  targetY: number;
  targetAngle: number;
  displayAngle: number;
  targetGunAngle: number;
  displayGunAngle: number;
  isReloading: boolean;
  lastX: number;
  lastY: number;
  lastDustAt: number;
  wasSpawnProtected: boolean;
  characterId: string;
  accentColor: number;
  meleeSwingRemaining: number;
  meleeSwingAngle: number;
  hackedRemaining: number;
  markedRemaining: number;
  abilityWindup: number;
  abilityAimX: number;
  abilityAimY: number;
}

interface TruthNukeView {
  gfx: Graphics;
  targetX: number;
  targetY: number;
  lastX: number;
  lastY: number;
  lastTrailAt: number;
}

interface PickupView {
  container: Container;
  sprite: Sprite;
  glow: Graphics;
  targetX: number;
  targetY: number;
  bobPhase: number;
}

export class ArenaRenderer {
  private app: Application | null = null;

  private root = new Container();
  private floorLayer = new Container();
  private wallLayer = new Container();
  private entityLayer = new Container();
  private vfxLayer = new Container();
  private fogLayer = new Container();
  private fogOverlay = new Graphics();
  private floorFill = new Graphics();
  private grid = new Graphics();
  private wallContainer = new Container();
  private bullets = new Graphics();
  private bulletStates = new Map<
    number,
    {
      x: number;
      y: number;
      targetX: number;
      targetY: number;
      ownerId: number;
      weaponId: string;
      trail: Array<{ x: number; y: number }>;
    }
  >();
  private players = new Map<number, PlayerView>();
  private pickups = new Map<number, PickupView>();
  private pickupLayer = new Container();
  private headTextures = new Map<string, Texture>();
  private weaponTextures = new Map<string, Texture>();
  private vfx = new VfxManager();
  private truthNukes = new Map<number, TruthNukeView>();
  private mounted = false;
  private myId = 0;
  private mapId: string | null = null;
  private mapSignature = '';
  private mapTheme = getMapTheme(undefined);
  private world: WorldConfig = { width: 1920, height: 1080 };
  private knownBulletIds = new Set<number>();
  private knownEffectIds = new Set<number>();
  private lastFrameMs = 0;
  private mountContainer: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private viewportMask = new Graphics();
  private viewportWidth = 0;
  private viewportHeight = 0;
  private fogEnabled = false;
  private directorsCutCasterId: number | null = null;
  private readonly directorsCutGrayFilter = (() => {
    const filter = new ColorMatrixFilter();
    filter.desaturate();
    filter.brightness(0.72, false);
    return filter;
  })();
  private fogOriginX = 0;
  private fogOriginY = 0;
  private localPlayerX = 0;
  private localPlayerY = 0;
  private wallRects: RectSnapshot[] = [];
  private wallSegments: Segment[] = [];
  private visibilityPolygon: Point[] = [];

  get canvas(): HTMLCanvasElement {
    if (!this.app?.canvas) {
      throw new Error('ArenaRenderer is not mounted');
    }
    return this.app.canvas;
  }

  get isMounted(): boolean {
    return this.mounted;
  }

  prepareRematch() {
    this.knownBulletIds.clear();
    this.knownEffectIds.clear();
    this.bulletStates.clear();
    this.vfx.clear();
    for (const view of this.truthNukes.values()) {
      view.gfx.destroy();
    }
    this.truthNukes.clear();
    for (const view of this.pickups.values()) {
      view.container.destroy({ children: true });
    }
    this.pickups.clear();
    for (const view of this.players.values()) {
      view.wasSpawnProtected = false;
    }
  }

  async mount(container: HTMLElement, world: WorldConfig, myId: number) {
    this.world = world;
    this.myId = myId;
    this.mountContainer = container;

    if (this.mounted) {
      this.destroy();
    }

    this.players.clear();
    this.knownBulletIds.clear();
    this.knownEffectIds.clear();
    this.bulletStates.clear();
    this.mapId = null;
    this.mapSignature = '';
    this.mapTheme = getMapTheme(undefined);
    this.vfx.clear();

    const initialWidth = Math.max(1, container.clientWidth);
    const initialHeight = Math.max(1, container.clientHeight);

    this.app = new Application();
    await this.app.init({
      backgroundColor: 0x060810,
      antialias: true,
      autoDensity: false,
      resolution: window.devicePixelRatio || 1,
      width: initialWidth,
      height: initialHeight,
    });
    container.appendChild(this.app.canvas);
    await this.loadTextures();

    this.root = new Container();
    this.floorLayer = new Container();
    this.wallLayer = new Container();
    this.entityLayer = new Container();
    this.vfxLayer = this.vfx.container;
    this.floorFill = new Graphics();
    this.grid = new Graphics();
    this.wallContainer = new Container();
    this.bullets = new Graphics();
    this.pickupLayer = new Container();

    this.root.sortableChildren = true;
    this.floorLayer.zIndex = 0;
    this.wallLayer.zIndex = 1;
    this.entityLayer.zIndex = 2;
    this.vfxLayer.zIndex = 3;
    this.fogLayer.zIndex = 4;

    this.entityLayer.sortableChildren = true;
    this.pickupLayer.zIndex = 0;
    this.bullets.zIndex = 1;

    this.floorLayer.addChild(this.floorFill, this.grid);
    this.wallLayer.addChild(this.wallContainer);
    this.entityLayer.addChild(this.pickupLayer, this.bullets);
    this.fogLayer.addChild(this.fogOverlay);
    this.root.addChild(this.floorLayer, this.wallLayer, this.entityLayer, this.vfxLayer, this.fogLayer);
    this.root.sortChildren();
    this.viewportMask = new Graphics();
    this.root.mask = this.viewportMask;
    this.app.stage.addChild(this.viewportMask, this.root);
    this.resizeObserver = new ResizeObserver(() => this.syncViewport(true));
    this.resizeObserver.observe(container);
    this.syncViewport(true);

    this.lastFrameMs = performance.now();
    this.app.ticker.add(() => this.renderFrame());
    this.mounted = true;
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mountContainer = null;
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    if (!this.mounted || !this.app) return;

    this.app.canvas.remove();
    this.app.destroy(true, { children: true });
    this.app = null;
    this.players.clear();
    for (const view of this.pickups.values()) {
      view.container.destroy({ children: true });
    }
    this.pickups.clear();
    this.headTextures.clear();
    this.weaponTextures.clear();
    this.knownBulletIds.clear();
    this.knownEffectIds.clear();
    this.bulletStates.clear();
    this.vfx.clear();
    for (const view of this.truthNukes.values()) {
      view.gfx.destroy();
    }
    this.truthNukes.clear();
    this.mounted = false;
    this.mapId = null;
    this.mapSignature = '';
    this.mapTheme = getMapTheme(undefined);
    this.wallRects = [];
    this.wallSegments = [];
    this.visibilityPolygon = [];
  }

  applyState(snapshot: StateSnapshot) {
    if (!this.mounted || !this.app) return;

    this.fogEnabled = snapshot.fog_of_war ?? false;
    this.directorsCutCasterId =
      snapshot.players.find((player) => (player.directors_cut_remaining ?? 0) > 0)?.id ?? null;
    const me = snapshot.players.find((player) => player.id === this.myId);
    if (me) {
      this.localPlayerX = me.x;
      this.localPlayerY = me.y;
      this.fogOriginX = me.x;
      this.fogOriginY = me.y;
    }

    const worldChanged =
      this.world.width !== snapshot.world.width || this.world.height !== snapshot.world.height;
    this.world = snapshot.world;
    this.applyMap(snapshot.map);
    if (worldChanged) {
      this.syncViewport(true);
    }
    this.syncBulletTargets(snapshot.bullets);
    this.syncWeaponPickups(snapshot.weapon_pickups ?? []);
    this.syncWorldEffects(snapshot.effects ?? []);
    this.syncTruthNukes(snapshot.effects ?? []);
    this.detectMuzzleFlashes(snapshot.bullets, snapshot.players, me);

    const aliveIds = new Set<number>();
    for (const player of snapshot.players) {
      if (!player.alive) {
        continue;
      }

      aliveIds.add(player.id);
      let view = this.players.get(player.id);
      if (view && view.characterId !== player.character_id) {
        view.truthReticle.destroy();
        view.container.destroy({ children: true });
        this.players.delete(player.id);
        view = undefined;
      }

      if (!view) {
        view = this.createPlayer(player);
        this.players.set(player.id, view);
        if (player.spawn_protected) {
          this.vfx.emitSpawnBurst(player.x, player.y, view.accentColor);
          view.wasSpawnProtected = true;
        }
      }

      if (view.container.parent !== this.entityLayer) {
        this.entityLayer.addChild(view.container);
      }

      if (player.spawn_protected && !view.wasSpawnProtected) {
        this.vfx.emitSpawnBurst(player.x, player.y, view.accentColor);
      }
      view.wasSpawnProtected = player.spawn_protected;

      this.updatePlayerVisuals(view, player);
      this.syncPlayerWeapon(view, player.active_weapon ?? '');

      view.targetX = player.x;
      view.targetY = player.y;
      view.targetAngle = player.angle;
      view.isReloading = player.reloading || player.reload_remaining > 0;
      view.targetGunAngle = view.isReloading ? player.angle + RELOAD_GUN_TILT : player.angle;

      const inVision =
        !this.fogEnabled || player.id === this.myId || this.isInVision(player.x, player.y);
      view.container.visible = inVision;
    }

    for (const [id, view] of this.players) {
      if (!aliveIds.has(id)) {
        view.truthReticle.destroy();
        view.container.destroy({ children: true });
        this.players.delete(id);
      }
    }
  }

  private syncWorldEffects(effects: WorldEffectSnapshot[]) {
    const liveIds = new Set<number>();
    for (const effect of effects) {
      liveIds.add(effect.id);
      if (this.knownEffectIds.has(effect.id)) {
        continue;
      }
      if (this.fogEnabled && !this.isInVision(effect.x, effect.y)) {
        this.knownEffectIds.add(effect.id);
        continue;
      }
      this.knownEffectIds.add(effect.id);
      if (effect.kind === 'explosion') {
        this.vfx.emitExplosion(effect.x, effect.y, effect.radius);
      } else if (effect.kind === 'truth_explosion') {
        this.vfx.emitTruthExplosion(effect.x, effect.y, effect.radius);
      } else if (effect.kind === 'aim_reticle') {
        this.vfx.emitAimReticle(effect.x, effect.y, effect.radius);
      } else if (effect.kind === 'hack') {
        const caster = this.players.get(effect.owner_id);
        const casterX = caster?.targetX ?? effect.x;
        const casterY = caster?.targetY ?? effect.y;
        this.vfx.emitHackPulse(casterX, casterY, effect.x, effect.y, effect.radius);
      } else if (effect.kind === 'splat') {
        this.vfx.emitSplat(effect.x, effect.y, effect.radius);
      } else if (effect.kind === 'mark') {
        this.vfx.emitMark(effect.x, effect.y, effect.radius);
      } else if (effect.kind === 'poison') {
        this.vfx.emitPoison(effect.x, effect.y, effect.radius);
      } else if (effect.kind === 'zap') {
        this.vfx.emitZap(effect.x, effect.y, effect.radius);
      } else if (effect.kind === 'slash') {
        const view = this.players.get(effect.owner_id);
        if (view) {
          const aimAngle = Math.atan2(effect.y - view.targetY, effect.x - view.targetX);
          view.meleeSwingRemaining = MELEE_SWING_DURATION;
          view.meleeSwingAngle = aimAngle;
          this.vfx.emitSlash(view.targetX, view.targetY, aimAngle, effect.radius);
        }
      } else if (effect.kind === 'wall_hit') {
        const dirX = effect.target_x ?? 1;
        const dirY = effect.target_y ?? 0;
        this.vfx.emitWallImpact(effect.x, effect.y, dirX, dirY, effect.radius);
      } else if (effect.kind === 'directors_cut') {
        this.vfx.emitDirectorsCut(effect.x, effect.y, effect.radius);
      }
    }

    for (const id of this.knownEffectIds) {
      if (!liveIds.has(id)) {
        this.knownEffectIds.delete(id);
      }
    }
  }

  private syncTruthNukes(effects: WorldEffectSnapshot[]) {
    const liveIds = new Set<number>();
    for (const effect of effects) {
      if (effect.kind !== 'truth_nuke') {
        continue;
      }
      liveIds.add(effect.id);
      if (this.fogEnabled && !this.isInVision(effect.x, effect.y)) {
        continue;
      }

      let view = this.truthNukes.get(effect.id);
      if (!view) {
        const gfx = new Graphics();
        this.entityLayer.addChild(gfx);
        view = { gfx, targetX: effect.x, targetY: effect.y, lastX: effect.x, lastY: effect.y, lastTrailAt: 0 };
        this.truthNukes.set(effect.id, view);
      }
      view.targetX = effect.x;
      view.targetY = effect.y;
      view.gfx.visible = true;
    }

    for (const [id, view] of this.truthNukes) {
      if (!liveIds.has(id)) {
        view.gfx.destroy();
        this.truthNukes.delete(id);
      }
    }
  }

  private detectMuzzleFlashes(
    bullets: BulletSnapshot[],
    players: PlayerSnapshot[],
    me: PlayerSnapshot | undefined,
  ) {
    const playerById = new Map(players.map((player) => [player.id, player]));

    for (const bullet of bullets) {
      if (this.knownBulletIds.has(bullet.id)) {
        continue;
      }
      if (
        this.fogEnabled &&
        me &&
        bullet.owner_id !== this.myId &&
        !this.isInVision(bullet.x, bullet.y)
      ) {
        this.knownBulletIds.add(bullet.id);
        continue;
      }
      this.knownBulletIds.add(bullet.id);

      const owner = playerById.get(bullet.owner_id);
      const angle = owner?.angle ?? Math.atan2(bullet.y, bullet.x);
      // Bullet spawn position from server is at the muzzle — use it directly.
      this.vfx.emitMuzzleFlash(bullet.x, bullet.y, angle);
    }

    const liveIds = new Set(bullets.map((bullet) => bullet.id));
    for (const id of this.knownBulletIds) {
      if (!liveIds.has(id)) {
        this.knownBulletIds.delete(id);
      }
    }
  }

  private updateGun(view: PlayerView, angle: number) {
    if (!view.gun) return;
    const meta = getWeapon(view.weaponId).meta;
    let aimAngle = angle;

    if (view.meleeSwingRemaining > 0) {
      const progress = 1 - view.meleeSwingRemaining / MELEE_SWING_DURATION;
      const eased = 1 - (1 - progress) ** 2.4;
      const halfArc = MELEE_SWING_ARC * 0.5;
      aimAngle = view.meleeSwingAngle - halfArc + eased * MELEE_SWING_ARC;
    }

    const orbit = weaponOrbitPosition(meta, aimAngle);
    view.gun.position.set(orbit.x, orbit.y);
    view.gun.rotation = aimAngle + meta.defaultRotation;
  }

  private syncPlayerWeapon(view: PlayerView, weaponId: string) {
    if (view.weaponId === weaponId) {
      return;
    }

    view.weaponId = weaponId;
    if (view.gun) {
      view.container.removeChild(view.gun);
      view.gun.destroy();
      view.gun = null;
    }

    const texture = this.weaponTextures.get(weaponId);
    if (!texture) {
      return;
    }

    const def = getWeapon(weaponId);
    const gun = new Sprite(texture);
    gun.anchor.set(def.meta.pivot.x, def.meta.pivot.y);
    gun.scale.set(def.meta.displayScale);
    view.gun = gun;

    const avatarIndex = view.container.getChildIndex(view.shield) + 1;
    view.container.addChildAt(gun, Math.min(avatarIndex + 1, view.container.children.length));
  }

  private syncWeaponPickups(pickups: WeaponPickupSnapshot[]) {
    const liveIds = new Set<number>();

    for (const pickup of pickups) {
      liveIds.add(pickup.id);
      let view = this.pickups.get(pickup.id);
      if (!view) {
        view = this.createPickup(pickup);
        this.pickups.set(pickup.id, view);
        this.pickupLayer.addChild(view.container);
      } else if (view.sprite.texture !== this.weaponTextures.get(pickup.weapon_id)) {
        this.refreshPickupSprite(view, pickup.weapon_id);
      }

      view.targetX = pickup.x;
      view.targetY = pickup.y;
      const inVision =
        !this.fogEnabled || this.isInVision(pickup.x, pickup.y);
      view.container.visible = inVision;
    }

    for (const [id, view] of this.pickups) {
      if (!liveIds.has(id)) {
        view.container.destroy({ children: true });
        this.pickups.delete(id);
      }
    }
  }

  private createPickup(pickup: WeaponPickupSnapshot): PickupView {
    const container = new Container();
    const glow = new Graphics()
      .circle(0, 0, 22)
      .fill({ color: 0x7dd3fc, alpha: 0.18 })
      .circle(0, 0, 22)
      .stroke({ color: 0x38bdf8, width: 2, alpha: 0.45 });
    container.addChild(glow);

    const def = getWeapon(pickup.weapon_id);
    const texture = this.weaponTextures.get(pickup.weapon_id);
    const sprite = texture ? new Sprite(texture) : new Sprite(Texture.WHITE);
    sprite.anchor.set(def.meta.pivot.x, def.meta.pivot.y);
    sprite.scale.set(def.meta.displayScale * 0.92);
    sprite.rotation = Math.PI * 0.5;
    sprite.alpha = 0.95;
    container.addChild(sprite);

    container.x = pickup.x;
    container.y = pickup.y;

    return {
      container,
      sprite,
      glow,
      targetX: pickup.x,
      targetY: pickup.y,
      bobPhase: Math.random() * Math.PI * 2,
    };
  }

  private refreshPickupSprite(view: PickupView, weaponId: string) {
    const def = getWeapon(weaponId);
    const texture = this.weaponTextures.get(weaponId);
    if (texture) {
      view.sprite.texture = texture;
    }
    view.sprite.anchor.set(def.meta.pivot.x, def.meta.pivot.y);
    view.sprite.scale.set(def.meta.displayScale * 0.92);
  }

  private updatePlayerVisuals(view: PlayerView, player: PlayerSnapshot) {
    const label = view.container.children.find((child) => child instanceof Text) as Text | undefined;
    if (label) {
      label.text = player.name || getCharacter(player.character_id).initials;
    }

    view.container.alpha = player.spawn_protected ? 0.85 : 1;
    view.shield.visible = player.spawn_protected;
      view.hackedRemaining = player.hacked_remaining;
      view.markedRemaining = player.marked_remaining ?? 0;
      view.hackAura.visible = player.hacked_remaining > 0;
      view.container.filters =
        this.directorsCutCasterId !== null && player.id !== this.directorsCutCasterId
          ? [this.directorsCutGrayFilter]
          : null;
      view.abilityWindup = player.ability_windup;
      view.abilityAimX = player.ability_aim_x ?? 0;
      view.abilityAimY = player.ability_aim_y ?? 0;
      view.truthReticle.visible =
        player.character_id === 'bailey' && player.ability_windup > 0;
      if (view.truthReticle.visible) {
        view.truthReticle.position.set(view.abilityAimX, view.abilityAimY);
      }
      if (player.spawn_protected) {
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 120));
      view.shield.alpha = pulse;
      const scale = 1 + Math.sin(performance.now() / 200) * 0.06;
      view.shield.scale.set(scale);
    } else {
      view.shield.scale.set(1);
    }
  }

  private syncBulletTargets(bullets: BulletSnapshot[]) {
    const seen = new Set<number>();
    for (const bullet of bullets) {
      seen.add(bullet.id);
      let state = this.bulletStates.get(bullet.id);
      if (!state) {
        state = {
          x: bullet.x,
          y: bullet.y,
          targetX: bullet.x,
          targetY: bullet.y,
          ownerId: bullet.owner_id,
          weaponId: bullet.weapon_id ?? 'glock',
          trail: [],
        };
        this.bulletStates.set(bullet.id, state);
      } else {
        state.trail.push({ x: state.x, y: state.y });
        const maxTrail = (state.weaponId ?? 'glock') === 'popcorn' ? POPCORN_TRAIL_LENGTH : BULLET_TRAIL_LENGTH;
        if (state.trail.length > maxTrail) {
          state.trail.shift();
        }
        state.targetX = bullet.x;
        state.targetY = bullet.y;
        state.ownerId = bullet.owner_id;
        state.weaponId = bullet.weapon_id ?? 'glock';
      }
    }

    for (const id of this.bulletStates.keys()) {
      if (!seen.has(id)) {
        this.bulletStates.delete(id);
      }
    }
  }

  private drawBullets(dt: number) {
    const blend = 1 - Math.exp(-BULLET_LERP_RATE * dt);
    this.bullets.clear();
    for (const state of this.bulletStates.values()) {
      if (
        this.fogEnabled &&
        state.ownerId !== this.myId &&
        !this.isInVision(state.x, state.y)
      ) {
        continue;
      }

      state.x += (state.targetX - state.x) * blend;
      state.y += (state.targetY - state.y) * blend;

      const bulletColor = BULLET_COLORS[state.weaponId] ?? 0xffff32;
      const bulletRadius = BULLET_RADIUS_BY_WEAPON[state.weaponId] ?? BULLET_RADIUS;

      for (let i = 0; i < state.trail.length; i += 1) {
        const point = state.trail[i];
        const t = state.trail.length > 0 ? i / state.trail.length : 0;
        const alpha = state.weaponId === 'popcorn' ? 0.12 + t * 0.35 : 0.18 + t * 0.28;
        this.bullets.circle(point.x, point.y, bulletRadius * (0.55 + t * 0.25));
        this.bullets.fill({ color: bulletColor, alpha });
      }

      if (state.weaponId === 'popcorn') {
        this.bullets.circle(state.x, state.y, bulletRadius * 1.15);
        this.bullets.fill({ color: 0xffffff, alpha: 0.55 });
      }

      this.bullets.circle(state.x, state.y, bulletRadius);
      this.bullets.fill({ color: bulletColor, alpha: 0.95 });
    }
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

    const shield = new Graphics()
      .circle(0, 0, PLAYER_RADIUS + 10)
      .stroke({ color: 0x7ef9ff, width: 3, alpha: 0.8 });
    shield.visible = false;
    container.addChild(shield);

    const hackAura = new Graphics();
    hackAura.visible = false;
    container.addChild(hackAura);

    const markAura = new Graphics();
    markAura.visible = false;
    container.addChild(markAura);

    const truthReticle = new Graphics();
    truthReticle.visible = false;
    this.entityLayer.addChild(truthReticle);

    const avatar = this.createAvatar(character.sprite, character.initials, color);
    container.addChild(avatar);

    let gun: Sprite | null = null;
    const weaponId = player.active_weapon ?? '';
    const weaponDef = weaponId ? getWeapon(weaponId) : null;
    const weaponTexture = weaponId ? this.weaponTextures.get(weaponId) : undefined;
    if (weaponDef && weaponTexture) {
      gun = new Sprite(weaponTexture);
      gun.anchor.set(weaponDef.meta.pivot.x, weaponDef.meta.pivot.y);
      gun.scale.set(weaponDef.meta.displayScale);
      gun.rotation = player.angle + weaponDef.meta.defaultRotation;
      const orbit = weaponOrbitPosition(weaponDef.meta, player.angle);
      gun.position.set(orbit.x, orbit.y);
      container.addChild(gun);
    }

    if (isMe) {
      const selfRing = new Graphics()
        .circle(0, 0, PLAYER_RADIUS + 8)
        .stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
      container.addChild(selfRing);
    }

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
      gun,
      shield,
      hackAura,
      markAura,
      truthReticle,
      weaponId,
      targetX: player.x,
      targetY: player.y,
      targetAngle: player.angle,
      displayAngle: player.angle,
      targetGunAngle: player.angle,
      displayGunAngle: player.angle,
      isReloading: false,
      lastX: player.x,
      lastY: player.y,
      lastDustAt: 0,
      wasSpawnProtected: player.spawn_protected,
      characterId: player.character_id,
      accentColor: color,
      meleeSwingRemaining: 0,
      meleeSwingAngle: player.angle,
      hackedRemaining: player.hacked_remaining,
      markedRemaining: player.marked_remaining ?? 0,
      abilityWindup: player.ability_windup,
      abilityAimX: player.ability_aim_x ?? 0,
      abilityAimY: player.ability_aim_y ?? 0,
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

  private animateTruthNukes(now: number, dt: number) {
    const pulse = 0.5 + 0.5 * Math.abs(Math.sin(now / 90));
    const blend = 1 - Math.exp(-PLAYER_LERP_RATE * dt * 1.4);
    for (const view of this.truthNukes.values()) {
      const prevX = view.gfx.x;
      const prevY = view.gfx.y;
      view.gfx.x += (view.targetX - view.gfx.x) * blend;
      view.gfx.y += (view.targetY - view.gfx.y) * blend;
      const travelAngle = Math.atan2(view.gfx.y - prevY, view.gfx.x - prevX);
      this.vfx.drawTruthNuke(view.gfx, pulse, travelAngle);
      if (now - view.lastTrailAt > 45) {
        this.vfx.emitTruthFireTrail(view.gfx.x, view.gfx.y);
        view.lastTrailAt = now;
      }
      view.lastX = view.gfx.x;
      view.lastY = view.gfx.y;
    }
  }

  private drawHackAura(view: PlayerView, now: number) {
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(now / 90));
    const spin = now / 320;
    const ringRadius = PLAYER_RADIUS + 12 + Math.sin(now / 140) * 2;
    const aura = view.hackAura;

    aura.clear();
    aura.visible = true;
    aura.rotation = spin;

    aura.circle(0, 0, ringRadius)
      .stroke({ color: HACK_GREEN_BRIGHT, width: 2.5, alpha: 0.35 + pulse * 0.35 });

    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const inner = ringRadius - 4;
      const outer = ringRadius + 5;
      aura.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
        .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
        .stroke({ color: i % 2 === 0 ? HACK_GREEN_NEON : HACK_GREEN_DIM, width: 2, alpha: 0.55 + pulse * 0.25 });
    }

    aura.poly([
      ringRadius * 0.55, 0,
      ringRadius * 0.28, ringRadius * 0.48,
      -ringRadius * 0.28, ringRadius * 0.48,
      -ringRadius * 0.55, 0,
      -ringRadius * 0.28, -ringRadius * 0.48,
      ringRadius * 0.28, -ringRadius * 0.48,
    ], true)
      .stroke({ color: HACK_GREEN_BRIGHT, width: 1.5, alpha: 0.25 + pulse * 0.2 });

    aura.circle(0, 0, PLAYER_RADIUS + 4)
      .stroke({ color: HACK_GREEN_NEON, width: 1, alpha: 0.15 + pulse * 0.2 });
  }

  private drawMarkAura(view: PlayerView, now: number) {
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(now / 110));
    const ringRadius = PLAYER_RADIUS + 14 + Math.sin(now / 160) * 2;
    const aura = view.markAura;

    aura.clear();
    aura.visible = true;
    aura.circle(0, 0, ringRadius)
      .stroke({ color: MARK_GOLD, width: 3, alpha: 0.35 + pulse * 0.45 })
      .circle(0, 0, ringRadius * 0.72)
      .stroke({ color: 0xfff4a8, width: 1.5, alpha: 0.25 + pulse * 0.25 });
  }

  private renderFrame() {
    if (this.mountContainer) {
      const width = Math.max(1, this.mountContainer.clientWidth);
      const height = Math.max(1, this.mountContainer.clientHeight);
      if (width !== this.viewportWidth || height !== this.viewportHeight) {
        this.syncViewport(true);
      }
    }

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrameMs) / 1000);
    this.lastFrameMs = now;
    this.vfx.tick(dt);
    this.drawBullets(dt);
    this.animatePickups(now, dt);
    this.animateTruthNukes(now, dt);

    const reticlePulse = 0.5 + 0.5 * Math.abs(Math.sin(now / 120));
    for (const view of this.players.values()) {
      if (view.truthReticle.visible) {
        this.vfx.drawTruthReticle(view.truthReticle, 150, reticlePulse);
      }
    }

    const myView = this.players.get(this.myId);
    if (myView) {
      this.localPlayerX = myView.container.x;
      this.localPlayerY = myView.container.y;
      this.fogOriginX = myView.targetX;
      this.fogOriginY = myView.targetY;
    }
    this.updateFogVisibility();
    this.drawFogOverlay();
    this.applyFogEntityVisibility();

    for (const view of this.players.values()) {
      const prevX = view.container.x;
      const prevY = view.container.y;

      const playerBlend = 1 - Math.exp(-PLAYER_LERP_RATE * dt);
      view.container.x += (view.targetX - view.container.x) * playerBlend;
      view.container.y += (view.targetY - view.container.y) * playerBlend;

      let angleDelta = view.targetAngle - view.displayAngle;
      while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
      while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
      view.displayAngle += angleDelta * 0.45;

      let gunDelta = view.targetGunAngle - view.displayGunAngle;
      while (gunDelta > Math.PI) gunDelta -= Math.PI * 2;
      while (gunDelta < -Math.PI) gunDelta += Math.PI * 2;
      const gunBlend = view.isReloading ? 0.32 : 0.48;
      view.displayGunAngle += gunDelta * gunBlend;

      if (view.meleeSwingRemaining > 0) {
        view.meleeSwingRemaining = Math.max(0, view.meleeSwingRemaining - dt);
      }

      if (view.gun) {
        this.updateGun(view, view.displayGunAngle);
      }

      if (view.hackedRemaining > 0) {
        this.drawHackAura(view, now);
      } else {
        view.hackAura.clear();
        view.hackAura.visible = false;
      }

      if (view.markedRemaining > 0) {
        this.drawMarkAura(view, now);
      } else {
        view.markAura.clear();
        view.markAura.visible = false;
      }

      const dx = view.container.x - prevX;
      const dy = view.container.y - prevY;
      const speed = Math.hypot(dx, dy) / Math.max(dt, 0.001);
      if (speed > MOVE_DUST_SPEED && now - view.lastDustAt > MOVE_DUST_INTERVAL_MS) {
        const moveAngle = Math.atan2(dy, dx);
        const feetX = view.container.x - Math.cos(moveAngle) * 6;
        const feetY = view.container.y + FOOT_OFFSET_Y;
        this.vfx.emitMoveDust(feetX, feetY, moveAngle, view.accentColor);
        view.lastDustAt = now;
      }

      view.lastX = view.container.x;
      view.lastY = view.container.y;
    }
  }

  private animatePickups(now: number, dt: number) {
    const blend = 1 - Math.exp(-PLAYER_LERP_RATE * dt);
    for (const view of this.pickups.values()) {
      view.container.x += (view.targetX - view.container.x) * blend;
      view.container.y += (view.targetY - view.container.y) * blend;
      const bob = Math.sin(now / 420 + view.bobPhase) * 3;
      view.sprite.y = bob;
      view.glow.alpha = 0.55 + Math.sin(now / 260 + view.bobPhase) * 0.25;
    }
  }

  private isInVision(x: number, y: number): boolean {
    if (!this.fogEnabled) {
      return true;
    }
    return hasLineOfSight(
      this.fogOriginX,
      this.fogOriginY,
      x,
      y,
      this.wallSegments,
      FOG_VISION_RADIUS,
    );
  }

  private updateFogVisibility() {
    if (!this.fogEnabled) {
      this.visibilityPolygon = [];
      return;
    }
    this.visibilityPolygon = computeVisibilityPolygon(
      this.fogOriginX,
      this.fogOriginY,
      this.wallSegments,
      FOG_VISION_RADIUS,
      this.world.width,
      this.world.height,
    );
  }

  private applyFogEntityVisibility() {
    if (!this.fogEnabled) {
      return;
    }

    for (const [id, view] of this.players) {
      if (id === this.myId) {
        view.container.visible = true;
        continue;
      }
      view.container.visible = this.isInVision(view.container.x, view.container.y);
    }

    for (const view of this.pickups.values()) {
      view.container.visible = this.isInVision(view.container.x, view.container.y);
    }
  }

  private drawFogOverlay() {
    if (!this.fogEnabled) {
      this.fogLayer.visible = false;
      return;
    }

    this.fogLayer.visible = true;
    this.fogOverlay.clear();
    this.fogOverlay.rect(0, 0, this.world.width, this.world.height);
    this.fogOverlay.fill({ color: 0x020408, alpha: 0.97 });

    const hits = this.visibilityPolygon;
    const usePolygon = isSimpleVisibilityPolygon(this.fogOriginX, this.fogOriginY, hits);

    if (usePolygon) {
      const flat: number[] = [];
      for (const point of hits) {
        flat.push(point.x, point.y);
      }
      this.fogOverlay.poly(flat, true);
      this.fogOverlay.cut();
      return;
    }

    this.fogOverlay.circle(this.fogOriginX, this.fogOriginY, FOG_VISION_RADIUS);
    this.fogOverlay.cut();
  }

  private syncViewport(redrawFloor: boolean) {
    if (!this.app || !this.mountContainer) return;

    const width = Math.max(1, this.mountContainer.clientWidth);
    const height = Math.max(1, this.mountContainer.clientHeight);
    const sizeChanged = width !== this.viewportWidth || height !== this.viewportHeight;

    if (sizeChanged) {
      this.app.renderer.resize(width, height, window.devicePixelRatio || 1);
      this.viewportWidth = width;
      this.viewportHeight = height;
    }

    const transform = fitWorldToViewport(this.world, width, height, GAME_SAFE_AREA_INSETS);
    this.root.scale.set(transform.scale);
    this.root.position.set(transform.offsetX, transform.offsetY);

    if (sizeChanged) {
      const insets = GAME_SAFE_AREA_INSETS;
      const innerWidth = Math.max(1, width - insets.left - insets.right);
      const innerHeight = Math.max(1, height - insets.top - insets.bottom);
      this.viewportMask.clear();
      this.viewportMask
        .rect(insets.left, insets.top, innerWidth, innerHeight)
        .fill({ color: 0xffffff, alpha: 1 });
    }

    if (redrawFloor || sizeChanged) {
      this.drawFloor();
    }
  }

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
    this.wallRects = walls.filter((wall) => wall.w > 0 && wall.h > 0);
    this.wallSegments = rectsToSegments(this.wallRects);
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

  private async loadTextures() {
    await this.vfx.loadAssets();
    await Promise.all(
      listWeapons().map(async (weapon) => {
        const texture = await loadTextureFromUrl(assetUrl(weapon.meta.sprite));
        if (texture) {
          this.weaponTextures.set(weapon.id, texture);
        }
      }),
    );
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
