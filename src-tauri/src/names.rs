pub fn is_placeholder_player_name(name: &str) -> bool {
    matches!(name, "Sonny" | "Host" | "Player") || name.trim().is_empty()
}

pub fn character_display_name(character_id: &str) -> &'static str {
    match character_id {
        "bailey" => "Bailey",
        "jacob" => "Jacob",
        "isaak" => "Isaak",
        "taj" => "Taj",
        "finn" | "cheeky_dinghy" => "Finn",
        "luca" => "Luca",
        "sifan" => "Sifan",
        "connor" => "Connor",
        "archie" => "Archie",
        "arthur" => "Arthur",
        "oscar" => "Oscar",
        "vlad" => "Vlad",
        "mango" => "Mango",
        "andrew" => "Andrew",
        "lee" => "Lee Moore",
        "martin" => "Martin",
        "tristan" => "Tristan",
        "andy" => "Andy",
        "xander" => "Xander",
        _ => "Sonny",
    }
}

pub fn resolve_player_name(name: &str, character_id: &str) -> String {
    if is_placeholder_player_name(name) {
        character_display_name(character_id).to_string()
    } else {
        name.trim().chars().take(24).collect()
    }
}

pub fn trim_server_name(server_name: &str) -> String {
    server_name.trim().chars().take(32).collect()
}

pub fn display_server_name(server_name: &str) -> &str {
    let trimmed = server_name.trim();
    if trimmed.is_empty() {
        "LAN Game"
    } else {
        trimmed
    }
}
