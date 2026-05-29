#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tokio::sync::Mutex;

mod abilities;
mod bots;
mod commands;
mod discovery;
mod game;
mod maps;
mod net;
mod network;
mod protocol;
mod roster_expansion;
mod session;
mod version;
mod weapons;

use crate::version::AppInfo;

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo::current()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Arc::new(Mutex::new(session::AppState::default())))
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            commands::stop_session,
            commands::start_host,
            commands::join_game,
            commands::scan_servers,
            commands::local_ip,
            commands::set_ready,
            commands::select_character,
            commands::update_loadout,
            commands::set_name,
            commands::update_lobby_config,
            commands::start_match,
            commands::return_to_lobby,
            commands::rematch,
            commands::set_match_paused,
            commands::send_input,
            commands::set_bot_count,
            commands::set_player_team
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
