import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TAJ_REEL_COUNT, tajReelSrc } from '../content/reels';

export const REEL_DISPLAY_WIDTH = 72;
export const REEL_DISPLAY_HEIGHT = 128;
export const REEL_SHIELD_OFFSET = 50;

export interface TajReelShieldView {
  container: Container;
  sprite: Sprite;
  frame: Graphics;
  backing: Graphics;
  video: HTMLVideoElement;
  reelIndex: number;
}

export interface TajReelPostView {
  container: Container;
  sprite: Sprite;
  frame: Graphics;
  backing: Graphics;
  video: HTMLVideoElement;
  reelIndex: number;
  targetX: number;
  targetY: number;
  angle: number;
}

function enableVideoTextureUpdates(texture: Texture): void {
  const source = texture.source as { autoUpdate?: boolean };
  if ('autoUpdate' in source) {
    source.autoUpdate = true;
  }
}

function fitSpriteToReel(sprite: Sprite, video: HTMLVideoElement): void {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    return;
  }
  const scale = Math.min(
    REEL_DISPLAY_WIDTH / video.videoWidth,
    REEL_DISPLAY_HEIGHT / video.videoHeight,
  );
  sprite.scale.set(scale);
  sprite.visible = true;
}

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = true;
    video.muted = true;

    const finish = () => {
      video.removeEventListener('loadeddata', finish);
      video.removeEventListener('error', onError);
      resolve(video);
    };
    const onError = () => {
      video.removeEventListener('loadeddata', finish);
      video.removeEventListener('error', onError);
      reject(new Error(`Failed to load reel video: ${src}`));
    };

    video.addEventListener('loadeddata', finish);
    video.addEventListener('error', onError);
    video.src = src;
    video.load();
  });
}

export class TajReelVisuals {
  private preloadPromise: Promise<void> | null = null;
  private warmedVideos: HTMLVideoElement[] = [];

  preload(): Promise<void> {
    if (!this.preloadPromise) {
      this.preloadPromise = (async () => {
        const videos = await Promise.all(
          Array.from({ length: TAJ_REEL_COUNT }, (_, index) => loadVideo(tajReelSrc(index))),
        );
        for (const video of videos) {
          video.pause();
          video.currentTime = 0;
        }
        this.warmedVideos = videos;
      })().catch((error) => {
        console.warn('[taj-reels] preload failed', error);
        this.preloadPromise = null;
      });
    }
    return this.preloadPromise ?? Promise.resolve();
  }

  private async borrowVideo(reelIndex: number): Promise<HTMLVideoElement> {
    await this.preload();
    const index = ((reelIndex % TAJ_REEL_COUNT) + TAJ_REEL_COUNT) % TAJ_REEL_COUNT;
    const warmed = this.warmedVideos[index];
    if (warmed) {
      const clone = warmed.cloneNode(true) as HTMLVideoElement;
      clone.src = warmed.src;
      clone.load();
      await new Promise<void>((resolve) => {
        if (clone.readyState >= 2) {
          resolve();
          return;
        }
        clone.addEventListener('loadeddata', () => resolve(), { once: true });
      });
      return clone;
    }
    return loadVideo(tajReelSrc(index));
  }

  private buildReelContainer(video: HTMLVideoElement, reelIndex: number) {
    const container = new Container();
    const texture = Texture.from(video);
    enableVideoTextureUpdates(texture);

    const backing = new Graphics()
      .roundRect(
        -REEL_DISPLAY_WIDTH / 2,
        -REEL_DISPLAY_HEIGHT / 2,
        REEL_DISPLAY_WIDTH,
        REEL_DISPLAY_HEIGHT,
        8,
      )
      .fill({ color: 0x101010, alpha: 0.98 });

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.visible = false;

    const frame = new Graphics();
    this.drawPhoneFrame(frame);

    const refit = () => fitSpriteToReel(sprite, video);
    video.addEventListener('loadeddata', refit);
    refit();

    container.addChild(backing);
    container.addChild(sprite);
    container.addChild(frame);
    container.visible = false;

    return { container, sprite, frame, backing, video, reelIndex };
  }

  async createShield(reelIndex: number): Promise<TajReelShieldView> {
    const video = await this.borrowVideo(reelIndex);
    return this.buildReelContainer(video, reelIndex);
  }

  async createPost(reelIndex: number): Promise<TajReelPostView> {
    const video = await this.borrowVideo(reelIndex);
    const built = this.buildReelContainer(video, reelIndex);
    return {
      ...built,
      targetX: 0,
      targetY: 0,
      angle: 0,
    };
  }

  async playReel(video: HTMLVideoElement, volume = 0.85): Promise<void> {
    video.loop = true;
    video.volume = volume;
    video.muted = false;
    try {
      await video.play();
    } catch {
      video.muted = true;
      try {
        await video.play();
      } catch {
        // Visual-only fallback.
      }
    }
  }

  stopReel(video: HTMLVideoElement): void {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  destroyShield(view: TajReelShieldView): void {
    this.stopReel(view.video);
    view.container.destroy({ children: true });
  }

  destroyPost(view: TajReelPostView): void {
    this.stopReel(view.video);
    view.container.destroy({ children: true });
  }

  private drawPhoneFrame(gfx: Graphics): void {
    const w = REEL_DISPLAY_WIDTH + 6;
    const h = REEL_DISPLAY_HEIGHT + 8;
    gfx.roundRect(-w / 2, -h / 2, w, h, 9)
      .stroke({ color: 0x222222, width: 3, alpha: 0.95 })
      .roundRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, 7)
      .stroke({ color: 0xff4060, width: 1.2, alpha: 0.55 });
  }
}
