/**
 * L3 — Cross-Session Evolution Loop.
 * Deep port of Python loop_l3.py — generation tracking, plateau detection, evolution orchestration.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG } from './config.js';
import { TelemetryCollector } from './telemetry.js';
import { EvaluatorClient } from './evaluator.js';
import { CheckpointManager } from './checkpoint.js';
import { MemoryManager } from './memory.js';
import { RecoveryManager } from './recovery.js';
import { L2ImprovementLoop, L2Result } from './loop-l2.js';
import { Budget, sleep } from './timeout.js';

export interface Generation {
  number: number;
  timestamp: string;
  goal: string;
  l2Result: L2Result;
  score: number;
}

export interface L3Result {
  evolved: boolean;
  generations: number;
  bestScore: number;
  generationsList: Generation[];
}

export class L3EvolutionLoop {
  private config = CONFIG.l3;
  private telemetry: TelemetryCollector;
  private evaluator: EvaluatorClient;
  private checkpointMgr: CheckpointManager;
  private memory: MemoryManager;
  private recovery: RecoveryManager;
  private generations: Generation[] = [];
  private generationDir: string;

  constructor(
    telemetry: TelemetryCollector,
    evaluator: EvaluatorClient,
    checkpointMgr: CheckpointManager,
    memory: MemoryManager,
    recovery: RecoveryManager,
  ) {
    this.telemetry = telemetry;
    this.evaluator = evaluator;
    this.checkpointMgr = checkpointMgr;
    this.memory = memory;
    this.recovery = recovery;
    this.generationDir = path.join(CONFIG.workspaceDir, '.rsis', 'generations');
    this._loadGenerations();
  }

  private _loadGenerations(): void {
    try {
      if (fs.existsSync(this.generationDir)) {
        const files = fs.readdirSync(this.generationDir)
          .filter(f => f.endsWith('.json'))
          .sort();
        for (const file of files) {
          const data = JSON.parse(fs.readFileSync(path.join(this.generationDir, file), 'utf-8'));
          this.generations.push(data);
        }
      }
    } catch {
      this.generations = [];
    }
  }

  private _saveGeneration(gen: Generation): void {
    try {
      fs.mkdirSync(this.generationDir, { recursive: true });
      fs.writeFileSync(
        path.join(this.generationDir, `gen-${String(gen.number).padStart(4, '0')}.json`),
        JSON.stringify(gen, null, 2),
      );
    } catch (err) {
      console.error('Failed to save generation:', err);
    }
  }

  /** Run a full evolution cycle */
  async evolve(
    rootGoal: string = 'Improve the overall codebase quality and architecture',
    budget?: Budget,
  ): Promise<L3Result> {
    const b = budget || new Budget(
      CONFIG.l3.plateauSessions,
      CONFIG.l3.plateauTimeoutMs,
      'L3 evolution',
    );

    console.log(`L3 evolution starting — goal: ${rootGoal.slice(0, 80)}`);
    console.log(`  Max generations: ${b.maxIterations}, timeout: ${b.maxTimeMs}ms`);

    this.telemetry.record({
      eventType: 'l3_evolution_start',
      metadata: {
        rootGoal,
        maxGenerations: b.maxIterations,
        existingGenerations: this.generations.length,
      },
      timestamp: new Date().toISOString(),
    });

    let plateauCount = 0;
    const PLATEAU_THRESHOLD = 3; // Number of generations with no improvement before plateau
    let bestScore = this.generations.length > 0
      ? Math.max(...this.generations.map(g => g.score))
      : 0;

    while (b.tick()) {
      const genNumber = this.generations.length + 1;
      console.log(`\nL3 Generation ${genNumber}`);

      // Checkpoint at generation boundary
      this.checkpointMgr.checkpoint(`pre-l3-generation-${genNumber}`);

      // Generate goal for this generation
      const goal = this._deriveGoal(rootGoal, genNumber);

      // Run L2 improvement session
      console.log(`  Goal: ${goal.slice(0, 80)}`);

      const l2Loop = new L2ImprovementLoop(
        this.telemetry, this.evaluator, this.checkpointMgr, this.recovery,
      );

      const l2Budget = new Budget(
        CONFIG.l2.maxImprovementAttempts,
        CONFIG.l2.sessionTimeoutMs,
        `L2 generation ${genNumber}`,
      );

      const l2Result = await l2Loop.runSession(goal, l2Budget);

      // Calculate generation score
      const score = this._calculateScore(l2Result, genNumber);
      bestScore = Math.max(bestScore, score);

      const gen: Generation = {
        number: genNumber,
        timestamp: new Date().toISOString(),
        goal,
        l2Result,
        score,
      };

      this.generations.push(gen);
      this._saveGeneration(gen);

      // Record in memory
      this.memory.recordImprovement({
        description: `L3 Generation ${genNumber}: ${goal.slice(0, 60)}`,
        targetFiles: l2Result.applied?.targetFiles || [],
        evalScores: l2Result.evalResults.flatMap(r => r.scores),
        outcome: l2Result.applied ? 'applied' : 'failed',
        goal,
      });

      // Track knowledge graph
      this.memory.knowledgeGraph.addNode(
        `gen-${genNumber}`,
        `Generation ${genNumber}: ${goal.slice(0, 60)}`,
        'generation',
        { score, applied: !!l2Result.applied },
      );
      if (genNumber > 1) {
        this.memory.knowledgeGraph.addEdge(
          `gen-${genNumber - 1}`,
          `gen-${genNumber}`,
          'evolves_to',
          score,
        );
      }

      this.telemetry.record({
        eventType: 'l3_generation_complete',
        metadata: {
          generation: genNumber,
          score,
          applied: !!l2Result.applied,
          attempts: l2Result.attempts,
        },
        timestamp: new Date().toISOString(),
      });

      // Plateau detection
      if (this._isPlateaued(genNumber)) {
        plateauCount++;
        console.log(`  Plateau signal: ${plateauCount}/${PLATEAU_THRESHOLD}`);
        if (plateauCount >= PLATEAU_THRESHOLD) {
          console.log(`L3: Plateau detected after ${genNumber} generations (best: ${bestScore})`);
          break;
        }
      } else {
        plateauCount = 0;
      }

      // Brief pause between generations
      await sleep(500);
    }

    const result: L3Result = {
      evolved: this.generations.length > 0,
      generations: this.generations.length,
      bestScore,
      generationsList: this.generations,
    };

    console.log(`\nL3 evolution complete`);
    console.log(`  Generations: ${result.generations}`);
    console.log(`  Best score: ${result.bestScore.toFixed(3)}`);
    console.log(`  Evolved: ${result.evolved}`);

    this.telemetry.record({
      eventType: 'l3_evolution_complete',
      metadata: result as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /** Derive a generation-specific goal from the root goal */
  private _deriveGoal(rootGoal: string, generation: number): string {
    const focusAreas = [
      'code quality and readability',
      'performance optimization',
      'error handling and edge cases',
      'test coverage',
      'documentation and comments',
      'architecture and modularity',
      'security hardening',
      'dependency management',
    ];

    const focus = focusAreas[(generation - 1) % focusAreas.length];
    return `${rootGoal} — focus on ${focus}`;
  }

  /** Calculate a score for a generation */
  private _calculateScore(l2Result: L2Result, generation: number): number {
    let score = 0.5; // Base score

    if (l2Result.applied) score += 0.3;
    if (l2Result.evalResults.length > 0) {
      const lastEval = l2Result.evalResults[l2Result.evalResults.length - 1];
      if (lastEval.scores.length > 0) {
        const avgScore = lastEval.scores.reduce((a, s) => a + s.score * s.weight, 0) /
          lastEval.scores.reduce((a, s) => a + s.weight, 0);
        score = avgScore * 0.7 + score * 0.3;
      }
    }

    // Bonus for consistent improvement
    score += Math.min(generation * 0.01, 0.1);

    return Math.min(Math.max(score, 0), 1);
  }

  /** Detect if we've plateaued (no significant improvement) */
  private _isPlateaued(currentGen: number): boolean {
    const window = Math.min(5, this.generations.length);
    if (window < 3) return false;

    const recent = this.generations.slice(-window);
    const scores = recent.map(g => g.score);
    const avg = scores.reduce((a, s) => a + s, 0) / scores.length;
    const variance = scores.reduce((a, s) => a + (s - avg) ** 2, 0) / scores.length;

    // Plateau if variance is very low
    return variance < 0.001;
  }

  /** Get full generation history */
  getGenerations(): Generation[] {
    return [...this.generations];
  }

  /** Get the best generation */
  getBestGeneration(): Generation | null {
    if (this.generations.length === 0) return null;
    return this.generations.reduce((best, g) => g.score > best.score ? g : best);
  }
}
