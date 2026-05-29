import { Assets, Container, extensions, Graphics } from 'pixi.js';
import { GifAsset, GifSource, GifSprite } from 'pixi.js/gif';

interface VfxBurst {
  node: Container;
  life: number;
  maxLife: number;
  fadeOnly: boolean;
}

const EXPLOSION_GIF_URL = '/assets/abilities/explosion-boom.gif';

const MUZZLE_LIFE = 0.09;
const SPAWN_LIFE = 0.55;
const DUST_LIFE = 0.3;
const EXPLOSION_LIFE = 0.45;
const RETICLE_LIFE = 1.2;
const SPLAT_LIFE = 0.35;
const TRUTH_RETICLE_RADIUS = 150;
const HACK_PULSE_LIFE = 0.55;
const TRUTH_ACCENT = 0xff0080;
const TRUTH_HEAT_WHITE = 0xfff8e8;
const TRUTH_HEAT_YELLOW = 0xffcc44;
const TRUTH_HEAT_ORANGE = 0xff7700;
const TRUTH_HEAT_RED = 0xff3300;
const TRUTH_SHELL_DARK = 0x2a2420;
const TRUTH_SHELL_MID = 0x4a4038;
const TRUTH_WARNING = 0xff9922;
const HACK_GREEN_BRIGHT = 0x00ff41;
const HACK_GREEN_NEON = 0x39ff14;
const HACK_GREEN_DIM = 0x00b32d;
const HACK_GREEN_PALE = 0xccff90;

let gifExtensionRegistered = false;

const WALL_HIT_LIFE = 0.22;

export class VfxManager {
  private layer = new Container();
  private bursts: VfxBurst[] = [];
  private explosionGifSource: GifSource | null = null;
  private assetsPromise: Promise<void> | null = null;

  get container(): Container {
    return this.layer;
  }

  async loadAssets() {
    if (this.assetsPromise) {
      await this.assetsPromise;
      return;
    }

    this.assetsPromise = (async () => {
      if (!gifExtensionRegistered) {
        extensions.add(GifAsset);
        gifExtensionRegistered = true;
      }
      try {
        this.explosionGifSource = await Assets.load<GifSource>(EXPLOSION_GIF_URL);
      } catch (error) {
        console.warn('[vfx] truth explosion gif failed to load', error);
        this.explosionGifSource = null;
      }
    })();

    await this.assetsPromise;
  }

  clear() {
    for (const burst of this.bursts) {
      burst.node.destroy();
    }
    this.bursts = [];
    this.layer.removeChildren();
  }

