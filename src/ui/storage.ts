import { CHARACTERS } from '../content/characters';

const STORAGE_KEY_NAME = 'beauy:name';
const STORAGE_KEY_CHARACTER = 'beauy:character';

export function readStoredName(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY_NAME) ?? 'Sonny';
  } catch {
    return 'Sonny';
  }
}

export function writeStoredName(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_NAME, value);
  } catch {
    /* localStorage unavailable */
  }
}

export function readStoredCharacterId(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY_CHARACTER);
    if (stored && CHARACTERS.some((character) => character.id === stored)) {
      return stored;
    }
  } catch {
    /* localStorage unavailable */
  }
  return CHARACTERS[0].id;
}

export function writeStoredCharacterId(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_CHARACTER, value);
  } catch {
    /* localStorage unavailable */
  }
}
