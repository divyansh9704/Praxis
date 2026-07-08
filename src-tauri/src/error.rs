use serde::Serialize;

/// Unified error type for the Praxis backend.
/// All modules surface errors through this enum so that Tauri IPC
/// can serialize them as plain strings for the frontend.
#[derive(Debug, thiserror::Error)]
pub enum PraxisError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Keychain error: {0}")]
    Keychain(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Workspace violation: {0}")]
    WorkspaceViolation(String),

    #[error("LLM error: {0}")]
    LlmError(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    General(String),
}

/// Serialize the error as its Display string so the frontend receives
/// a human-readable message through the Tauri IPC channel.
impl Serialize for PraxisError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
