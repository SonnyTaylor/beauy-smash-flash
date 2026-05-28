import { Container, Graphics } from 'pixi.js';

interface VfxBurst {
  gfx: Graphics;
  life: number;
  maxLife: number;
  fadeOnly: boolean;
}

const MUZZLE_LIFE = 0.09;
const SPAWN_LIFE = 0.55;
const DUST_LIFE = 0.3;
const EXPLOSION_LIFE = 0.45;
const RETICLE_LIFE = 1.2;

export class VfxManager {
  private layer = new Container();
  private bursts: VfxBurst[] = [];

  get container(): Container {
    return this.layer;
  }

  clear() {
    for (const burst of this.bursts) {
      burst.gfx.destroy();
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
    this.bursts.push({ gfx, life: MUZZLE_LIFE, maxLife: MUZZLE_LIFE, fadeOnly: true });
  }

  emitSpawnBurst(x: number, y: number, accentColor: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, 38)
      .stroke({ color: 0x7ef9ff, width: 4, alpha: 0.85 })
      .circle(0, 0, 48)
      .stroke({ color: accentColor, width: 2, alpha: 0.45 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ gfx, life: SPAWN_LIFE, maxLife: SPAWN_LIFE, fadeOnly: true });
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
    this.bursts.push({ gfx, life: EXPLOSION_LIFE, maxLife: EXPLOSION_LIFE, fadeOnly: false });
  }

  emitAimReticle(x: number, y: number, radius: number) {
    const gfx = new Graphics();
    gfx.circle(0, 0, radius)
      .stroke({ color: 0xff4466, width: 3, alpha: 0.85 })
      .circle(0, 0, 8)
      .fill({ color: 0xffffff, alpha: 0.9 });
    gfx.position.set(x, y);
    this.layer.addChild(gfx);
    this.bursts.push({ gfx, life: RETICLE_LIFE, maxLife: RETICLE_LIFE, fadeOnly: true });
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
    this.bursts.push({ gfx, life: DUST_LIFE, maxLife: DUST_LIFE, fadeOnly: true });
  }

  tick(dt: number) {
    const next: VfxBurst[] = [];
    for (const burst of this.bursts) {
      burst.life -= dt;
      const ratio = Math.max(0, burst.life / burst.maxLife);
      burst.gfx.alpha = ratio;
      if (!burst.fadeOnly) {
        burst.gfx.scale.set(1 + (1 - ratio) * 0.2);
      }
      if (burst.life > 0) {
        next.push(burst);
      } else {
        burst.gfx.destroy();
      }
    }
    this.bursts = next;
  }
}
