pub mod policy;

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::permission::policy::tool_policy;

/// The trust level active for the current session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrustTier {
    /// Default — destructive or write operations need explicit user approval.
    Guarded,
    /// User has elevated trust for the current session; write operations inside
    /// the workspace are auto-approved.
    #[serde(rename = "trusted")]
    TrustedSession,
}

/// The outcome of a permission check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PermissionVerdict {
    /// The operation may proceed without user interaction.
    AutoApproved,
    /// The operation needs an explicit approve/deny from the user.
    RequiresConfirmation,
    /// The operation is unconditionally blocked.
    Denied(String),
}

/// Core permission gate.
///
/// Evaluates the requested tool against the active trust tier and, for
/// file-system operations, validates that the target path resides inside the
/// workspace root.
pub fn check_permission(
    tool_name: &str,
    tier: &TrustTier,
    workspace_root: &Path,
    target_path: Option<&Path>,
) -> PermissionVerdict {
    let policy = tool_policy(tool_name);

    // Always-deny tools are blocked regardless of tier.
    if policy == policy::ToolPolicy::AlwaysDeny {
        return PermissionVerdict::Denied(format!(
            "Tool '{}' is permanently blocked by policy",
            tool_name
        ));
    }

    // For file-system operations, enforce workspace containment.
    if let Some(target) = target_path {
        if !is_path_within_workspace(workspace_root, target) {
            return PermissionVerdict::Denied(format!(
                "Path '{}' is outside the workspace '{}'",
                target.display(),
                workspace_root.display()
            ));
        }
    }

    match policy {
        policy::ToolPolicy::ReadOnly => PermissionVerdict::AutoApproved,
        policy::ToolPolicy::Write => match tier {
            TrustTier::Guarded => PermissionVerdict::RequiresConfirmation,
            TrustTier::TrustedSession => PermissionVerdict::AutoApproved,
        },
        // Already handled above, but the compiler wants exhaustive matching.
        policy::ToolPolicy::AlwaysDeny => unreachable!(),
    }
}

/// Returns `true` if `target` is a descendant of `workspace_root`.
///
/// Both paths are canonicalized (symlinks resolved, `..` collapsed) before
/// comparison so that escape-via-traversal attacks are caught.
pub fn is_path_within_workspace(workspace_root: &Path, target: &Path) -> bool {
    let Ok(canonical_root) = std::fs::canonicalize(workspace_root) else {
        return false;
    };
    let Ok(canonical_target) = std::fs::canonicalize(target) else {
        // If the target does not yet exist, canonicalize the parent and
        // compare; this handles new-file creation.
        if let Some(parent) = target.parent() {
            if let Ok(canonical_parent) = std::fs::canonicalize(parent) {
                return canonical_parent.starts_with(&canonical_root);
            }
        }
        return false;
    };
    canonical_target.starts_with(&canonical_root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_read_only_tools() {
        let root = PathBuf::from("/");
        let verdict = check_permission("read_file", &TrustTier::Guarded, &root, None);
        assert!(matches!(verdict, PermissionVerdict::AutoApproved));
    }

    #[test]
    fn test_write_tools_guarded() {
        let root = PathBuf::from("/");
        let verdict = check_permission("write_file", &TrustTier::Guarded, &root, None);
        assert!(matches!(verdict, PermissionVerdict::RequiresConfirmation));
    }

    #[test]
    fn test_write_tools_trusted() {
        let root = PathBuf::from("/");
        let verdict = check_permission("write_file", &TrustTier::TrustedSession, &root, None);
        assert!(matches!(verdict, PermissionVerdict::AutoApproved));
    }

    #[test]
    fn test_always_deny_tools() {
        let root = PathBuf::from("/");
        let verdict = check_permission("exec_shell", &TrustTier::TrustedSession, &root, None);
        assert!(matches!(verdict, PermissionVerdict::Denied(_)));
    }

    // ── TEST 1: Security Boundary — Path Traversal ──────────────
    // This tests the EXACT attack vector: a relative path with "../.."
    // that attempts to escape the workspace. The Rust enforcement
    // boundary must reject this regardless of trust tier.

    #[test]
    fn test_path_traversal_rejected_guarded() {
        // Create a real temp directory to act as workspace root.
        let tmp = std::env::temp_dir().join("praxis_test_ws_sec");
        std::fs::create_dir_all(&tmp).unwrap();

        // The traversal target: "../../outside_workspace.txt"
        // resolved against the workspace would be tmp/../../outside_workspace.txt
        let traversal_path = tmp.join("../../outside_workspace.txt");

        let verdict = check_permission(
            "write_file",
            &TrustTier::Guarded,
            &tmp,
            Some(&traversal_path),
        );

        // Must be Denied, not RequiresConfirmation
        match &verdict {
            PermissionVerdict::Denied(reason) => {
                assert!(
                    reason.contains("outside the workspace"),
                    "Expected 'outside the workspace' in reason, got: {}",
                    reason
                );
            }
            other => panic!(
                "Expected PermissionVerdict::Denied for path traversal, got: {:?}",
                other
            ),
        }

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_path_traversal_rejected_trusted_session() {
        // Even TrustedSession must reject path traversal!
        let tmp = std::env::temp_dir().join("praxis_test_ws_sec_trusted");
        std::fs::create_dir_all(&tmp).unwrap();

        let traversal_path = tmp.join("../../outside_workspace.txt");

        let verdict = check_permission(
            "write_file",
            &TrustTier::TrustedSession,
            &tmp,
            Some(&traversal_path),
        );

        match &verdict {
            PermissionVerdict::Denied(reason) => {
                assert!(
                    reason.contains("outside the workspace"),
                    "Expected 'outside the workspace' in reason, got: {}",
                    reason
                );
            }
            other => panic!(
                "TrustedSession MUST still block path traversal, got: {:?}",
                other
            ),
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_path_inside_workspace_allowed() {
        // Sanity check: a file INSIDE the workspace should be allowed.
        let tmp = std::env::temp_dir().join("praxis_test_ws_inside");
        std::fs::create_dir_all(&tmp).unwrap();

        let inside_path = tmp.join("notes.txt");
        // Create the parent dir (it already exists) so canonicalize works
        // for the parent-based check.

        let verdict = check_permission("write_file", &TrustTier::Guarded, &tmp, Some(&inside_path));

        // Should be RequiresConfirmation (guarded), NOT Denied
        assert!(
            matches!(verdict, PermissionVerdict::RequiresConfirmation),
            "A path inside the workspace should not be Denied, got: {:?}",
            verdict
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_list_dir_path_traversal_rejected_guarded() {
        let tmp = std::env::temp_dir().join("praxis_test_ws_list_dir");
        std::fs::create_dir_all(&tmp).unwrap();

        let traversal_path = tmp.join("../../outside_workspace.txt");

        let verdict =
            check_permission("list_dir", &TrustTier::Guarded, &tmp, Some(&traversal_path));

        match &verdict {
            PermissionVerdict::Denied(reason) => {
                assert!(
                    reason.contains("outside the workspace"),
                    "Expected 'outside the workspace' in reason, got: {}",
                    reason
                );
            }
            other => panic!(
                "Expected PermissionVerdict::Denied for path traversal on list_dir, got: {:?}",
                other
            ),
        }

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
