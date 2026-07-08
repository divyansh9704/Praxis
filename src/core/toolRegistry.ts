// ─────────────────────────────────────────────────────────────
//  Praxis Core — Tool Registry
//  Central registration point for all tool definitions.
// ─────────────────────────────────────────────────────────────

import type { ToolDefinition, ToolResult } from './types';

/**
 * ToolRegistry manages the lifecycle of available tools.
 *
 * - `register()` adds a tool definition.
 * - `get()` retrieves a tool by name.
 * - `getAll()` returns every registered tool.
 * - `getToolSchemas()` returns a serialisable array for LLM prompts.
 * - `execute()` runs a tool by name, wrapping errors into ToolResult.
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /** Register a new tool. Throws if a duplicate name is detected. */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Overwriting existing tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Retrieve a single tool definition by name, or undefined. */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** Return all registered tool definitions. */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Return a JSON-safe array of tool schemas suitable for embedding
   * in an LLM system prompt (no executable references).
   */
  getToolSchemas(): Array<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      description: string;
      required: boolean;
    }>;
  }> {
    return this.getAll().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters.map((p) => ({
        name: p.name,
        type: p.type,
        description: p.description,
        required: p.required,
      })),
    }));
  }

  /**
   * Execute a tool by name, returning a wrapped ToolResult.
   * Unknown tool names and runtime errors are caught and surfaced
   * as `{ success: false }` results rather than thrown exceptions.
   */
  async execute(
    name: string,
    params: Record<string, string>,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        data: '',
        error: `Unknown tool: "${name}"`,
      };
    }

    try {
      return await tool.execute(params);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      return {
        success: false,
        data: '',
        error: `Tool "${name}" failed: ${message}`,
      };
    }
  }
}

/** Global singleton — import this wherever you need tool access. */
export const toolRegistry = new ToolRegistry();
