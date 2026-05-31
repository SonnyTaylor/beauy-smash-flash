import { LazyStore } from '@tauri-apps/plugin-store';
import { isPlayableCharacterId, PLAYABLE_CHARACTERS } from '../content/characters';
import { DEFAULT_WEAPON_ID } from '../content/weapons';
import { DEFAULT_GAME_SETTINGS, type GameSettings } from '../shared/types';

const STORE_PATH = 'settings.json';
const STORE_VERSION = 1;

// Legacy localStorage keys for one-time migration
const LEGACY_KEY_NAME = 'beauy:name';
const LEGACY_KEY_CHARACTER = 'beauy:character';
const LEGACY_KEY_WEAPON = 'beauy:weapon';
const LEGACY_KEY_SETTINGS = 'beauy:settings';

let store: LazyStore | null = null;
let initPromise: Promise<LazyStore> | null = null;

async function getStore(): Promise<LazyStore> {
  if (store) return store;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const s = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 100 });
    await migrateFromLocalStorage(s);
    store = s;
    return s;
  })();

  return initPromise;
}

async function migrateFromLocalStorage(s: LazyStore): Promise<void> {
  const existingVersion = await s.get<number>('version');
  if (existingVersion !== undefined && existingVersion !== null) return;

  let name = 'Sonny';
  let characterId = PLAYABLE_CHARACTERS[0].id;
  let weaponId = DEFAULT_WEAPON_ID;
  let gameSettings: GameSettings = { ...DEFAULT_GAME_SETTINGS };

  try {
    const legacyName = window.localStorage.getItem(LEGACY_KEY_NAME);
    if (legacyName) name = legacyName;

    const legacyChar = window.localStorage.getItem(LEGACY_KEY_CHARACTER);
    if (legacyChar && isPlayableCharacterId(legacyChar)) characterId = legacyChar;

    const legacyWeapon = window.localStorage.getItem(LEGACY_KEY_WEAPON);
    if (legacyWeapon?.trim()) weaponId = legacyWeapon.trim().toLowerCase();

    const legacySettings = window.localStorage.getItem(LEGACY_KEY_SETTINGS);
    if (legacySettings) {
      const parsed = JSON.parse(legacySettings) as Partial<GameSettings>;
      gameSettings = sanitizeGameSettings(parsed);
    }
  } catch {
    // ignore migration errors, use defaults
  }

  await s.set('version', STORE_VERSION);
  await s.set('name', name);
  await s.set('characterId', characterId);
  await s.set('weaponId', weaponId);
  await s.set('gameSettings', gameSettings);

  try {
    window.localStorage.removeItem(LEGACY_KEY_NAME);
    window.localStorage.removeItem(LEGACY_KEY_CHARACTER);
    window.localStorage.removeItem(LEGACY_KEY_WEAPON);
    window.localStorage.removeItem(LEGACY_KEY_SETTINGS);
  } catch {
    // ignore
  }
}

function sanitizeGameSettings(parsed: Partial<GameSettings> | null | undefined): GameSettings {
  if (!parsed) return { ...DEFAULT_GAME_SETTINGS };
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
}

export async function readStoredName(): Promise<string> {
  const s = await getStore();
  return (await s.get<string>('name')) ?? 'Sonny';
}

export async function writeStoredName(value: string): Promise<void> {
  const s = await getStore();
  await s.set('name', value);
}

export async function readStoredCharacterId(): Promise<string> {
  const s = await getStore();
  const value = await s.get<string>('characterId');
  if (value && isPlayableCharacterId(value)) return value;
  return PLAYABLE_CHARACTERS[0].id;
}

export async function writeStoredCharacterId(value: string): Promise<void> {
  const s = await getStore();
  await s.set('characterId', value);
}

export async function readStoredPrimaryWeaponId(): Promise<string> {
  const s = await getStore();
  const value = await s.get<string>('weaponId');
  if (value?.trim()) return value.trim().toLowerCase();
  return DEFAULT_WEAPON_ID;
}

export async function writeStoredPrimaryWeaponId(value: string): Promise<void> {
  const s = await getStore();
  await s.set('weaponId', value.trim().toLowerCase());
}

export async function readGameSettings(): Promise<GameSettings> {
  const s = await getStore();
  const value = await s.get<Partial<GameSettings>>('gameSettings');
  return sanitizeGameSettings(value);
}

export async function writeGameSettings(settings: GameSettings): Promise<void> {
  const s = await getStore();
  await s.set('gameSettings', sanitizeGameSettings(settings));
}
