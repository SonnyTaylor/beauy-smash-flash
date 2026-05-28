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
    abilityDescription:
      "Hack the nearest enemy for 4s — inverted controls and they take 30% extra damage.",
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
      "30s movie mode — 1.67× speed, 24 popcorn shots that mark targets. Kills refund 3 shots.",
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
      'Speedboat for 4s — ram for 40 dmg (refunds charge). Cannot shoot; shorter hangover after.',
  },
  {
    id: 'zombie',
    name: 'Zombie',
    color: [80, 200, 60],
    sprite: 'heads/finn.png',
    initials: 'Z',
    abilityId: 'none',
    abilityName: 'Shamble',
    abilityDescription: 'Slow, hungry, and armed with claws.',
  },
];

const CHARACTER_BY_ID = new Map(CHARACTERS.map((character) => [character.id, character]));

export function getCharacter(id: string | undefined): CharacterDefinition {
  return CHARACTER_BY_ID.get(id ?? '') ?? CHARACTERS[0];
}
