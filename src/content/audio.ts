export const AUDIO_ASSETS = {
  gunshot: '/assets/audio/gunshot.mp3',
  raygun: '/assets/audio/raygun.mp3',
  shotgun: '/assets/audio/shotgun.mp3',
  sword: '/assets/audio/sword.mp3',
  laserGun: '/assets/audio/laser_gun.mp3',
  yoghurtEffect: '/assets/audio/yoghurt_effect.mp3',
  yoghurtEffectKill: '/assets/audio/yoghurt_effect_kill.mp3',
  feces: '/assets/audio/feces.mp3',
  fecesKill: '/assets/audio/feces_kill.mp3',
  truthNuke: '/assets/audio/truth_nuke.mp3',
  isaakChiBlast: '/assets/audio/isaak_chi_blast.ogg',
  music: {
    menu: { url: '/assets/audio/music/menu.mp3', startOffset: 2 },
    lobby: { url: '/assets/audio/music/lobby.mp3' },
    match: [
      { url: '/assets/audio/music/match1.mp3' },
      { url: '/assets/audio/music/match2.mp3', startOffset: 10 },
      { url: '/assets/audio/music/match3.mp3' },
      { url: '/assets/audio/music/match4.mp3' },
    ],
  } as const,
} as const;
