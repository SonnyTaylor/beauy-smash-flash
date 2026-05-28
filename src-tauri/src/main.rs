#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tokio::sync::Mutex;

mod commands;
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
            commands::send_input
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
