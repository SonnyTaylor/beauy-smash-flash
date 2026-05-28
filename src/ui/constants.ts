import type { Gamemode } from '../shared/types';

export const GAMEMODE_OPTIONS: Array<{ id: Gamemode; label: string; available: boolean }> = [
  { id: 'deathmatch', label: 'Deathmatch', available: true },
  { id: 'team_deathmatch', label: 'Team Deathmatch', available: false },
  { id: 'last_mate_standing', label: 'Last Mate Standing', available: false },
];

export const SCORE_LIMIT_OPTIONS = [10, 15, 20, 30, 50];
export const MAX_PLAYERS_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];
