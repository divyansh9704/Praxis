// ─────────────────────────────────────────────────────────────
//  Tool: read_file
//  Reads the contents of a file from the workspace.
//  Auto-approved in ALL trust tiers (read-only operation).
// ─────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core';
import type { ToolDefinition, ToolResult } from '../types';

const readFileTool: ToolDefinition = {
  name: 'read_file',
  description:
    'Read the contents of a file at the given path. Returns the full text content of the file.',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Absolute or workspace-relative path to the file to read.',
      required: true,
    },
  ],
  permissionLevel: 'guarded', // auto-approved even in guarded — see policy.ts
  execute: async (params: Record<string, string>): Promise<ToolResult> => {
    const path = params['path'];
    if (!path) {
      return {
        success: false,
        data: '',
        error: 'Missing required parameter: path',
      };
    }

    try {
      const content: string = await invoke('tool_read_file', { path });
      return { success: true, data: content };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        data: '',
        error: `Failed to read file "${path}": ${message}`,
      };
    }
  },
};

export default readFileTool;
