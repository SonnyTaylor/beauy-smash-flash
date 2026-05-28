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
  ready: boolean;
  is_host: boolean;
}

export type Gamemode = 'deathmatch' | 'team_deathmatch' | 'last_mate_standing';

export interface LobbyConfig {
  map_id: string;
  gamemode: Gamemode;
  max_players: number;
  score_limit: number;
  friendly_fire: boolean;
}

export const DEFAULT_LOBBY_CONFIG: LobbyConfig = {
  map_id: 'warehouse',
  gamemode: 'deathmatch',
  max_players: 8,
  score_limit: 20,
  friendly_fire: true,
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
}

export interface PlayerSnapshot {
  id: number;
  x: number;
  y: number;
  angle: number;
  color: Rgb;
  name: string;
  character_id: string;
}

export interface StateSnapshot {
  version: number;
  tick: number;
  world: WorldConfig;
  map: MapSnapshot;
  players: PlayerSnapshot[];
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
