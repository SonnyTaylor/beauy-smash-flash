#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tokio::sync::Mutex;

mod commands;
mod discovery;
mod game;
mod net;
mod protocol;
mod session;

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(session::AppState::default())))
        .invoke_handler(tauri::generate_handler![
            commands::stop_session,
            commands::start_host,
            commands::join_game,
            commands::scan_servers,
            commands::local_ip,
            commands::set_ready,
            commands::select_character,
            commands::set_name,
            commands::update_lobby_config,
            commands::start_match,
            commands::send_input
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
