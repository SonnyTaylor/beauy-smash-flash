import type { CharacterDefinition } from '../shared/types';

export const PLAYABLE_CHARACTERS: CharacterDefinition[] = [
  {
    id: 'sonny',
    name: 'Sonny',
    color: [0, 255, 255],
    sprite: 'heads/sonny.png',
    initials: 'SN',
    abilityId: 'reverse_shell',
    abilityName: 'Reverse Shell',
    abilityDescription:
      "Hack the nearest enemy for 3s — inverted controls and they take 30% extra damage.",
  },
  {
    id: 'bailey',
    name: 'Bailey',
    color: [255, 0, 128],
    sprite: 'heads/bailey.png',
    initials: 'BL',
    abilityId: 'truth_nuke',
    abilityName: 'Truth Nuke',
    abilityDescription:
      '60 blast damage (150 radius) plus brief slow. Sweep the reticle, lob the nuke.',
  },
  {
    id: 'jacob',
    name: 'Jacob',
    color: [50, 255, 50],
    sprite: 'heads/jacob.png',
    initials: 'JC',
    abilityId: 'directors_cut',
    abilityName: "Director's Cut",
    abilityDescription:
      "18s movie mode — 1.5× speed, 18 popcorn shots that mark targets. Kills refund 2 shots.",
  },
  {
    id: 'isaak',
    name: 'Isaak',
    color: [255, 200, 0],
    sprite: 'heads/isaak.png',
    initials: 'IS',
    abilityId: 'chi_blast',
    abilityName: 'Chi Blast',
    abilityDescription:
      'Stand still for stillness stacks — each stack powers up Chi Blast (up to 85 dmg + slow).',
  },
  {
    id: 'taj',
    name: 'Taj',
    color: [255, 80, 80],
    sprite: 'heads/taj.png',
    initials: 'TJ',
    abilityId: 'doomscroll',
    abilityName: 'Story Shield',
    abilityDescription:
      'E deploys a reel shield for 5.5s (blocks shots). Press E again to post it — refunds charge.',
  },
  {
    id: 'finn',
    name: 'Finn',
    color: [180, 100, 255],
    sprite: 'heads/finn.png',
    initials: 'FN',
    abilityId: 'cheeky_dinghy',
    abilityName: 'Cheeky Dinghy',
    abilityDescription:
      'Speedboat for 5s — ram for 55 dmg (re-hit after 1.2s). Cannot shoot during boat.',
  },
  {
    id: 'sifan',
    name: 'Sifan',
    color: [255, 160, 60],
    sprite: 'heads/sifan.png',
    initials: 'SF',
    abilityId: 'juice_heist',
    abilityName: 'Juice Heist',
    abilityDescription:
      'Steal 40 charge from the nearest enemy and juice up — +15% speed and damage for 5s, then a crash.',
  },
  {
    id: 'connor',
    name: 'Connor',
    color: [140, 180, 255],
    sprite: 'heads/connor.png',
    initials: 'CN',
    abilityId: 'malice_drop',
    abilityName: 'MALICE Drop',
    abilityDescription:
      'Drop a 6s fog zone — DoT, slow, and blocks enemy line of sight (you see through your own).',
  },
  {
    id: 'archie',
    name: 'Archie',
    color: [255, 120, 200],
    sprite: 'heads/archie.png',
    initials: 'AR',
    abilityId: 'jump_cut',
    abilityName: 'Dexie Rush',
    abilityDescription:
      'Blink up to 280px toward aim, then a brief speed burst. Charge faster while moving.',
  },
  {
    id: 'arthur',
    name: 'Arthur',
    color: [200, 80, 40],
    sprite: 'heads/arthur.png',
    initials: 'AT',
    abilityId: 'hot_lap',
    abilityName: 'Hot Lap',
    abilityDescription:
      '5s kart mode — keep shooting, leave an oil trail that slows and chips enemies. Bigger hitbox, 110 HP.',
  },
  {
    id: 'oscar',
    name: 'Oscar',
    color: [255, 220, 100],
    sprite: 'heads/oscar.png',
    initials: 'OG',
    abilityId: 'chippys_special',
    abilityName: "Chippy's Special",
    abilityDescription:
      'Deploy a food tray that heals allies inside. Enemies can shoot the tray to shut it down.',
  },
  {
    id: 'vlad',
    name: 'Vlad',
    color: [160, 60, 220],
    sprite: 'heads/vlad.png',
    initials: 'VL',
    abilityId: 'going_viral',
    abilityName: 'Going Viral',
    abilityDescription:
      'Summon 3 follower drones for 7s — chip damage at range; shoot them down to stop the clout.',
  },
  {
    id: 'luca',
    name: 'Luca',
    color: [100, 140, 70],
    sprite: 'heads/luca.png',
    initials: 'LC',
    abilityId: 'none',
    abilityName: 'Existing',
    abilityDescription:
      '1 HP. No gun. Slow legs. Charge fills anyway — E still does nothing.',
  },
];

/** Horde-only NPC — not selectable in loadout or lobby. */
export const ZOMBIE_CHARACTER: CharacterDefinition = {
  id: 'zombie',
  name: 'Zombie',
  color: [80, 200, 60],
  sprite: 'heads/luca.png',
  initials: 'Z',
  abilityId: 'none',
  abilityName: 'Shamble',
  abilityDescription: 'Slow, hungry, and armed with claws.',
};

export const ALL_CHARACTERS: CharacterDefinition[] = [...PLAYABLE_CHARACTERS, ZOMBIE_CHARACTER];

const CHARACTER_BY_ID = new Map(ALL_CHARACTERS.map((character) => [character.id, character]));

export function getCharacter(id: string | undefined): CharacterDefinition {
  return CHARACTER_BY_ID.get(id ?? '') ?? PLAYABLE_CHARACTERS[0];
}

export function isPlayableCharacterId(id: string | undefined): boolean {
  return PLAYABLE_CHARACTERS.some((character) => character.id === id);
}

export function isLucaCharacter(id: string | undefined): boolean {
  return id === 'luca';
}
