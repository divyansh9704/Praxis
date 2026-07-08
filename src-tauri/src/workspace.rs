use std::path::{Path, PathBuf};

use crate::error::PraxisError;

/// Returns the default workspace directory: `{Documents}/Praxis-Workspace`.
pub fn get_default_workspace() -> PathBuf {
    let docs = dirs::document_dir().unwrap_or_else(|| {
        dirs::home_dir()
            .expect("Could not determine home directory")
            .join("Documents")
    });
    docs.join("Praxis-Workspace")
}

/// Creates the workspace directory (and parents) if it does not exist.
pub fn ensure_workspace(path: &Path) -> Result<(), PraxisError> {
    if !path.exists() {
        std::fs::create_dir_all(path)?;
        log::info!("Created workspace directory: {}", path.display());
    }
    Ok(())
}

/// Validates a workspace path string: must be absolute and a valid directory
/// (or creatable). Returns the canonicalized `PathBuf`.
pub fn validate_workspace_path(path: &str) -> Result<PathBuf, PraxisError> {
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err(PraxisError::WorkspaceViolation(
            "Workspace path must be absolute".into(),
        ));
    }
    // Ensure the directory exists so we can canonicalize it.
    ensure_workspace(&p)?;
    let canonical = std::fs::canonicalize(&p)?;
    Ok(canonical)
}
