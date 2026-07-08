// ─────────────────────────────────────────────────────────────
//  Permission — Trust Tier Display Logic (UI-SIDE ONLY)
// ─────────────────────────────────────────────────────────────
//
//  ╔══════════════════════════════════════════════════════════╗
//  ║  ⚠️  THIS IS DISPLAY ONLY.                              ║
//  ║                                                          ║
//  ║  These functions tell the UI what card to show           ║
//  ║  (auto-approved indicator, confirmation card, or         ║
//  ║  denied notice). They do NOT enforce permissions.        ║
//  ║                                                          ║
//  ║  Real enforcement happens in the Rust backend via        ║
//  ║  the action approval pipeline (log_action →              ║
//  ║  approve_action / deny_action). The backend is the       ║
//  ║  single source of truth. A malicious or buggy UI         ║
//  ║  cannot bypass Rust-side checks.                         ║
//  ╚══════════════════════════════════════════════════════════╝
//

import type { TrustTier, PermissionVerdict } from '../types';

/**
 * Map of tool name → trust tier → UI-side verdict.
 *
 * If a tool is not listed here it defaults to `requires_confirmation`
 * in guarded mode, `auto_approved` in trusted mode, and `denied` in
 * always_deny mode.
 */
const TOOL_UI_POLICY: Record<string, Partial<Record<TrustTier, PermissionVerdict>>> = {
  // Read-only tools — safe in every tier.
  read_file: {
    guarded: 'auto_approved',
    trusted: 'auto_approved',
    always_deny: 'auto_approved',
  },

  // Search — guarded requires confirmation, trusted auto-approves.
  search_web: {
    guarded: 'requires_confirmation',
    trusted: 'auto_approved',
    always_deny: 'denied',
  },

  // Write tools — never auto-approved in guarded mode.
  write_file: {
    guarded: 'requires_confirmation',
    trusted: 'auto_approved',
    always_deny: 'denied',
  },
  delete_file: {
    guarded: 'requires_confirmation',
    trusted: 'requires_confirmation', // even trusted requires confirmation for deletes
    always_deny: 'denied',
  },
};

/** Default verdicts when a tool has no explicit policy entry. */
const DEFAULT_VERDICTS: Record<TrustTier, PermissionVerdict> = {
  guarded: 'requires_confirmation',
  trusted: 'auto_approved',
  always_deny: 'denied',
};

/**
 * Get the UI-side verdict for a tool in the given trust tier.
 *
 * **Reminder:** This controls what the UI *displays*, not what the
 * backend will actually allow. See module doc comment above.
 */
export function getUIVerdict(
  toolName: string,
  tier: TrustTier,
): PermissionVerdict {
  const toolPolicy = TOOL_UI_POLICY[toolName];
  if (toolPolicy && toolPolicy[tier] !== undefined) {
    return toolPolicy[tier]!;
  }
  return DEFAULT_VERDICTS[tier];
}

/**
 * Returns `true` when the UI should render a confirmation card
 * for this tool in the current trust tier.
 */
export function shouldShowConfirmationCard(
  toolName: string,
  tier: TrustTier,
): boolean {
  return getUIVerdict(toolName, tier) === 'requires_confirmation';
}

/**
 * Returns `true` when the tool is outright denied in this trust tier.
 * The UI should show an informational "denied" badge.
 */
export function isDeniedInUI(
  toolName: string,
  tier: TrustTier,
): boolean {
  return getUIVerdict(toolName, tier) === 'denied';
}

export { TOOL_UI_POLICY };
