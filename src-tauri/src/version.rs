use serde::{Deserialize, Serialize};

use crate::protocol::PROTOCOL_VERSION;

pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub app_version: String,
    pub protocol_version: u16,
}

impl AppInfo {
    pub fn current() -> Self {
        Self {
            app_version: APP_VERSION.to_string(),
            protocol_version: PROTOCOL_VERSION,
        }
    }
}

pub fn protocol_mismatch_message(host_protocol: u16, client_protocol: u16) -> String {
    format!(
        "Protocol mismatch: host uses v{host_protocol}, this game is v{client_protocol}. \
         Everyone needs the same game version to play together."
    )
}
