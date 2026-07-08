# Praxis API

While Praxis is primarily a desktop application, the internal Rust kernel exposes a clean IPC (Inter-Process Communication) API that the React frontend consumes.

## Rust Commands (Tauri Handlers)

```rust
// Fetches the existence of API keys from the OS Keychain without returning the actual string
#[tauri::command]
pub fn get_api_key_exists(provider: String) -> bool;

// Modifies the active workspace directory constraint
#[tauri::command]
pub fn set_workspace_path(path: String) -> Result<(), String>;

// Core messaging pipeline
#[tauri::command]
pub fn send_prompt(text: String, workspace_id: String) -> Result<String, String>;
```

*Note: For security reasons, Praxis does not currently expose a localhost REST API or WebSocket server to external applications. All interactions must go through the authenticated Tauri IPC bridge.*
