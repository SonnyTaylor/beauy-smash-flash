export type Rgb = [number, number, number];

export interface WorldConfig {
  width: number;
  height: number;
}

export interface RectSnapshot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapSnapshot {
  id: string;
  name: string;
  walls: RectSnapshot[];
}

export interface SessionInfo {
  player_id: number;
  world: WorldConfig;
}

export interface ServerInfo {
  name: string;
  address: string;
  game_port: number;
  player_count: number;
  max_players: number;
  version: number;
}

export interface LobbyPlayerSnapshot {
  id: number;
  name: string;
  character_id: string;
  primary_weapon_id?: string;
  ready: boolean;
  is_host: boolean;
}

export type Gamemode = 'deathmatch' | 'team_deathmatch' | 'last_mate_standing';

export type WinCondition = 'kills' | 'time' | 'either';

export type MatchEndReason = 'score' | 'time';

export interface LobbyConfig {
  server_name: string;
  map_id: string;
  gamemode: Gamemode;
  max_players: number;
  score_limit: number;
  time_limit_secs: number;
  win_condition: WinCondition;
  friendly_fire: boolean;
  fog_of_war: boolean;
}

export const DEFAULT_LOBBY_CONFIG: LobbyConfig = {
  server_name: 'LAN Game',
  map_id: 'split',
  gamemode: 'deathmatch',
  max_players: 8,
  score_limit: 20,
  time_limit_secs: 300,
  win_condition: 'kills',
  friendly_fire: true,
  fog_of_war: false,
};

export interface GameSettings {
  serverName: string;
  masterVolume: number;
  musicEnabled: boolean;
  showControlsHint: boolean;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  serverName: 'LAN Game',
  masterVolume: 0.85,
  musicEnabled: true,
  showControlsHint: true,
};

export interface LobbySnapshot {
  players: LobbyPlayerSnapshot[];
  max_players: number;
  match_started: boolean;
  network_note: string;
  config: LobbyConfig;
}

export interface InputSnapshot {
  seq: number;
  dx: number;
  dy: number;
  aim_x: number;
  aim_y: number;
  fire: boolean;
  reload: boolean;
  ability: boolean;
  dash: boolean;
  switch_weapon?: boolean;
  drop_weapon?: boolean;
  interact?: boolean;
}

export interface WeaponSlotSnapshot {
  weapon_id: string;
  ammo: number;
  max_ammo: number;
}

export interface WeaponPickupSnapshot {
  id: number;
  weapon_id: string;
  x: number;
  y: number;
  ammo: number;
  max_ammo: number;
}

export interface BulletSnapshot {
  id: number;
  owner_id: number;
  x: number;
  y: number;
  weapon_id?: string;
}

export type EffectKind = 'explosion' | 'aim_reticle';

export interface WorldEffectSnapshot {
  id: number;
  kind: EffectKind;
  x: number;
  y: number;
  radius: number;
  life: number;
  owner_id: number;
}

export interface KillFeedEntry {
  killer_id: number;
  killer_name: string;
  victim_id: number;
  victim_name: string;
}

export interface PlayerSnapshot {
  id: number;
  x: number;
  y: number;
  angle: number;
  color: Rgb;
  name: string;
  character_id: string;
  hp: number;
  max_hp: number;
  ammo: number;
  max_ammo: number;
  score: number;
  kills: number;
  deaths: number;
  alive: boolean;
  reloading: boolean;
  reload_remaining: number;
  spawn_protected: boolean;
  respawn_in: number;
  ability_charge: number;
  ability_windup: number;
  hacked_remaining: number;
  active_weapon?: string;
  active_slot?: number;
  reload_duration?: number;
  primary_weapon?: WeaponSlotSnapshot | null;
  secondary_weapon?: WeaponSlotSnapshot | null;
}

export interface StateSnapshot {
  version: number;
  tick: number;
  world: WorldConfig;
  map: MapSnapshot;
  players: PlayerSnapshot[];
  bullets: BulletSnapshot[];
  effects: WorldEffectSnapshot[];
  kill_feed: KillFeedEntry[];
  match_ended: boolean;
  winner_id: number | null;
  score_limit: number;
  time_limit_secs: number;
  match_elapsed_secs: number;
  win_condition: WinCondition;
  match_end_reason: MatchEndReason | null;
  fog_of_war?: boolean;
  weapon_pickups?: WeaponPickupSnapshot[];
}

export interface CharacterDefinition {
  id: string;
  name: string;
  color: Rgb;
  sprite: string;
  initials: string;
  abilityId: string;
  abilityName: string;
  abilityDescription: string;
}
