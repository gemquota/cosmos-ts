/**
 * L1 — Per-Task Action Loop.
 * Deep port of Python loop_l1.py — plan → tool calls → observe → retry/adapt.
 */

import { CONFIG } from './config.js';
import { TelemetryCollector } from './telemetry.js';
import { CheckpointManager } from './checkpoint.js';
import { Budget, withDeadline } from './timeout.js';

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  durationMs: number;
}

export interface L1Result {
  success: boolean;
  stepsTaken: number;
  toolCalls: ToolCall[];
  error?: string;
  finalOutput?: unknown;
}

export class L1ActionLoop {
  private config = CONFIG.l1;
  private telemetry: TelemetryCollector;
  private checkpoint: CheckpointManager;
  private tools: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;
  private taskDescription: string = '';

  constructor(
    telemetry: TelemetryCollector,
    checkpointMgr?: CheckpointManager,
    tools?: Map<string, (args: Record<string, unknown>) => Promise<unknown>>,
  ) {
    this.telemetry = telemetry;
    this.checkpoint = checkpointMgr || new CheckpointManager(CONFIG.workspaceDir);
    this.tools = tools || new Map();
  }

  /** Register a tool that the loop can call */
  registerTool(name: string, handler: (args: Record<string, unknown>) => Promise<unknown>): void {
    this.tools.set(name, handler);
  }

  async execute(task: string, context?: Record<string, unknown>): Promise<L1Result> {
    this.taskDescription = task;
    context = context || {};
    const toolCalls: ToolCall[] = [];
    let steps = 0;

    console.log(`L1 executing task: ${task.slice(0, 80)}`);

    this.telemetry.record({
      eventType: 'l1_start',
      metadata: { task },
      timestamp: new Date().toISOString(),
    });

    for (let stepIdx = 0; stepIdx < this.config.maxToolCallsPerStep; stepIdx++) {
      steps = stepIdx + 1;
      console.debug(`L1 step ${stepIdx + 1}/${this.config.maxToolCallsPerStep}`);

      // Determine next action (planning phase)
      const [toolName, toolArgs] = this.planNextAction(task, context, toolCalls);
      
      if (!toolName) {
        // No more tools to call — task is done
        break;
      }

      // Checkpoint before destructive operations
      const destructiveOps = ['write_file', 'edit_file', 'delete_file', 'modify', 'patch'];
      if (destructiveOps.includes(toolName) && CONFIG.checkpointBeforeMutation) {
        this.checkpoint.checkpoint(`pre-${toolName}`);
      }

      // Execute tool call
      const toolCall = await this.executeToolCall(toolName, toolArgs, stepIdx);
      toolCalls.push(toolCall);

      if (toolCall.error) {
        console.error(`L1 tool error at step ${stepIdx + 1}: ${toolCall.error}`);
        
        if (stepIdx >= this.config.maxRetries) {
          return {
            success: false,
            stepsTaken: steps,
            toolCalls,
            error: `Max retries (${this.config.maxRetries}) exceeded. Last error: ${toolCall.error}`,
          };
        }
        // Continue to retry
        continue;
      }
    }

    const result: L1Result = {
      success: true,
      stepsTaken: steps,
      toolCalls,
      finalOutput: toolCalls.length > 0 ? toolCalls[toolCalls.length - 1].result : undefined,
    };

    this.telemetry.record({
      eventType: 'l1_complete',
      metadata: {
        task,
        steps,
        toolCalls: toolCalls.length,
        success: result.success,
      },
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /** Plan the next tool call based on task and previous results */
  private planNextAction(
    task: string,
    context: Record<string, unknown>,
    previousCalls: ToolCall[],
  ): [string | null, Record<string, unknown>] {
    // Built-in planning logic matching Python's _plan_next_action
    // In production, this would use an LLM to decide next action
    
    if (previousCalls.length === 0) {
      // First step: read the task context
      return ['read_context', { task, ...context }];
    }

    const lastCall = previousCalls[previousCalls.length - 1];
    
    if (lastCall.error) {
      // Retry with error context
      return ['retry', { task, error: lastCall.error, previousResult: lastCall.result }];
    }

    // Check if we need to write changes
    if (task.includes('write') || task.includes('create') || task.includes('modify')) {
      return ['write_file', { task, content: context.content || '' }];
    }

    return [null, {}];
  }

  /** Execute a single tool call with timeout */
  private async executeToolCall(
    name: string,
    args: Record<string, unknown>,
    stepIdx: number,
  ): Promise<ToolCall> {
    const start = Date.now();

    // Log the tool call
    console.log(`  L1 tool: ${name}(${JSON.stringify(args).slice(0, 100)})`);

    this.telemetry.record({
      eventType: 'l1_tool_call',
      metadata: { tool: name, args, step: stepIdx },
      timestamp: new Date().toISOString(),
    });

    const handler = this.tools.get(name);
    if (!handler) {
      // Built-in tool handling
      try {
        const result = await this.builtInTool(name, args);
        return {
          name,
          arguments: args,
          result,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          name,
          arguments: args,
          error: String(err),
          durationMs: Date.now() - start,
        };
      }
    }

    try {
      const result = await withDeadline(
        handler(args),
        this.config.stepTimeoutMs,
        `L1 tool: ${name}`,
      );
      return {
        name,
        arguments: args,
        result,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        name,
        arguments: args,
        error: String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  /** Built-in tools when no external handler is registered */
  private async builtInTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'read_context':
        return { context_received: true, task: args.task };
      case 'retry':
        return { retried: true, error: args.error };
      case 'write_file':
        return { written: true, task: args.task };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
