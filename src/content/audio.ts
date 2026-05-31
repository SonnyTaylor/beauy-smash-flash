export const AUDIO_ASSETS = {
  gunshot: '/assets/audio/gunshot.mp3',
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
