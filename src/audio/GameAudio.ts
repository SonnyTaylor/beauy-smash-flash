import type { KillFeedEntry, PlayerSnapshot, StateSnapshot } from '../shared/types';
import { distanceAttenuation, type AudioManager } from './AudioManager';

const FOOTSTEP_INTERVAL_MS = 110;
const FOOTSTEP_MOVE_THRESHOLD = 8;
const GUNSHOT_MAX_DISTANCE = 920;

function panFromWorld(listenerX: number, sourceX: number, worldWidth: number): number {
  const dx = sourceX - listenerX;
  const halfSpan = Math.max(worldWidth * 0.42, 280);
  return Math.max(-1, Math.min(1, dx / halfSpan));
}

function distanceFromListener(
  listenerX: number,
  listenerY: number,
  sourceX: number,
  sourceY: number,
): number {
  return Math.hypot(sourceX - listenerX, sourceY - listenerY);
}

function maxHearingDistance(worldWidth: number, worldHeight: number): number {
  return Math.min(GUNSHOT_MAX_DISTANCE, Math.hypot(worldWidth, worldHeight) * 0.55);
}

export class GameAudio {
  private knownBulletIds = new Set<number>();
  private knownEffectIds = new Set<number>();
  private hpByPlayer = new Map<number, number>();
  private wasReloading = false;
  private wasAlive = true;
  private wasSpawnProtected = false;
  private killFeedCount = 0;
  private lastFootstepAt = 0;
  private lastPos: { x: number; y: number } | null = null;
  private matchStarted = false;
  private matchEndPlayed = false;

  constructor(private audio: AudioManager) {}

  resetMatch() {
    this.knownBulletIds.clear();
    this.knownEffectIds.clear();
    this.hpByPlayer.clear();
    this.wasReloading = false;
    this.wasAlive = true;
    this.wasSpawnProtected = false;
    this.killFeedCount = 0;
    this.lastFootstepAt = 0;
    this.lastPos = null;
    this.matchStarted = false;
    this.matchEndPlayed = false;
  }

  applyState(snapshot: StateSnapshot, myId: number) {
    const me = snapshot.players.find((player) => player.id === myId) ?? null;
    const listenerX = me?.x ?? snapshot.world.width * 0.5;
    const listenerY = me?.y ?? snapshot.world.height * 0.5;
    const maxDistance = maxHearingDistance(snapshot.world.width, snapshot.world.height);

    if (!this.matchStarted && !snapshot.match_ended) {
      this.matchStarted = true;
      this.audio.playMatchStart();
    }

    this.detectGunshots(snapshot, myId, listenerX, listenerY, maxDistance);
    this.detectWorldEffects(snapshot, listenerX, listenerY, maxDistance);
    this.detectHpChanges(snapshot, myId);
    this.detectKillFeed(snapshot.kill_feed, myId);
    this.trackLocalPlayer(me);

    if (snapshot.match_ended && !this.matchEndPlayed) {
      this.matchEndPlayed = true;
      const won = snapshot.winner_id === myId;
      this.audio.playMatchEnd(won);
    }
  }

  private detectGunshots(
    snapshot: StateSnapshot,
    myId: number,
    listenerX: number,
    listenerY: number,
    maxDistance: number,
  ) {
    const playerById = new Map(snapshot.players.map((player) => [player.id, player]));

    for (const bullet of snapshot.bullets) {
      if (this.knownBulletIds.has(bullet.id)) {
        continue;
      }
      this.knownBulletIds.add(bullet.id);

      const owner = playerById.get(bullet.owner_id);
      const sourceX = owner?.x ?? bullet.x;
      const sourceY = owner?.y ?? bullet.y;
      const isOwnShot = bullet.owner_id === myId;
      if (!this.audio.shouldPlayGunshot(bullet.owner_id, isOwnShot)) {
        continue;
      }

      const distance = distanceFromListener(listenerX, listenerY, sourceX, sourceY);
      if (distanceAttenuation(distance, maxDistance) <= 0.02) {
        continue;
      }

      const pan = panFromWorld(listenerX, sourceX, snapshot.world.width);
      this.audio.playGunshot({
        pan,
        distance,
        maxDistance,
        isOwnShot,
      });
    }

    const liveIds = new Set(snapshot.bullets.map((bullet) => bullet.id));
    for (const id of this.knownBulletIds) {
      if (!liveIds.has(id)) {
        this.knownBulletIds.delete(id);
      }
    }
  }

  private detectWorldEffects(
    snapshot: StateSnapshot,
    listenerX: number,
    listenerY: number,
    maxDistance: number,
  ) {
    for (const effect of snapshot.effects ?? []) {
      if (this.knownEffectIds.has(effect.id)) {
        continue;
      }
      this.knownEffectIds.add(effect.id);
      const distance = distanceFromListener(listenerX, listenerY, effect.x, effect.y);
      const pan = panFromWorld(listenerX, effect.x, snapshot.world.width);
      if (effect.kind === 'explosion') {
        this.audio.playExplosion(pan, 0.65, distance, maxDistance);
      } else if (effect.kind === 'truth_explosion') {
        this.audio.playTruthExplosion(pan, 0.95, distance, maxDistance);
      } else if (effect.kind === 'aim_reticle') {
        this.audio.playAbilityCharge(pan, 0.34, distance, maxDistance);
      }
    }

    const liveIds = new Set((snapshot.effects ?? []).map((effect) => effect.id));
    for (const id of this.knownEffectIds) {
      if (!liveIds.has(id)) {
        this.knownEffectIds.delete(id);
      }
    }
  }

  private detectHpChanges(snapshot: StateSnapshot, myId: number) {
    for (const player of snapshot.players) {
      const prevHp = this.hpByPlayer.get(player.id);
      this.hpByPlayer.set(player.id, player.hp);
      if (prevHp === undefined || player.hp >= prevHp) {
        continue;
      }

      if (player.id === myId) {
        this.audio.playHitTaken();
      } else {
        this.audio.playHitDealt();
      }
    }
  }

  private detectKillFeed(killFeed: KillFeedEntry[], myId: number) {
    if (killFeed.length <= this.killFeedCount) {
      this.killFeedCount = killFeed.length;
      return;
    }

    const fresh = killFeed.slice(this.killFeedCount);
    this.killFeedCount = killFeed.length;
    for (const entry of fresh) {
      if (entry.killer_id === myId) {
        this.audio.playKill();
      }
      if (entry.victim_id === myId) {
        this.audio.playDeath();
      }
    }
  }

  private trackLocalPlayer(me: PlayerSnapshot | null) {
    if (!me) return;

    if (me.reloading && !this.wasReloading) {
      this.audio.playReload();
    }
    this.wasReloading = me.reloading;

    if (me.spawn_protected && !this.wasSpawnProtected) {
      this.audio.playSpawn();
    }
    this.wasSpawnProtected = me.spawn_protected;

    this.wasAlive = me.alive;

    if (!me.alive || me.spawn_protected) {
      this.lastPos = { x: me.x, y: me.y };
      return;
    }

    const prev = this.lastPos;
    this.lastPos = { x: me.x, y: me.y };
    if (!prev) return;

    const dx = me.x - prev.x;
    const dy = me.y - prev.y;
    const moved = Math.hypot(dx, dy);
    if (moved < FOOTSTEP_MOVE_THRESHOLD) return;

    const now = performance.now();
    if (now - this.lastFootstepAt < FOOTSTEP_INTERVAL_MS) return;
    this.lastFootstepAt = now;
    this.audio.playFootstep(0, moved > 180 ? 0.16 : 0.12);
  }
}
