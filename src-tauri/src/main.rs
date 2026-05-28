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
            commands::start_host,
            commands::join_game,
            commands::scan_servers,
            commands::set_ready,
            commands::select_character,
            commands::start_match,
            commands::send_input
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
