// ─────────────────────────────────────────────────────────────
//  Permission — Policy Constants & Tool Categories
// ─────────────────────────────────────────────────────────────
//
//  Phase 2 Pattern
//  ───────────────
//  In the current Phase 1 architecture, the Rust backend is the
//  single enforcer.  These arrays are used by the UI layer to
//  decide which confirmation card to show and to provide
//  visual feedback about risk levels.
//
//  In Phase 2 these same constants will also be used by a
//  client-side "intent guard" that pre-validates tool calls
//  before they hit the IPC bridge, giving instant feedback for
//  obviously-denied actions without a round-trip to Rust.
//
//  The canonical enforcement remains in Rust regardless of phase.
//

/**
 * Tools that are NEVER allowed, regardless of trust tier.
 * These represent destructive or dangerous operations that
 * should always be blocked at the backend level.
 */
export const ALWAYS_DENY_TOOLS: readonly string[] = [
  // Reserved for future dangerous operations.
  // Example: 'execute_shell_command', 'format_disk'
] as const;

/**
 * Tools that only read data and never mutate state.
 * These can be auto-approved even in the most restrictive tier.
 */
export const READ_ONLY_TOOLS: readonly string[] = [
  'read_file',
] as const;

/**
 * Tools that create, modify, or delete data.
 * These require confirmation in guarded mode and may be
 * auto-approved in trusted mode (depending on tier policy).
 */
export const WRITE_TOOLS: readonly string[] = [
  'write_file',
  'delete_file',
  'search_web', // categorized as write because it makes external requests
] as const;

/**
 * Check if a tool name is in the always-deny list.
 */
export function isAlwaysDenied(toolName: string): boolean {
  return (ALWAYS_DENY_TOOLS as readonly string[]).includes(toolName);
}

/**
 * Check if a tool name is read-only.
 */
export function isReadOnly(toolName: string): boolean {
  return (READ_ONLY_TOOLS as readonly string[]).includes(toolName);
}

/**
 * Check if a tool name is a write tool.
 */
export function isWriteTool(toolName: string): boolean {
  return (WRITE_TOOLS as readonly string[]).includes(toolName);
}
