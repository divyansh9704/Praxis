// ─────────────────────────────────────────────────────────────
//  Praxis Core — LLM-Based Planner
//  Generates and revises multi-step plans via the LLM.
// ─────────────────────────────────────────────────────────────

import { invoke, Channel } from '@tauri-apps/api/core';
import type { Plan, PlanStep, LlmMessage } from './types';
import { toolRegistry } from './toolRegistry';

/**
 * Planner uses the LLM to break a user request into a structured
 * Plan of tool-call steps with reasoning.
 */
export class Planner {
  /**
   * Generate a fresh plan from a conversation history.
   *
   * @param messages      The conversation history (user + assistant turns).
   * @param proceduralMem Optional procedural memory snippets to inject.
   * @returns             A parsed Plan object.
   */
  async generatePlan(
    messages: LlmMessage[],
    proceduralMem: string = '',
  ): Promise<Plan> {
    const systemPrompt = this.buildSystemPrompt(proceduralMem);
    const fullResponse = await this.callLlm(messages, systemPrompt);
    return this.parsePlanFromResponse(fullResponse);
  }

  /**
   * Revise an existing plan after a step failure.
   *
   * @param originalPlan  The plan that partially failed.
   * @param failedStep    Index of the step that failed.
   * @param error         The error message from the failed step.
   * @param messages      Conversation history for context.
   * @returns             A revised Plan.
   */
  async revisePlan(
    originalPlan: Plan,
    failedStep: number,
    error: string,
    messages: LlmMessage[],
  ): Promise<Plan> {
    const revisionPrompt = this.buildRevisionPrompt(
      originalPlan,
      failedStep,
      error,
    );

    const augmentedMessages: LlmMessage[] = [
      ...messages,
      { role: 'system', content: revisionPrompt },
    ];

    const systemPrompt = this.buildSystemPrompt('');
    const fullResponse = await this.callLlm(augmentedMessages, systemPrompt);
    return this.parsePlanFromResponse(fullResponse);
  }

  /**
   * Reviews a destructive step to ensure it aligns with the user's intent.
   * Outputs JSON: { "approved": boolean, "reason": "..." }
   */
  async reviewStep(
    step: PlanStep,
    userMessage: string
  ): Promise<{ approved: boolean; reason: string }> {
    const systemPrompt = `You are the Praxis Security Reviewer.
Your job is to check if a planned destructive tool call strictly aligns with what the user requested.
Do NOT execute the tool. Just output a JSON object indicating if it should be allowed.

User Request: "${userMessage}"
Tool Planned: ${step.tool}
Params: ${JSON.stringify(step.params)}

Output EXACTLY this JSON schema:
{
  "approved": boolean,
  "reason": "Explain your concern if you reject it, or why you approved it."
}`;

    const messages: LlmMessage[] = [{ role: 'user', content: 'Review the planned action.' }];
    const fullResponse = await this.callLlm(messages, systemPrompt);
    
    try {
      const trimmed = fullResponse.trim();
      const fencedMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      const jsonStr = fencedMatch ? fencedMatch[1].trim() : trimmed;
      const parsed = JSON.parse(jsonStr);
      return {
        approved: !!parsed.approved,
        reason: String(parsed.reason || '')
      };
    } catch {
      return { approved: false, reason: "Reviewer failed to return valid JSON" };
    }
  }

  // ───── Private helpers ─────

  private buildSystemPrompt(proceduralMem: string): string {
    const schemas = toolRegistry.getToolSchemas();
    const toolBlock = JSON.stringify(schemas, null, 2);

    return `You are Praxis, an AI agent that creates structured execution plans.

## Available Tools
${toolBlock}

## Instructions
1. Analyze the user's request carefully.
2. Break it down into sequential tool-call steps.
3. For each step, specify the exact tool name, parameters, and your reasoning.
4. Return your plan as a JSON object with this exact schema:

\`\`\`json
{
  "steps": [
    {
      "tool": "<tool_name>",
      "params": { "<param_name>": "<param_value>" },
      "reasoning": "<why this step is needed>"
    }
  ],
  "summary": "<one-line summary of the overall plan>"
}
\`\`\`

## Rules
- Only use tools from the Available Tools list above.
- Parameter values must be strings.
- Return ONLY the JSON plan — no extra commentary before or after.
- If no tools are needed (e.g. a conversational response), return:
  { "steps": [], "summary": "Direct response — no tool calls needed." }
${proceduralMem ? `\n## Procedural Memory (learned preferences)\n${proceduralMem}` : ''}`;
  }

  private buildRevisionPrompt(
    originalPlan: Plan,
    failedStep: number,
    error: string,
  ): string {
    return `The previous plan failed at step ${failedStep + 1}.

## Original Plan
${JSON.stringify(originalPlan, null, 2)}

## Error at Step ${failedStep + 1}
${error}

## Instructions
Create a revised plan that works around this failure. You may:
- Retry the failed step with different parameters.
- Skip the failed step if an alternative approach exists.
- Add new preparatory steps before the failed step.

Return ONLY the revised JSON plan in the same schema as before.`;
  }

  /**
   * Calls the Rust-side streaming LLM endpoint and collects the
   * full response text.
   */
  private async callLlm(
    messages: LlmMessage[],
    systemPrompt: string,
  ): Promise<string> {
    let fullResponse = '';

    // Create a streaming channel that accumulates tokens.
    const channel = new Channel<string>();
    channel.onmessage = (token: string) => {
      fullResponse += token;
    };

    // invoke is typed loosely for IPC — we await its completion.
    await invoke('stream_llm_response', {
      messages,
      systemPrompt,
      channel,
    });

    return fullResponse;
  }

  /**
   * Parse a Plan JSON from the LLM response.
   * Handles both raw JSON and markdown-fenced JSON (```json ... ```).
   */
  private parsePlanFromResponse(response: string): Plan {
    const trimmed = response.trim();

    // Try to extract JSON from markdown code fences first.
    const fencedMatch = trimmed.match(
      /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/,
    );
    const jsonStr = fencedMatch ? fencedMatch[1].trim() : trimmed;

    try {
      const parsed: unknown = JSON.parse(jsonStr);
      return this.validatePlan(parsed);
    } catch {
      // If parsing fails entirely, return a zero-step plan with the
      // raw response as the summary (the LLM chose to respond directly).
      return {
        steps: [],
        summary: trimmed,
      };
    }
  }

  /**
   * Validate and coerce a parsed JSON value into a well-typed Plan.
   */
  private validatePlan(raw: unknown): Plan {
    if (
      typeof raw !== 'object' ||
      raw === null ||
      !('steps' in raw) ||
      !Array.isArray((raw as Record<string, unknown>)['steps'])
    ) {
      throw new Error('Invalid plan structure: missing steps array');
    }

    const obj = raw as Record<string, unknown>;
    const rawSteps = obj['steps'] as Array<Record<string, unknown>>;

    const steps = rawSteps.map((step) => ({
      tool: String(step['tool'] ?? ''),
      params: (step['params'] as Record<string, string>) ?? {},
      reasoning: String(step['reasoning'] ?? ''),
    }));

    return {
      steps,
      summary: String(obj['summary'] ?? ''),
    };
  }
}

/** Global singleton planner instance. */
export const planner = new Planner();
