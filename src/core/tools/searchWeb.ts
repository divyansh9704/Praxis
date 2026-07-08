// ─────────────────────────────────────────────────────────────
//  Tool: search_web (Serper)
//  Performs a web search via the Rust backend's Serper integration.
//  Returns the top 5 organic results as a formatted list.
// ─────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core';
import type { ToolDefinition, ToolResult, SearchResult } from '../types';

/** Shape of a single organic result inside the Serper JSON response. */
interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
}

/** Top-level Serper API response shape (only the fields we use). */
interface SerperResponse {
  organic?: SerperOrganicResult[];
}

const searchWebTool: ToolDefinition = {
  name: 'search_web',
  description:
    'Search the web using a query string. Returns the top 5 organic results with titles, links, and snippets.',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'The search query string.',
      required: true,
    },
  ],
  permissionLevel: 'guarded',
  execute: async (params: Record<string, string>): Promise<ToolResult> => {
    const query = params['query'];
    if (!query) {
      return {
        success: false,
        data: '',
        error: 'Missing required parameter: query',
      };
    }

    try {
      // The Rust backend calls Serper and returns raw JSON as a string.
      const rawJson: string = await invoke('tool_search_web', { query });

      const parsed: SerperResponse = JSON.parse(rawJson) as SerperResponse;
      const organic = parsed.organic ?? [];

      // Extract top 5 results into our canonical shape.
      const results: SearchResult[] = organic
        .slice(0, 5)
        .map((item, idx) => ({
          title: item.title ?? '(no title)',
          link: item.link ?? '',
          snippet: item.snippet ?? '',
          position: item.position ?? idx + 1,
        }));

      // Format as a human-readable numbered list for the LLM.
      const formatted = results
        .map(
          (r, i) =>
            `${i + 1}. **${r.title}**\n   ${r.link}\n   ${r.snippet}`,
        )
        .join('\n\n');

      return {
        success: true,
        data: formatted || 'No results found.',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        data: '',
        error: `Web search failed: ${message}`,
      };
    }
  },
};

export default searchWebTool;
