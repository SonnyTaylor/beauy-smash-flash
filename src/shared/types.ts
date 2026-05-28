export type Rgb = [number, number, number];

export interface WorldConfig {
  width: number;
  height: number;
}

export interface SessionInfo {
  player_id: number;
  world: WorldConfig;
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
