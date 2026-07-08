import { invoke } from '@tauri-apps/api/core';
import { Plan, PlanStep, ToolResult, TrustTier, Action, LlmMessage, RetryState } from './types';
import { toolRegistry } from './toolRegistry';
import { getUIVerdict } from './permission/trustTiers';
import { planner } from './planner';

export type ExecutorEventType = 
  | 'step_start'
  | 'step_complete'
  | 'step_failed'
  | 'confirmation_needed'
  | 'confirmation_resolved'
  | 'replanning'
  | 'error'
  | 'complete';

export interface ExecutorEvent {
  type: ExecutorEventType;
  step?: PlanStep;
  result?: ToolResult;
  action?: Action;
  error?: string;
  message?: string;
  reviewerConcern?: string;
}

export type ExecutorCallback = (event: ExecutorEvent) => void;

export class Executor {
  private currentTier: TrustTier = 'guarded';
  private pendingConfirmations: Map<string, { resolve: (approved: boolean) => void }> = new Map();

  setTrustTier(tier: TrustTier): void {
    this.currentTier = tier;
  }

  /**
   * Execute a plan with retry/replan logic (Section 3B).
   * 
   * Retry policy:
   * 1. Tool fails → automatic retry once
   * 2. Second failure → return to Planner for revised plan
   * 3. Third failure → surface error to user
   */
  async executePlan(
    plan: Plan,
    conversationId: string,
    userMessage: string,
    conversationHistory: LlmMessage[],
    onEvent: ExecutorCallback
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const step of plan.steps) {
      const retryState: RetryState = {
        attempt: 0,
        maxRetries: 3,
        lastError: '',
        revisedPlan: null
      };

      const result = await this.executeStepWithRetry(
        step, conversationId, userMessage, conversationHistory, plan, retryState, onEvent
      );
      results.push(result);

      // If a step failed after all retries, stop execution
      if (!result.success) {
        onEvent({
          type: 'error',
          step,
          error: `Failed after ${retryState.attempt} attempts: ${result.error}`
        });
        break;
      }
    }

    onEvent({ type: 'complete', message: 'Plan execution finished' });
    return results;
  }

  private async executeStepWithRetry(
    step: PlanStep,
    conversationId: string,
    userMessage: string,
    conversationHistory: LlmMessage[],
    originalPlan: Plan,
    retryState: RetryState,
    onEvent: ExecutorCallback
  ): Promise<ToolResult> {
    retryState.attempt++;
    onEvent({ type: 'step_start', step });

    // Check UI-side permission (display only — real enforcement is in Rust)
    const verdict = getUIVerdict(step.tool, this.currentTier);

    if (verdict === 'denied') {
      const result: ToolResult = {
        success: false,
        data: '',
        error: `Tool '${step.tool}' is in the Always-Deny list and cannot be executed.`
      };
      onEvent({ type: 'step_failed', step, result });
      return result;
    }

    // If confirmation needed, log action and wait for user approval
    if (verdict === 'requires_confirmation') {
      onEvent({ type: 'step_start', step, message: 'Running Security Reviewer...' });
      const review = await planner.reviewStep(step, userMessage);

      const actionId = await invoke<string>('log_action', {
        conversationId,
        toolName: step.tool,
        inputParams: JSON.stringify(step.params),
        trustTier: this.currentTier,
        status: 'pending',
        reasoning: step.reasoning
      }).catch((e) => { 
        console.error("Error logging pending action:", e); 
        throw e;
      });

      // Emit event so UI shows the confirmation card
      const action: Action = {
        id: actionId,
        conversation_id: conversationId,
        tool_name: step.tool,
        input_params_json: JSON.stringify(step.params),
        trust_tier: this.currentTier,
        status: 'pending',
        result_json: '',
        reasoning: step.reasoning,
        created_at: new Date().toISOString(),
        resolved_at: ''
      };
      
      onEvent({ 
        type: 'confirmation_needed', 
        step, 
        action,
        reviewerConcern: review.approved ? undefined : review.reason 
      });

      // Wait for user approval
      const approved = await this.waitForConfirmation(actionId);
      onEvent({ type: 'confirmation_resolved', step, action: { ...action, status: approved ? 'approved' : 'rejected' } });

      if (!approved) {
        return { success: false, data: '', error: 'Action denied by user' };
      }
    }

    // Execute the tool
    try {
      const result = await toolRegistry.execute(step.tool, step.params);
      if (result.success) {
        onEvent({ type: 'step_complete', step, result });
        // Log completed action
        await invoke('log_action', {
          conversationId,
          toolName: step.tool,
          inputParams: JSON.stringify(step.params),
          trustTier: this.currentTier,
          status: 'completed',
          reasoning: step.reasoning
        }).catch((e) => { console.error("Error logging completed action:", e); });
        return result;
      } else {
        throw new Error(result.error || 'Tool execution failed');
      }
    } catch (error) {
      const errorMsg = String(error);
      retryState.lastError = errorMsg;

      // Retry policy (Section 3B)
      if (retryState.attempt === 1) {
        // First failure → automatic retry
        onEvent({ type: 'step_failed', step, error: `Attempt 1 failed: ${errorMsg}. Retrying...` });
        return this.executeStepWithRetry(step, conversationId, userMessage, conversationHistory, originalPlan, retryState, onEvent);
      } else if (retryState.attempt === 2 && !retryState.revisedPlan) {
        // Second failure → ask Planner for revised plan
        onEvent({ type: 'replanning', step, error: `Attempt 2 failed: ${errorMsg}. Asking Planner for a revised approach...` });
        try {
          const stepIndex = originalPlan.steps.indexOf(step);
          const revisedPlan = await planner.revisePlan(originalPlan, stepIndex, errorMsg, conversationHistory);
          retryState.revisedPlan = revisedPlan;
          // Try to find a replacement step for the failed one
          const replacementStep = revisedPlan.steps.find(s => s.tool !== step.tool) || revisedPlan.steps[0];
          if (replacementStep) {
            return this.executeStepWithRetry(replacementStep, conversationId, userMessage, conversationHistory, revisedPlan, retryState, onEvent);
          }
        } catch {
          // Replanning failed too
        }
        // Fall through to final failure
        return { success: false, data: '', error: `I tried ${step.tool} and replanning, both failed because: ${errorMsg}` };
      } else {
        // Third failure → give up, surface to user
        onEvent({
          type: 'error',
          step,
          error: `I tried multiple approaches but failed. Last error: ${errorMsg}`
        });
        return {
          success: false,
          data: '',
          error: `Failed after ${retryState.attempt} attempts. Last error: ${errorMsg}. What would you like me to do?`
        };
      }
    }
  }

  /** Called by the UI when user approves/denies an action */
  resolveConfirmation(actionId: string, approved: boolean): void {
    const pending = this.pendingConfirmations.get(actionId);
    if (pending) {
      pending.resolve(approved);
      this.pendingConfirmations.delete(actionId);
    }
  }

  private waitForConfirmation(actionId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.pendingConfirmations.set(actionId, { resolve });
    });
  }
}

export const executor = new Executor();
