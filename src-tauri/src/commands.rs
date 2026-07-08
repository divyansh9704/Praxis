use std::path::PathBuf;

use tauri::State;

use crate::db::{self, Action, Conversation, Message, Preference};
use crate::error::PraxisError;
use crate::keychain;
use crate::llm::openrouter::OpenRouterProvider;
use crate::llm::LlmMessage;
use crate::permission::{self, PermissionVerdict, TrustTier};
use crate::workspace;
use crate::AppState;

// ---------------------------------------------------------------------------
// API-key management
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn store_api_key(provider: String, key: String) -> Result<(), PraxisError> {
    keychain::store_api_key(&provider, &key)
}

#[tauri::command]
pub fn get_api_key_exists(provider: String) -> Result<bool, PraxisError> {
    keychain::has_api_key(&provider)
}

#[tauri::command]
pub async fn validate_api_key(provider: String, key: String) -> Result<bool, PraxisError> {
    match provider.as_str() {
        "openrouter" => OpenRouterProvider::validate_key(&key).await,
        "serper" => {
            let client = reqwest::Client::new();
            let resp = client
                .post("https://google.serper.dev/search")
                .header("X-API-KEY", &key)
                .header("Content-Type", "application/json")
                .json(&serde_json::json!({ "q": "test" }))
                .send()
                .await?;
            Ok(resp.status().is_success())
        }
        other => Err(PraxisError::General(format!(
            "Validation not implemented for provider: {}",
            other
        ))),
    }
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn create_conversation(
    state: State<'_, AppState>,
    title: String,
) -> Result<String, PraxisError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    db::create_conversation(&conn, &title)
}

#[tauri::command]
pub fn get_conversations(state: State<'_, AppState>) -> Result<Vec<Conversation>, PraxisError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    db::get_conversations(&conn)
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn add_message(
    state: State<'_, AppState>,
    conversation_id: String,
    role: String,
    content: String,
) -> Result<String, PraxisError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    db::add_message(&conn, &conversation_id, &role, &content)
}

#[tauri::command]
pub fn get_messages(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<Message>, PraxisError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    db::get_messages(&conn, &conversation_id)
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_actions(
    state: State<'_, AppState>,
    conversation_id: String,
) -> Result<Vec<Action>, PraxisError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    db::get_actions(&conn, &conversation_id)
}

#[tauri::command]
pub fn log_action(
    state: State<'_, AppState>,
    conversation_id: String,
    tool_name: String,
    input_params: String,
    trust_tier: String,
    status: String,
    reasoning: String,
) -> Result<String, PraxisError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    db::log_action(
        &conn,
        &conversation_id,
        &tool_name,
        &input_params,
        &trust_tier,
        &status,
        &reasoning,
    )
}

#[tauri::command]
pub fn approve_action(state: State<'_, AppState>, action_id: String) -> Result<(), PraxisError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    db::update_action_status(&conn, &action_id, "approved")
}

#[tauri::command]
pub fn deny_action(state: State<'_, AppState>, action_id: String) -> Result<(), PraxisError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    db::update_action_status(&conn, &action_id, "rejected")
}

// ---------------------------------------------------------------------------
// LLM streaming
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn stream_llm_response(
    app_handle: tauri::AppHandle,
    messages: Vec<LlmMessage>,
    system_prompt: String,
    channel: tauri::ipc::Channel<String>,
) -> Result<String, PraxisError> {
    let api_key = keychain::get_api_key("openrouter")?;
    let provider = OpenRouterProvider::new(api_key);
    provider
        .complete_streaming(&messages, &system_prompt, channel, app_handle)
        .await
}

// ---------------------------------------------------------------------------
// Tool: file operations (permission-gated)
// ---------------------------------------------------------------------------

/// Resolve a potentially-relative path against the workspace root.
fn resolve_path(workspace: &std::path::Path, path: &str) -> PathBuf {
    let p = PathBuf::from(path);
    if p.is_absolute() {
        p
    } else {
        workspace.join(p)
    }
}

/// Parse a trust tier string into the enum.
fn parse_tier(tier: &str) -> TrustTier {
    match tier {
        "trusted" | "trusted_session" => TrustTier::TrustedSession,
        _ => TrustTier::Guarded,
    }
}

#[tauri::command]
pub fn tool_read_file(state: State<'_, AppState>, path: String) -> Result<String, PraxisError> {
    let ws = state
        .workspace_path
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    let resolved = resolve_path(&ws, &path);

    if !permission::is_path_within_workspace(&ws, &resolved) {
        return Err(PraxisError::PermissionDenied(format!(
            "Path '{}' is outside the workspace",
            resolved.display()
        )));
    }

    let content = std::fs::read_to_string(&resolved)?;
    Ok(content)
}

#[derive(serde::Serialize)]
pub struct FileInfo {
    name: String,
    is_dir: bool,
}

