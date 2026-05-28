import type { CharacterDefinition, StateSnapshot } from '../../shared/types';
import { getCharacter } from '../character';

export function GameOverlay({
  state,
  myId,
  selectedCharacter,
  onMockLobby,
}: {
  state: StateSnapshot | null;
  myId: number;
  selectedCharacter: CharacterDefinition;
  onMockLobby: () => void;
}) {
  const me = state?.players.find((player) => player.id === myId);
  return (
    <div className="game-overlay">
      <div className="hud-pill">
        <strong>{me?.name || 'Player'}</strong>
        <span>{getCharacter(me?.character_id ?? selectedCharacter.id).abilityName}</span>
      </div>
      <div className="hud-pill">
        <span>Players {state?.players.length ?? 0}</span>
        <span>Tick {state?.tick ?? 0}</span>
      </div>
      <button className="tiny-button" onClick={onMockLobby}>
        Lobby mock
      </button>
    </div>
  );
}
