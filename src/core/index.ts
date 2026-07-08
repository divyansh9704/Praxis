import { invoke } from '@tauri-apps/api/core';
import { planner } from './planner';
import { executor, ExecutorCallback } from './executor';
import { registerAllTools } from './tools';
import { LlmMessage, Message, Preference, TrustTier } from './types';

export { planner } from './planner';
export { executor } from './executor';
export type { ExecutorEvent, ExecutorCallback, ExecutorEventType } from './executor';
export { toolRegistry } from './toolRegistry';
export * from './types';

let initialized = false;

/** Initialize the orchestration core. Call once on app startup. */
export async function initCore(): Promise<void> {
  if (initialized) return;
  registerAllTools();
  initialized = true;
}

/**
 * Main orchestration function: takes a user message, generates a plan,
 * executes it, and returns the results.
 * 
 * This is the primary entry point for the command bar.
 */
export async function handleUserMessage(
  conversationId: string,
  userMessage: string,
  trustTier: TrustTier,
  onEvent: ExecutorCallback
): Promise<string> {
  // Set the executor's trust tier
  executor.setTrustTier(trustTier);

  // Save user message to DB
  await invoke('add_message', {
    conversationId,
    role: 'user',
    content: userMessage
  });

  // Load conversation history
  const messages = await invoke<Message[]>('get_messages', { conversationId });
  const conversationHistory: LlmMessage[] = messages.map(m => ({
    role: m.role,
    content: m.content
  }));

  // Load procedural memory
  let proceduralMemory: Preference[] = [];
  try {
    proceduralMemory = await invoke<Preference[]>('get_preferences', { memoryType: 'procedural' });
  } catch {
    // Non-critical, continue without memory
  }

  const plan = await planner.generatePlan(
    conversationHistory,
    proceduralMemory.map(p => p.value).join('\n')
  );

  // If no tool steps, this is a conversational response
  if (plan.steps.length === 0) {
    // Save assistant response
    await invoke('add_message', {
      conversationId,
      role: 'assistant',
      content: plan.summary
    });
    onEvent({ type: 'complete', message: plan.summary });
    return plan.summary;
  }

  // Execute plan
  const results = await executor.executePlan(
    plan,
    conversationId,
    userMessage,
    conversationHistory,
    onEvent
  );

  // Build summary of results
  const resultSummary = results
    .map((r, i) => `Step ${i + 1} (${plan.steps[i]?.tool}): ${r.success ? r.data : `FAILED: ${r.error}`}`)
    .join('\n');

  // Save assistant response
  await invoke('add_message', {
    conversationId,
    role: 'assistant',
    content: resultSummary
  });

  return resultSummary;
}
