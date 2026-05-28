import { GameOverlay } from './game/GameOverlay';
import { useGameSession } from './hooks/useGameSession';
import { Lobby } from './lobby/Lobby';
import { MainMenuScreen } from './main-menu/MainMenuScreen';
import { ServerSelectScreen } from './server-select/ServerSelectScreen';

export function App() {
  const session = useGameSession();

  return (
    <div className="app-shell">
      <div ref={session.gameContainerRef} className="game-container" />

      {session.screen !== 'game' && (
        <div className={`screen-backdrop ${session.backdropClass()}`}>
          {session.screen === 'main-menu' && (
            <MainMenuScreen
              localIp={session.localIp}
              isBusy={session.isBusy}
              error={session.error}
              onHost={() => void session.createLobbySession('host')}
              onJoin={session.goToServerSelect}
            />
          )}

          {session.screen === 'server-select' && (
            <ServerSelectScreen
              servers={session.servers}
              joinIp={session.joinIp}
              isScanning={session.isScanning}
              scanMessage={session.scanMessage}
              isBusy={session.isBusy}
              localIp={session.localIp}
              onJoinIpChange={session.setJoinIp}
              onScan={() => void session.scanForServers()}
              onBack={() => void session.leaveLobby()}
              onContinue={(ip) => void session.createLobbySession('join', ip)}
            />
          )}

          {session.screen === 'lobby' && (
            <Lobby
              sessionKind={session.sessionKind}
              lobby={session.lobby}
              fallbackPlayers={session.players}
              isReady={session.isReady}
              isBusy={session.isBusy}
              error={session.error}
              myId={session.myId}
              localIp={session.localIp}
              playerName={session.playerName}
              selectedCharacterId={session.selectedCharacterId}
              onReadyChange={(ready) => void session.updateReady(ready)}
              onNameChange={(name) => void session.updateName(name)}
              onCharacterChange={(id) => void session.updateCharacter(id)}
              onConfigChange={(config) => void session.updateLobbyConfig(config)}
              onLeave={session.leaveLobby}
              onStart={() => void session.startMatch()}
            />
          )}
        </div>
      )}

      {session.screen === 'game' && (
        <GameOverlay
          state={session.latestState}
          myId={session.myId}
          sessionKind={session.sessionKind}
          selectedCharacter={session.selectedCharacter}
          paused={session.paused}
          onPauseChange={session.setPaused}
          onLeaveToMenu={() => void session.leaveGame()}
          onReturnToLobby={() => void session.returnToLobby()}
        />
      )}
    </div>
  );
}
