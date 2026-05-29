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
  /** LAN wire protocol version */
  version: number;
  app_version?: string;
}

export interface AppInfo {
  app_version: string;
  protocol_version: number;
}

export interface LobbyPlayerSnapshot {
  id: number;
  name: string;
  character_id: string;
  primary_weapon_id?: string;
  ready: boolean;
  is_host: boolean;
  is_bot?: boolean;
  /** 0 = unassigned, 1 = Alpha, 2 = Bravo */
  team?: number;
}

export type Gamemode =
  | 'deathmatch'
  | 'team_deathmatch'
  | 'last_mate_standing'
  | 'zombie_horde';

export type WaveState = 'intermission' | 'active';

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
  bot_count: number;
  wave_goal: number;
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
  bot_count: 0,
  wave_goal: 0,
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

export type EffectKind =
  | 'explosion'
  | 'aim_reticle'
  | 'hack'
  | 'truth_nuke'
  | 'truth_explosion'
  | 'splat'
  | 'mark'
  | 'poison'
  | 'zap'
  | 'slash'
  | 'wall_hit'
  | 'directors_cut'
  | 'chi_beam'
  | 'chi_channel'
  | 'reel_shield'
  | 'reel_post'
  | 'boat_splash'
  | 'malice_zone'
  | 'food_tray'
  | 'oil_slick';

export interface DroneSnapshot {
  id: number;
  owner_id: number;
  x: number;
  y: number;
  hp: number;
}

export interface WorldEffectSnapshot {
  id: number;
  kind: EffectKind;
  x: number;
  y: number;
  radius: number;
  life: number;
  owner_id: number;
  origin_x?: number;
  origin_y?: number;
  target_x?: number;
  target_y?: number;
  max_life?: number;
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
  pending_character_id?: string | null;
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
  ability_aim_x?: number;
  ability_aim_y?: number;
  hacked_remaining: number;
  slowed_remaining?: number;
  marked_remaining?: number;
  directors_cut_remaining?: number;
  directors_cut_shots?: number;
  poison_remaining?: number;
  stillness_stacks?: number;
  reel_shield_remaining?: number;
  boat_mode_remaining?: number;
  hangover_remaining?: number;
  kart_mode_remaining?: number;
  steroid_buff_remaining?: number;
  follower_drone_count?: number;
  reel_index?: number;
  active_weapon?: string;
  active_slot?: number;
  reload_duration?: number;
  primary_weapon?: WeaponSlotSnapshot | null;
  secondary_weapon?: WeaponSlotSnapshot | null;
  is_bot?: boolean;
  is_zombie?: boolean;
  team?: number;
}

export interface StateSnapshot {
  version: number;
  tick: number;
  world: WorldConfig;
  map: MapSnapshot;
  players: PlayerSnapshot[];
  bullets: BulletSnapshot[];
  effects: WorldEffectSnapshot[];
  drones?: DroneSnapshot[];
  kill_feed: KillFeedEntry[];
  match_ended: boolean;
  winner_id: number | null;
  winner_team?: number | null;
  team_scores?: [number, number];
  score_limit: number;
  time_limit_secs: number;
  match_elapsed_secs: number;
  win_condition: WinCondition;
  match_end_reason: MatchEndReason | null;
  fog_of_war?: boolean;
  gamemode?: Gamemode;
  weapon_pickups?: WeaponPickupSnapshot[];
  wave?: number;
  zombies_remaining?: number;
  wave_state?: WaveState;
  wave_intermission_secs?: number;
  wave_goal?: number;
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
