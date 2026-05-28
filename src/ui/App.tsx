import { GameOverlay } from './game/GameOverlay';
import { useGameSession } from './hooks/useGameSession';
import { Lobby } from './lobby/Lobby';
import { LoadoutScreen } from './loadout/LoadoutScreen';
import { MainMenuScreen } from './main-menu/MainMenuScreen';
import { ServerSelectScreen } from './server-select/ServerSelectScreen';
import { SettingsScreen } from './settings/SettingsScreen';

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
              onHost={() => session.goToLoadout('host')}
              onJoin={session.goToServerSelect}
              onSettings={session.openSettings}
            />
          )}

          {session.screen === 'settings' && (
            <SettingsScreen
              settings={session.gameSettings}
              onSave={(next) => {
                session.saveGameSettings(next);
                session.setScreen('main-menu');
              }}
              onBack={() => session.setScreen('main-menu')}
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
              onContinue={(ip) => session.goToLoadout('join', ip)}
            />
          )}

          {session.screen === 'loadout' && (
            <LoadoutScreen
              mode={session.loadoutMode}
              sessionKind={session.sessionKind}
              playerName={session.playerName}
              selectedCharacterId={session.selectedCharacterId}
              selectedWeaponId={session.selectedPrimaryWeaponId}
              isBusy={session.isBusy}
              error={session.error}
              onNameChange={(name) => void session.updateName(name)}
              onCharacterChange={session.setSelectedCharacterId}
              onWeaponChange={session.setSelectedPrimaryWeaponId}
              onBack={session.leaveLoadout}
              onContinue={() => void session.applyLoadout()}
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
              onReadyChange={(ready) => void session.updateReady(ready)}
              onNameChange={(name) => void session.updateName(name)}
              onConfigChange={(config) => void session.updateLobbyConfig(config)}
              onLeave={session.leaveLobby}
              onChangeLoadout={session.openLoadoutFromSession}
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
          isBusy={session.isBusy}
          onPauseChange={session.setPaused}
          onLeaveToMenu={() => void session.leaveGame()}
          onReturnToLobby={() => void session.returnToLobby()}
          onRematch={() => void session.rematch()}
          onChangeLoadout={session.openLoadoutFromSession}
          showControlsHint={session.gameSettings.showControlsHint}
        />
      )}
    </div>
  );
}
