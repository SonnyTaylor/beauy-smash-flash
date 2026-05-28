export const GAME_TUNING = {
  network: {
    gameplayPort: 5555,
    discoveryPort: 5554,
  },
  world: {
    width: 1920,
    height: 1080,
  },
  player: {
    radius: 24,
    speed: 360,
    hp: 100,
  },
  weapon: {
    glock: {
      damage: 25,
      fireRateSeconds: 0.18,
      bulletSpeed: 720,
      bulletLifeSeconds: 2,
      maxAmmo: 17,
      reloadSeconds: 1.2,
    },
  },
} as const;
