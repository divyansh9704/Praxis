// ─────────────────────────────────────────────────────────────
//  Tool Index — Registers all built-in tools with the registry.
// ─────────────────────────────────────────────────────────────

import { toolRegistry } from '../toolRegistry';
import readFileTool from './readFile';
import searchWebTool from './searchWeb';

/**
 * Call this once at app startup (from `initCore()`) to register
 * every built-in tool with the global ToolRegistry singleton.
 */
export function registerAllTools(): void {
  toolRegistry.register(readFileTool);
  toolRegistry.register(searchWebTool);
}
