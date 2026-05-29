use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

static LOG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

pub fn init() {
    let Some(dir) = log_dir() else {
        return;
    };
    if create_dir_all(&dir).is_err() {
        return;
    }
    let path = dir.join("game.log");
    if let Ok(mut guard) = LOG_PATH.lock() {
        *guard = Some(path);
    }
}

pub fn info(tag: &str, message: &str) {
    write_line("INFO", tag, message);
}

pub fn warn(tag: &str, message: &str) {
    write_line("WARN", tag, message);
}

pub fn error(tag: &str, message: &str) {
    write_line("ERROR", tag, message);
}

fn log_dir() -> Option<PathBuf> {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        return Some(PathBuf::from(local).join("beauy-smash-flash").join("logs"));
    }
    std::env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".beauy-smash-flash").join("logs"))
}

fn write_line(level: &str, tag: &str, message: &str) {
    let path = match LOG_PATH.lock() {
        Ok(guard) => guard.clone(),
        Err(_) => None,
    };
    let Some(path) = path else {
        return;
    };
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let line = format!("[{timestamp}] {level} [{tag}] {message}\n");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(line.as_bytes());
    }
}