  /** Cone drawn along +x in local space; container placed at world muzzle. */
  emitMuzzleFlash(x: number, y: number, angle: number) {
    const gfx = new Graphics();
    const length = 26;
    const width = 12;
    const tipX = length;
    const tipY = 0;
    const p1x = 0;
    const p1y = width * 0.5;
    const p2x = 0;
    const p2y = -width * 0.5;

    gfx.poly([tipX, tipY, p1x, p1y, p2x, p2y], true)
      .fill({ color: 0xffffc8, alpha: 0.92 })
      .circle(0, 0, 5)
      .fill({ color: 0xffffff, alpha: 1 });

    gfx.position.set(x, y);
    gfx.rotation = angle;
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: MUZZLE_LIFE, maxLife: MUZZLE_LIFE, fadeOnly: true });
  }

  emitSpawnBurst(x: number, y: number, accentColor: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, 38)
      .stroke({ color: 0x7ef9ff, width: 4, alpha: 0.85 })
      .circle(0, 0, 48)
      .stroke({ color: accentColor, width: 2, alpha: 0.45 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: SPAWN_LIFE, maxLife: SPAWN_LIFE, fadeOnly: true });
  }

  /** Dust at feet, trailing opposite movement direction. */
  emitExplosion(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, radius * 0.35)
      .fill({ color: 0xfff4a8, alpha: 0.95 })
      .circle(0, 0, radius * 0.7)
      .fill({ color: 0xff6b35, alpha: 0.55 })
      .circle(0, 0, radius)
      .stroke({ color: 0xff2d55, width: 5, alpha: 0.75 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: EXPLOSION_LIFE, maxLife: EXPLOSION_LIFE, fadeOnly: false });
  }

  emitTruthExplosion(x: number, y: number, radius: number) {
    if (!this.explosionGifSource) {
      this.emitExplosion(x, y, radius);
      return;
    }

    const sprite = new GifSprite({
      source: this.explosionGifSource,
      autoPlay: true,
      loop: false,
    });
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);

    const targetSize = radius * 2.4;
    const baseSize = Math.max(sprite.width, sprite.height, 1);
    sprite.scale.set(targetSize / baseSize);

    const life = Math.max(0.35, this.explosionGifSource.duration / 1000);
    this.layer.addChild(sprite);
    this.bursts.push({ node: sprite, life, maxLife: life, fadeOnly: true });
  }

  emitTruthFireTrail(x: number, y: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, 7)
      .fill({ color: TRUTH_HEAT_YELLOW, alpha: 0.55 })
      .circle(2, 3, 5)
      .fill({ color: TRUTH_HEAT_ORANGE, alpha: 0.42 })
      .circle(-3, 4, 4)
      .fill({ color: TRUTH_HEAT_RED, alpha: 0.35 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.22, maxLife: 0.22, fadeOnly: true });
  }

  /** Sweeping Truth Nuke aim preview — drawn each frame at the locked orbit distance. */
  drawTruthReticle(gfx: Graphics, radius: number, pulse: number) {
    gfx.clear();
    const blastRadius = radius > 0 ? radius : TRUTH_RETICLE_RADIUS;
    gfx.circle(0, 0, blastRadius)
      .stroke({ color: TRUTH_WARNING, width: 2.5, alpha: 0.22 + pulse * 0.16 })
      .circle(0, 0, blastRadius * 0.72)
      .stroke({ color: TRUTH_HEAT_ORANGE, width: 2, alpha: 0.38 + pulse * 0.22 })
      .circle(0, 0, blastRadius * 1.02)
      .stroke({ color: TRUTH_ACCENT, width: 1.5, alpha: 0.22 + pulse * 0.12 })
      .circle(0, 0, 10)
      .fill({ color: TRUTH_HEAT_WHITE, alpha: 0.9 })
      .moveTo(-14, 0)
      .lineTo(14, 0)
      .stroke({ color: TRUTH_HEAT_YELLOW, width: 2, alpha: 0.85 })
      .moveTo(0, -14)
      .lineTo(0, 14)
      .stroke({ color: TRUTH_HEAT_YELLOW, width: 2, alpha: 0.85 });
  }

  /** In-flight nuke — dark shell with a hot exhaust plume. */
  drawTruthNuke(gfx: Graphics, pulse: number, travelAngle: number) {
    gfx.clear();
    gfx.rotation = travelAngle + Math.PI / 2;

    gfx.ellipse(0, 2, 10, 14)
      .fill({ color: TRUTH_SHELL_DARK, alpha: 0.98 })
      .ellipse(0, 0, 8, 11)
      .fill({ color: TRUTH_SHELL_MID, alpha: 0.92 })
      .ellipse(0, -8, 5, 4)
      .fill({ color: TRUTH_HEAT_ORANGE, alpha: 0.75 + pulse * 0.15 })
      .ellipse(0, -13, 4, 5)
      .fill({ color: TRUTH_HEAT_YELLOW, alpha: 0.55 + pulse * 0.2 })
      .circle(3, 4, 2)
      .fill({ color: TRUTH_ACCENT, alpha: 0.45 });
  }

  emitAimReticle(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, radius)
      .stroke({ color: 0xff4466, width: 3, alpha: 0.85 })
      .circle(0, 0, 8)
      .fill({ color: 0xffffff, alpha: 0.9 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: RETICLE_LIFE, maxLife: RETICLE_LIFE, fadeOnly: true });
  }

  /** Data-beam from caster to hacked target with a digital burst at the victim. */
  emitHackPulse(
    casterX: number,
    casterY: number,
    targetX: number,
    targetY: number,
    range: number,
  ) {
    const gfx = new Graphics();
    const dx = targetX - casterX;
    const dy = targetY - casterY;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    gfx.position.set(casterX, casterY);
    gfx.rotation = angle;

    const beamLength = Math.max(24, dist);
    const segments = 7;
    for (let i = 0; i < segments; i += 1) {
      const t0 = (i / segments) * beamLength;
      const t1 = t0 + beamLength / segments * 0.55;
      const yOff = (i % 2 === 0 ? 1 : -1) * (2 + (i % 3));
      gfx.moveTo(t0, yOff)
        .lineTo(t1, yOff * 0.35)
        .stroke({ color: i % 2 === 0 ? HACK_GREEN_BRIGHT : HACK_GREEN_DIM, width: 2.5, alpha: 0.9 });
    }

    gfx.circle(beamLength, 0, 10)
      .fill({ color: HACK_GREEN_NEON, alpha: 0.4 })
      .circle(beamLength, 0, 22)
      .stroke({ color: HACK_GREEN_BRIGHT, width: 3, alpha: 0.9 })
      .circle(beamLength, 0, range * 0.18)
      .stroke({ color: HACK_GREEN_DIM, width: 1.5, alpha: 0.45 });

    for (let i = 0; i < 6; i += 1) {
      const sparkT = beamLength * (0.15 + (i / 6) * 0.75);
      const sparkY = (i % 2 === 0 ? 1 : -1) * (6 + (i % 3) * 2);
      gfx.rect(sparkT, sparkY - 1, 4, 2)
        .fill({ color: HACK_GREEN_PALE, alpha: 0.85 });
    }

    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: HACK_PULSE_LIFE, maxLife: HACK_PULSE_LIFE, fadeOnly: false });
  }

  emitSplat(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, radius * 0.45)
      .fill({ color: 0xff9fd6, alpha: 0.9 })
      .circle(-radius * 0.2, radius * 0.15, radius * 0.22)
      .fill({ color: 0xff6eb4, alpha: 0.75 })
      .circle(radius * 0.25, -radius * 0.1, radius * 0.18)
      .fill({ color: 0xff6eb4, alpha: 0.65 })
      .circle(0, 0, radius * 0.85)
      .stroke({ color: 0xff4fa8, width: 3, alpha: 0.55 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: SPLAT_LIFE, maxLife: SPLAT_LIFE, fadeOnly: false });
  }

  emitMark(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, radius * 0.55)
      .fill({ color: 0xffe566, alpha: 0.55 })
      .circle(0, 0, radius * 0.85)
      .stroke({ color: 0xffcc00, width: 3, alpha: 0.85 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.4, maxLife: 0.4, fadeOnly: true });
  }

  emitPoison(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, radius * 0.4)
      .fill({ color: 0x6b8f3c, alpha: 0.75 })
      .circle(0, 0, radius * 0.75)
      .stroke({ color: 0x4a6b22, width: 3, alpha: 0.7 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.45, maxLife: 0.45, fadeOnly: false });
  }

  emitZap(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, radius * 0.35)
      .fill({ color: 0x7ef9ff, alpha: 0.85 })
      .circle(0, 0, radius * 0.75)
      .stroke({ color: 0x44ffcc, width: 4, alpha: 0.9 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.28, maxLife: 0.28, fadeOnly: false });
  }

  /** Slash arc drawn along +x in local space; rotated to aim direction at the attacker. */
  emitSlash(x: number, y: number, angle: number, radius: number) {
    const gfx = new Graphics();
    const arcRadius = radius * 0.92;
    const halfArc = 0.72;
    gfx.arc(0, 0, arcRadius, -halfArc, halfArc)
      .stroke({ color: 0xd8e2f0, width: 4, alpha: 0.7 });
    gfx.position.set(x, y);
    gfx.rotation = angle;
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.16, maxLife: 0.16, fadeOnly: true });
  }

  emitWallImpact(x: number, y: number, dirX: number, dirY: number, radius: number) {
    const gfx = new Graphics();
    const impactAngle = Math.atan2(dirY, dirX);
    const size = Math.max(6, radius);

    gfx.circle(0, 0, size * 0.45)
      .fill({ color: 0xfff4d6, alpha: 0.95 })
      .circle(0, 0, size * 0.75)
      .stroke({ color: 0xffcc66, width: 2, alpha: 0.55 });

    for (let i = 0; i < 6; i += 1) {
      const spread = (i - 2.5) * 0.32;
      const dist = size * (0.55 + (i % 3) * 0.22);
      const sparkAngle = impactAngle + Math.PI + spread;
      const sx = Math.cos(sparkAngle) * dist;
      const sy = Math.sin(sparkAngle) * dist;
      gfx.circle(sx, sy, 1.2 + (i % 2) * 0.6)
        .fill({ color: i % 2 === 0 ? 0xffe08a : 0xb8c0cc, alpha: 0.9 });
    }

    gfx.moveTo(-size * 0.35, 0)
      .lineTo(size * 0.35, 0)
      .stroke({ color: 0x7a8494, width: 2, alpha: 0.65 });

    gfx.position.set(x, y);
    gfx.rotation = impactAngle;
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: WALL_HIT_LIFE, maxLife: WALL_HIT_LIFE, fadeOnly: true });
  }

  emitDirectorsCut(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.rect(-radius * 1.2, -radius * 0.35, radius * 2.4, radius * 0.7)
      .fill({ color: 0x111111, alpha: 0.55 })
      .circle(0, 0, radius * 0.55)
      .stroke({ color: 0x32ff32, width: 3, alpha: 0.85 })
      .circle(0, 0, radius * 0.85)
      .stroke({ color: 0xffffff, width: 1.5, alpha: 0.35 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.45, maxLife: 0.45, fadeOnly: true });
  }

  emitChiBeam(originX: number, originY: number, endX: number, endY: number, halfWidth: number) {
    const gfx = new Graphics();
    const dx = endX - originX;
    const dy = endY - originY;
    const angle = Math.atan2(dy, dx);
    const length = Math.hypot(dx, dy);
    gfx.roundRect(0, -halfWidth, length, halfWidth * 2, halfWidth * 0.35)
      .fill({ color: 0xffd700, alpha: 0.35 })
      .roundRect(0, -halfWidth * 0.45, length, halfWidth * 0.9, halfWidth * 0.2)
      .fill({ color: 0xfff8dc, alpha: 0.85 });
    gfx.position.set(originX, originY);
    gfx.rotation = angle;
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.4, maxLife: 0.4, fadeOnly: true });
  }

  emitChiChannel(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, radius)
      .stroke({ color: 0xffcc00, width: 3, alpha: 0.55 })
      .circle(0, 0, radius * 0.65)
      .stroke({ color: 0xffffff, width: 1.5, alpha: 0.35 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.25, maxLife: 0.25, fadeOnly: true });
  }

  emitReelShield(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.roundRect(-radius * 0.35, -radius, radius * 0.7, radius * 2, 8)
      .fill({ color: 0x1a1a1a, alpha: 0.82 })
      .roundRect(-radius * 0.35, -radius, radius * 0.7, radius * 2, 8)
      .stroke({ color: 0xff5050, width: 2.5, alpha: 0.75 });
    for (let i = -2; i <= 2; i += 1) {
      gfx.rect(-radius * 0.28, i * radius * 0.38, radius * 0.56, radius * 0.12)
        .fill({ color: i % 2 === 0 ? 0xff7090 : 0x303030, alpha: 0.65 });
    }
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.35, maxLife: 0.35, fadeOnly: true });
  }

  emitReelPost(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.roundRect(-radius * 0.4, -radius * 0.9, radius * 0.8, radius * 1.8, 10)
      .fill({ color: 0xff4060, alpha: 0.55 })
      .roundRect(-radius * 0.4, -radius * 0.9, radius * 0.8, radius * 1.8, 10)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.35, maxLife: 0.35, fadeOnly: false });
  }

  emitBoatSplash(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = radius * (0.45 + (i % 3) * 0.12);
      gfx.circle(Math.cos(angle) * dist, Math.sin(angle) * dist, 3 + (i % 2))
        .fill({ color: i % 2 === 0 ? 0xc8f0ff : 0x5ec8ff, alpha: 0.75 });
    }
    gfx.circle(0, 0, radius * 0.35)
      .fill({ color: 0xe8fcff, alpha: 0.5 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.45, maxLife: 0.45, fadeOnly: true });
  }

  /** Persistent zone ring (Connor fog, Oscar tray, Arthur oil). */
  emitZoneRing(x: number, y: number, radius: number, color: number, alpha: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, radius)
      .fill({ color, alpha: alpha * 0.35 })
      .circle(0, 0, radius)
      .stroke({ color, width: 2, alpha });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: 0.25, maxLife: 0.25, fadeOnly: true });
  }

  emitMoveDust(feetX: number, feetY: number, moveAngle: number, accentColor: number) {
    const gfx = new Graphics();
    const behindX = -Math.cos(moveAngle) * 14;
    const behindY = -Math.sin(moveAngle) * 14;

    for (let i = 0; i < 3; i += 1) {
      const spread = (i - 1) * 0.4;
      const px = behindX + Math.cos(moveAngle + Math.PI / 2 + spread) * (4 + i * 2);
      const py = behindY + Math.sin(moveAngle + Math.PI / 2 + spread) * (4 + i * 2);
      gfx.circle(px, py, 2 + i * 0.5)
        .fill({ color: accentColor, alpha: 0.4 });
    }

    gfx.position.set(feetX, feetY);
    this.layer.addChild(gfx);
    this.bursts.push({ node: gfx, life: DUST_LIFE, maxLife: DUST_LIFE, fadeOnly: true });
  }

  tick(dt: number) {
    const next: VfxBurst[] = [];
    for (const burst of this.bursts) {
      burst.life -= dt;
      const ratio = Math.max(0, burst.life / burst.maxLife);
      burst.node.alpha = ratio;
      if (!burst.fadeOnly) {
        burst.node.scale.set(1 + (1 - ratio) * 0.2);
      }
      if (burst.life > 0) {
        next.push(burst);
      } else {
        burst.node.destroy();
      }
    }
    this.bursts = next;
  }
}