#[tauri::command]
pub fn tool_list_dir(
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<FileInfo>, PraxisError> {
    let ws = state
        .workspace_path
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    let resolved = resolve_path(&ws, &path);

    if !permission::is_path_within_workspace(&ws, &resolved) {
        return Err(PraxisError::PermissionDenied(format!(
            "Path '{}' is outside the workspace",
            resolved.display()
        )));
    }

    let mut result = Vec::new();
    if resolved.is_dir() {
        for entry in std::fs::read_dir(resolved)? {
            let entry = entry?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let is_dir = entry.file_type()?.is_dir();
            result.push(FileInfo { name, is_dir });
        }
    }

    // Sort directories first, then alphabetical
    result.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .reverse()
            .then_with(|| a.name.cmp(&b.name))
    });

    Ok(result)
}

#[tauri::command]
pub fn tool_write_file(
    state: State<'_, AppState>,
    path: String,
    content: String,
    trust_tier: String,
    action_id: String,
) -> Result<(), PraxisError> {
    let ws = state
        .workspace_path
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    let resolved = resolve_path(&ws, &path);
    let tier = parse_tier(&trust_tier);

    let verdict = permission::check_permission("write_file", &tier, &ws, Some(&resolved));

    match verdict {
        PermissionVerdict::AutoApproved => {
            // Ensure parent directory exists.
            if let Some(parent) = resolved.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&resolved, &content)?;
            Ok(())
        }
        PermissionVerdict::RequiresConfirmation => {
            // Verify the action has been approved in the database.
            let conn = state
                .db
                .lock()
                .map_err(|e| PraxisError::General(e.to_string()))?;
            let mut stmt = conn
                .prepare("SELECT status FROM actions WHERE id = ?1")
                .map_err(PraxisError::Database)?;
            let status: String = stmt
                .query_row(rusqlite::params![action_id], |row| row.get(0))
                .map_err(|_| {
                    PraxisError::PermissionDenied(format!(
                        "Action '{}' not found — cannot write without approval",
                        action_id
                    ))
                })?;

            if status != "approved" {
                return Err(PraxisError::PermissionDenied(format!(
                    "Action '{}' has status '{}' — write requires 'approved'",
                    action_id, status
                )));
            }

            if let Some(parent) = resolved.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&resolved, &content)?;
            Ok(())
        }
        PermissionVerdict::Denied(reason) => Err(PraxisError::PermissionDenied(reason)),
    }
}

#[tauri::command]
pub fn tool_delete_file(
    state: State<'_, AppState>,
    path: String,
    trust_tier: String,
    action_id: String,
) -> Result<(), PraxisError> {
    let ws = state
        .workspace_path
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    let resolved = resolve_path(&ws, &path);
    let tier = parse_tier(&trust_tier);

    let verdict = permission::check_permission("delete_file", &tier, &ws, Some(&resolved));

    match verdict {
        PermissionVerdict::AutoApproved => {
            std::fs::remove_file(&resolved)?;
            Ok(())
        }
        PermissionVerdict::RequiresConfirmation => {
            let conn = state
                .db
                .lock()
                .map_err(|e| PraxisError::General(e.to_string()))?;
            let mut stmt = conn
                .prepare("SELECT status FROM actions WHERE id = ?1")
                .map_err(PraxisError::Database)?;
            let status: String = stmt
                .query_row(rusqlite::params![action_id], |row| row.get(0))
                .map_err(|_| {
                    PraxisError::PermissionDenied(format!(
                        "Action '{}' not found — cannot delete without approval",
                        action_id
                    ))
                })?;

            if status != "approved" {
                return Err(PraxisError::PermissionDenied(format!(
                    "Action '{}' has status '{}' — delete requires 'approved'",
                    action_id, status
                )));
            }

            std::fs::remove_file(&resolved)?;
            Ok(())
        }
        PermissionVerdict::Denied(reason) => Err(PraxisError::PermissionDenied(reason)),
    }
}

// ---------------------------------------------------------------------------
// Tool: web search (Serper)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn tool_search_web(query: String) -> Result<String, PraxisError> {
    let api_key = keychain::get_api_key("serper")?;
    let client = reqwest::Client::new();
    let resp = client
        .post("https://google.serper.dev/search")
        .header("X-API-KEY", &api_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "q": query }))
        .send()
        .await?;

    let text = resp.text().await?;
    Ok(text)
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_workspace_path(state: State<'_, AppState>) -> Result<String, PraxisError> {
    let ws = state
        .workspace_path
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    Ok(ws.display().to_string())
}

#[tauri::command]
pub fn set_workspace_path(state: State<'_, AppState>, path: String) -> Result<(), PraxisError> {
    let validated = workspace::validate_workspace_path(&path)?;
    let mut ws = state
        .workspace_path
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    *ws = validated;
    Ok(())
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_preferences(
    state: State<'_, AppState>,
    memory_type: String,
) -> Result<Vec<Preference>, PraxisError> {
    let conn = state
        .db
        .lock()
        .map_err(|e| PraxisError::General(e.to_string()))?;
    db::get_preferences(&conn, &memory_type)
}
