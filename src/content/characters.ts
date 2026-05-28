import type { CharacterDefinition } from '../shared/types';

export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'sonny',
    name: 'Sonny',
    color: [0, 255, 255],
    sprite: 'heads/sonny.png',
    initials: 'SN',
    abilityId: 'reverse_shell',
    abilityName: 'Reverse Shell',
    abilityDescription: "Hack the nearest enemy for 4s — their movement and aim flip.",
  },
  {
    id: 'bailey',
    name: 'Bailey',
    color: [255, 0, 128],
    sprite: 'heads/bailey.png',
    initials: 'BL',
    abilityId: 'truth_nuke',
    abilityName: 'Truth Nuke',
    abilityDescription: '60 blast damage (150 radius). Sweep the reticle, lob the nuke, flashbang everyone else.',
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
      "30s cinematic mode — 1.67× speed, 15 bouncing popcorn shots that mark targets for 3s.",
  },
  {
    id: 'isaak',
    name: 'Isaak',
    color: [255, 200, 0],
    sprite: 'heads/isaak.png',
    initials: 'IS',
    abilityId: 'chi_blast',
    abilityName: 'Chi Blast',
    abilityDescription: 'Channel a piercing golden beam after a windup.',
  },
  {
    id: 'taj',
    name: 'Taj',
    color: [255, 80, 80],
    sprite: 'heads/taj.png',
    initials: 'TJ',
    abilityId: 'doomscroll',
    abilityName: 'Doomscroll',
    abilityDescription: 'Send a deadly vertical reel across the arena.',
  },
  {
    id: 'finn',
    name: 'Finn',
    color: [180, 100, 255],
    sprite: 'heads/finn.png',
    initials: 'FN',
    abilityId: 'cheeky_dinghy',
    abilityName: 'Cheeky Dinghy',
    abilityDescription: 'Summon a speedboat and ram enemies around the map.',
  },
];

const CHARACTER_BY_ID = new Map(CHARACTERS.map((character) => [character.id, character]));

export function getCharacter(id: string | undefined): CharacterDefinition {
  return CHARACTER_BY_ID.get(id ?? '') ?? CHARACTERS[0];
}
