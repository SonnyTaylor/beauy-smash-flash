import { CHARACTERS } from '../content/characters';
import type { CharacterDefinition } from '../shared/types';

export function getCharacter(id: string): CharacterDefinition {
  return CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0];
}

export function rgbCss([r, g, b]: [number, number, number]) {
  return `rgb(${r} ${g} ${b})`;
}
