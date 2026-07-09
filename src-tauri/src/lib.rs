mod commands;
mod db;
mod error;
mod keychain;
mod llm;
mod permission;
mod workspace;

#[cfg(test)]
mod e2e_tests;

pub use error::PraxisError;

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

use permission::TrustTier;

/// Shared application state managed by Tauri and accessible from every command.
pub struct AppState {
    pub db: Mutex<Connection>,
    pub workspace_path: Mutex<PathBuf>,
    pub trust_tier: Mutex<TrustTier>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Resolve the app-local data directory for the SQLite database.
            let app_data_dir = app
                .path()
                .app_local_data_dir()
                .expect("Failed to resolve app local data directory");

            let conn = db::init_db(&app_data_dir).expect("Failed to initialise database");

            // Prepare the default workspace.
            let ws = workspace::get_default_workspace();
            workspace::ensure_workspace(&ws).expect("Failed to create default workspace");

            let state = AppState {
                db: Mutex::new(conn),
                workspace_path: Mutex::new(ws),
                trust_tier: Mutex::new(TrustTier::Guarded),
            };

            app.manage(state);

            log::info!("Praxis backend initialised");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::store_api_key,
            commands::get_api_key_exists,
            commands::validate_api_key,
            commands::create_conversation,
            commands::get_conversations,
            commands::add_message,
            commands::get_messages,
            commands::get_actions,
            commands::log_action,
            commands::approve_action,
            commands::deny_action,
            commands::stream_llm_response,
            commands::tool_list_dir,
            commands::tool_read_file,
            commands::tool_write_file,
            commands::tool_delete_file,
            commands::tool_search_web,
            commands::get_workspace_path,
            commands::set_workspace_path,
            commands::get_preferences,
            commands::set_preference,
            commands::fetch_openrouter_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
