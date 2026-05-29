import { getCharacter } from '../content/characters';

/** Stored in localStorage when the player has never set a custom name. */
export const DEFAULT_STORED_PLAYER_NAME = 'Sonny';

const PLACEHOLDER_NAMES = new Set(['Sonny', 'Host', 'Player']);

export function isPlaceholderPlayerName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length === 0 || PLACEHOLDER_NAMES.has(trimmed);
}

/** Use the character name when the player never picked a custom display name. */
export function resolvePlayerDisplayName(name: string, characterId: string): string {
  if (isPlaceholderPlayerName(name)) {
    return getCharacter(characterId).name;
  }
  return name.trim();
}
