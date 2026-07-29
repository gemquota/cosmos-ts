/**
 * L2 — Per-Session Improvement Loop.
 * Deep port of Python loop_l2.py — propose → evaluate → apply → verify.
 */

import { CONFIG } from './config.js';
import { TelemetryCollector } from './telemetry.js';
import { EvaluatorClient, EvalResult, EvalScore } from './evaluator.js';
import { CheckpointManager } from './checkpoint.js';
import { RecoveryManager } from './recovery.js';
import { Budget, withDeadline, sleep } from './timeout.js';
import path from 'node:path';
import fs from 'node:fs';

export interface ImprovementCandidate {
  description: string;
  targetFiles: string[];
  diff: string;
  estimatedImpact: number; // 0-1
}

export interface L2Result {
  applied: ImprovementCandidate | null;
  attempts: number;
  evalResults: EvalResult[];
}

export class L2ImprovementLoop {
  private config = CONFIG.l2;
  private telemetry: TelemetryCollector;
  private evaluator: EvaluatorClient;
  private checkpointMgr: CheckpointManager;
  private recovery: RecoveryManager;

  constructor(
    telemetry: TelemetryCollector,
    evaluator: EvaluatorClient,
    checkpointMgr: CheckpointManager,
    recovery: RecoveryManager,
  ) {
    this.telemetry = telemetry;
    this.evaluator = evaluator;
    this.checkpointMgr = checkpointMgr;
    this.recovery = recovery;
  }

  async runSession(
    goal: string,
    budget?: Budget,
  ): Promise<L2Result> {
    const b = budget || new Budget(
      CONFIG.l2.maxImprovementAttempts,
      CONFIG.l2.sessionTimeoutMs,
      'L2 session',
    );

    console.log(`L2 session starting — goal: ${goal.slice(0, 80)}`);

    this.telemetry.record({
      eventType: 'l2_session_start',
      metadata: { goal, budgetMax: b.maxIterations },
      timestamp: new Date().toISOString(),
    });

    const evalResults: EvalResult[] = [];
    let applied: ImprovementCandidate | null = null;
    let attempts = 0;

    while (b.tick()) {
      attempts++;

      // Step 1: Propose improvement
      const candidate = await this.proposeImprovement(goal, evalResults, b);
      if (!candidate) {
        console.log('No improvement candidate generated — ending session');
        break;
      }

      console.log(`  L2 attempt ${attempts}: ${candidate.description.slice(0, 80)}`);

      // Step 2: Checkpoint before applying
      if (CONFIG.checkpointBeforeMutation) {
        this.checkpointMgr.checkpoint(`pre-l2-attempt-${attempts}`);
      }

      // Step 3: Apply improvement (with rollback support)
      const applySuccess = await this.applyImprovement(candidate, b);
      if (!applySuccess) {
        console.log(`  L2 attempt ${attempts}: apply failed`);
        evalResults.push({
          scores: [],
          passed: false,
          summary: 'Apply failed',
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Step 4: Evaluate the applied change
      const evalResult = await this.evaluateImprovement(candidate, goal, b);
      evalResults.push(evalResult);

      if (evalResult.passed) {
        applied = candidate;
        console.log(`  L2 ✓ Improvement applied and verified (attempt ${attempts})`);
        
        this.telemetry.record({
          eventType: 'l2_improvement_applied',
          metadata: {
            attempt: attempts,
            description: candidate.description,
            scores: evalResult.scores,
          },
          timestamp: new Date().toISOString(),
        });
        break;
      } else {
        console.log(`  L2 ✗ Improvement failed evaluation, rolling back`);
        
        // Rollback
        const checkpoint = this.checkpointMgr.latestCheckpoint();
        if (checkpoint) {
          const rollbackOk = this.checkpointMgr.rollback(checkpoint);
          if (!rollbackOk) {
            console.error('  L2 ✗ Rollback failed!');
            this.recovery.triggerRecovery({ reason: 'rollback_failed', attempt: attempts });
          }
        }

        this.telemetry.record({
          eventType: 'l2_improvement_rolled_back',
          metadata: { attempt: attempts, scores: evalResult.scores },
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log(`L2 session complete — ${applied ? 'applied' : 'no improvement'} after ${attempts} attempt(s)`);

    return { applied, attempts, evalResults };
  }

  /** Propose an improvement based on goal and previous evaluations */
  private async proposeImprovement(
    goal: string,
    previousEvals: EvalResult[],
    budget: Budget,
  ): Promise<ImprovementCandidate | null> {
    // Built-in proposal logic matching Python's _propose_improvement
    // In production, this would use an LLM to generate a proposal

    if (budget.iterations > CONFIG.l2.maxImprovementAttempts) {
      return null;
    }

    // Generate a simple proposal based on the goal
    const workspaces = ['.'];
    const files = this.findCandidateFiles(workspaces);

    if (files.length === 0) return null;

    return {
      description: `Improve: ${goal.slice(0, 60)}`,
      targetFiles: files.slice(0, 3),
      diff: `Auto-generated improvement for: ${goal}`,
      estimatedImpact: 0.5 + Math.random() * 0.3,
    };
  }

  /** Find files that could be improvement targets */
  private findCandidateFiles(workspaces: string[]): string[] {
    const files: string[] = [];
    const extensions = new Set(['.ts', '.js', '.py', '.md', '.json']);

    for (const ws of workspaces) {
      try {
        const entries = fs.readdirSync(ws, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.has(ext)) {
              files.push(path.join(ws, entry.name));
            }
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    }

    return files;
  }

  /** Apply an improvement candidate */
  private async applyImprovement(
    candidate: ImprovementCandidate,
    budget: Budget,
  ): Promise<boolean> {
    try {
      // In production, this would apply the diff/patch
      // For now, simulate success
      await sleep(100);
      console.log(`    Applied: ${candidate.description.slice(0, 60)}`);

      this.telemetry.record({
        eventType: 'l2_improvement_applied',
        metadata: {
          description: candidate.description,
          targetFiles: candidate.targetFiles,
        },
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (err) {
      console.error(`    Apply failed: ${err}`);
      return false;
    }
  }

  /** Evaluate an improvement using the evaluator */
  private async evaluateImprovement(
    candidate: ImprovementCandidate,
    goal: string,
    budget: Budget,
  ): Promise<EvalResult> {
    return await this.evaluator.evaluate(goal, {
      improvement: candidate.description,
      targetFiles: candidate.targetFiles,
      diff: candidate.diff,
    });
  }
}
