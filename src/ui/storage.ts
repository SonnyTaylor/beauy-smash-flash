import { CHARACTERS } from '../content/characters';
import { DEFAULT_WEAPON_ID } from '../content/weapons';
import { DEFAULT_GAME_SETTINGS, type GameSettings } from '../shared/types';

const STORAGE_KEY_NAME = 'beauy:name';
const STORAGE_KEY_CHARACTER = 'beauy:character';
const STORAGE_KEY_WEAPON = 'beauy:weapon';
const STORAGE_KEY_SETTINGS = 'beauy:settings';

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

export function readStoredPrimaryWeaponId(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY_WEAPON);
    if (stored?.trim()) {
      return stored.trim().toLowerCase();
    }
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_WEAPON_ID;
}

export function writeStoredPrimaryWeaponId(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_WEAPON, value);
  } catch {
    /* localStorage unavailable */
  }
}

export function readGameSettings(): GameSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_GAME_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      serverName:
        typeof parsed.serverName === 'string' && parsed.serverName.trim()
          ? parsed.serverName.trim().slice(0, 32)
          : DEFAULT_GAME_SETTINGS.serverName,
      masterVolume:
        typeof parsed.masterVolume === 'number'
          ? Math.min(1, Math.max(0, parsed.masterVolume))
          : DEFAULT_GAME_SETTINGS.masterVolume,
      musicEnabled:
        typeof parsed.musicEnabled === 'boolean'
          ? parsed.musicEnabled
          : DEFAULT_GAME_SETTINGS.musicEnabled,
      showControlsHint:
        typeof parsed.showControlsHint === 'boolean'
          ? parsed.showControlsHint
          : DEFAULT_GAME_SETTINGS.showControlsHint,
    };
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function writeGameSettings(settings: GameSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch {
    /* localStorage unavailable */
  }
}
