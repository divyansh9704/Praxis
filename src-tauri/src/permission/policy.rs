/// Static tool-policy definitions.
///
/// Each tool maps to one of three policy levels. In **Phase 2** this will be
/// extended with glob / regex pattern matching so that dynamically-registered
/// MCP tools can inherit a default policy based on naming conventions
/// (e.g. `mcp::*::read_*` → ReadOnly).

/// The access level granted to a tool by default.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolPolicy {
    /// Tool only reads data — always safe to auto-approve.
    ReadOnly,
    /// Tool writes / mutates data — requires confirmation in Guarded tier.
    Write,
    /// Tool is unconditionally blocked (e.g. `rm -rf`, `exec`).
    AlwaysDeny,
}

/// Returns the static policy for a known tool name.
///
/// Unknown tools default to `Write` (the safest non-blocking default).
pub fn tool_policy(tool_name: &str) -> ToolPolicy {
    match tool_name {
        // ---- read-only tools ----
        "read_file" | "list_dir" | "search_files" | "search_web" | "get_messages"
        | "get_conversations" | "get_actions" | "get_preferences" | "get_workspace_path"
        | "get_api_key_exists" | "validate_api_key" => ToolPolicy::ReadOnly,

        // ---- write tools ----
        "write_file"
        | "delete_file"
        | "create_dir"
        | "rename_file"
        | "store_api_key"
        | "set_workspace_path"
        | "add_message"
        | "create_conversation"
        | "log_action"
        | "approve_action"
        | "deny_action"
        | "save_preference" => ToolPolicy::Write,

        // ---- always-deny tools ----
        "exec_shell" | "run_arbitrary_command" | "format_disk" => ToolPolicy::AlwaysDeny,

        // Unknown tools require confirmation — fail-safe.
        _ => ToolPolicy::Write,
    }
}
