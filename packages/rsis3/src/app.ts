/**
 * RSIS Application — CLI commands and subsystem orchestration.
 * Deep port of Python main.py — all 7 commands with full logic.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG } from './config.js';
import { CheckpointManager } from './checkpoint.js';
import { EvaluatorClient } from './evaluator.js';
import { TelemetryCollector, WorkspaceMonitor } from './telemetry.js';
import { MemoryManager } from './memory.js';
import { RecoveryManager, FailureInjector } from './recovery.js';
import { ResourceEnforcer, ResourceSeverity } from './resource-monitor.js';
import { L2ImprovementLoop } from './loop-l2.js';
import { L3EvolutionLoop } from './loop-l3.js';
import { Budget, withDeadline } from './timeout.js';

export interface CommandResult {
  code: number;
  output: string[];
}

export class RSISApp {
  private version: string = '0.1.0';

  // ── Initialisation ──────────────────────────────────────────

  private initSubsystems(): {
    telemetry: TelemetryCollector;
    checkpoint: CheckpointManager;
    memory: MemoryManager;
    evaluator: EvaluatorClient;
    recovery: RecoveryManager;
    enforcer: ResourceEnforcer;
  } {
    const telemetry = new TelemetryCollector(CONFIG.telemetryDir, CONFIG.telemetryFlushIntervalMs);
    const checkpoint = new CheckpointManager(CONFIG.workspaceDir);
    const memory = new MemoryManager(CONFIG.workspaceDir);
    const evaluator = new EvaluatorClient();
    const recovery = new RecoveryManager(checkpoint);
    const enforcer = new ResourceEnforcer();
    return { telemetry, checkpoint, memory, evaluator, recovery, enforcer };
  }

  // ── Command: init ───────────────────────────────────────────

  async cmdInit(): Promise<CommandResult> {
    const output: string[] = [];
    output.push(`RSIS v${this.version} — Initialising workspace...`);
    output.push(`  Workspace: ${CONFIG.workspaceDir}`);

    // Create required directories
    for (const dir of ['.rsis', '.rsis/telemetry', '.rsis/vectors']) {
      const fullDir = path.join(CONFIG.workspaceDir, dir);
      fs.mkdirSync(fullDir, { recursive: true });
      output.push(`  Created: ${dir}/`);
    }

    const checkpoint = new CheckpointManager(CONFIG.workspaceDir);
    checkpoint.ensureRepo();

    const ch = checkpoint.checkpoint('rsis-initialised');
    output.push(`  Initial checkpoint: ${ch ? ch.slice(0, 12) : 'none'}`);

    const evalPath = path.resolve(CONFIG.evaluator.evaluatorPath);
    if (fs.existsSync(evalPath)) {
      output.push(`  Evaluator: ${evalPath}`);
    } else {
      output.push(`  WARNING: Evaluator not found at ${evalPath}`);
    }

    output.push('  RSIS workspace ready.');
    return { code: 0, output };
  }

  // ── Command: run ────────────────────────────────────────────

  async cmdRun(goal?: string): Promise<CommandResult> {
    const output: string[] = [];
    const { telemetry, checkpoint, memory, evaluator, recovery, enforcer } = this.initSubsystems();

    enforcer.setCallbacks(
      (msg) => { output.push(`  ⚠ HALT: ${msg}`); },
      (msg) => { output.push(`  ⚠ Throttle: ${msg}`); },
    );
    enforcer.start();
    telemetry.start();

    try {
      // Check resources before starting
      const limitMsg = enforcer.checkBeforeOperation();
      if (limitMsg) {
        output.push(`  ⚠ Resource limit: ${limitMsg}`);
        return { code: 1, output };
      }

      const l2 = new L2ImprovementLoop(telemetry, evaluator, checkpoint, recovery);
      const g = goal || 'self-improve the codebase';
      const budget = new Budget(
        CONFIG.l2.maxImprovementAttempts,
        CONFIG.l2.sessionTimeoutMs,
        'L2 session',
      );

      const result = await withDeadline(
        l2.runSession(g, budget),
        CONFIG.l2.sessionTimeoutMs,
        'L2 session',
      );

      if (enforcer.haltRequested) {
        output.push('  ⚠ Session halted by resource enforcer');
        return { code: 1, output };
      }

      if (result.applied) {
        memory.recordImprovement({
          description: result.applied.description,
          targetFiles: result.applied.targetFiles,
          evalScores: result.evalResults.flatMap(r => r.scores),
          outcome: 'applied',
          goal: g,
        });
        output.push(`  ✓ Improvement applied after ${result.attempts} attempt(s)`);
      } else {
        output.push(`  ✗ No improvement applied after ${result.attempts} attempt(s)`);
      }

      const l1Calls = result.evalResults.length * 3;
      output.push(`  L1 tool calls: ~${l1Calls}`);
      output.push(`  Session: ${telemetry.getSessionId()}`);
      output.push(`  Checkpoints: ${checkpoint.latestCheckpoint()?.slice(0, 12) || 'none'}`);

      return { code: 0, output };
    } finally {
      enforcer.stop();
      telemetry.stop();
    }
  }

  // ── Command: evolve ─────────────────────────────────────────

  async cmdEvolve(): Promise<CommandResult> {
    const output: string[] = [];
    const { telemetry, checkpoint, memory, evaluator, recovery, enforcer } = this.initSubsystems();

    enforcer.start();
    telemetry.start();

    try {
      const l3 = new L3EvolutionLoop(telemetry, evaluator, checkpoint, memory, recovery);

      const budget = new Budget(
        CONFIG.l3.plateauSessions,
        CONFIG.l3.plateauTimeoutMs,
        'L3 evolution',
      );

      const result = await withDeadline(
        l3.evolve('Improve the overall codebase quality and architecture', budget),
        CONFIG.l3.plateauTimeoutMs,
        'L3 evolution',
      );

      output.push(`\nL3 Evolution Results:`);
      output.push(`  Generations: ${result.generations}`);
      output.push(`  Best score: ${result.bestScore.toFixed(3)}`);
      output.push(`  Evolved: ${result.evolved}`);

      // Show generation history
      if (result.generationsList.length > 0) {
        output.push(`\n  Generation history:`);
        for (const gen of result.generationsList) {
          const status = gen.l2Result.applied ? '✓' : '✗';
          output.push(`    #${gen.number} ${status} score=${gen.score.toFixed(3)} — ${gen.goal.slice(0, 60)}`);
        }
      }

      return { code: 0, output };
    } finally {
      enforcer.stop();
      telemetry.stop();
    }
  }

  // ── Command: status ─────────────────────────────────────────

  cmdStatus(): CommandResult {
    const output: string[] = [];
    output.push(`RSIS v${this.version} — Status`);
    output.push(`  Workspace: ${CONFIG.workspaceDir}`);

    const checkpoint = new CheckpointManager(CONFIG.workspaceDir);
    const latestCh = checkpoint.latestCheckpoint();
    output.push(`  Latest checkpoint: ${latestCh ? latestCh.slice(0, 12) : 'none'}`);
    output.push(`  Uncommitted changes: ${checkpoint.hasChanges() ? 'yes' : 'no'}`);

    // Check .rsis directory
    const rsisDir = path.join(CONFIG.workspaceDir, '.rsis');
    if (fs.existsSync(rsisDir)) {
      const entries = fs.readdirSync(rsisDir);
      output.push(`  .rsis entries: ${entries.length}`);

      // Count telemetry files
      const telemDir = path.join(rsisDir, 'telemetry');
      if (fs.existsSync(telemDir)) {
        const telemFiles = fs.readdirSync(telemDir).filter(f => f.endsWith('.json'));
        output.push(`  Telemetry files: ${telemFiles.length}`);
      }

      // Check generations
      const genDir = path.join(rsisDir, 'generations');
      if (fs.existsSync(genDir)) {
        const genFiles = fs.readdirSync(genDir);
        output.push(`  Generations: ${genFiles.length}`);
      }
    } else {
      output.push('  .rsis: not initialised');
    }

    // Resource status
    const monitor = new WorkspaceMonitor();
    const cpu = monitor.cpuUsage();
    if (cpu !== null) output.push(`  CPU: ${cpu.toFixed(0)}%`);
    const mem = monitor.memoryUsageMb();
    if (mem !== null) output.push(`  Memory: ${mem.toFixed(0)} MB RSS`);

    // Knowledge graph status
    const kgPath = path.join(CONFIG.workspaceDir, CONFIG.memory.knowledgeGraphPath);
    if (fs.existsSync(kgPath)) {
      try {
        const kg = JSON.parse(fs.readFileSync(kgPath, 'utf-8'));
        output.push(`  Knowledge graph: ${kg.nodes?.length || 0} nodes, ${kg.edges?.length || 0} edges`);
      } catch {
        output.push('  Knowledge graph: corrupted');
      }
    }

    return { code: 0, output };
  }

  // ── Command: check ──────────────────────────────────────────

  cmdCheck(): CommandResult {
    const output: string[] = [];
    output.push('RSIS — Resource Check');

    const enforcer = new ResourceEnforcer();
    const warning = enforcer.checkBeforeOperation();

    if (warning) {
      output.push(`  ⚠ ${warning}`);
    } else {
      output.push('  ✓ Resources OK');
    }

    const memUsage = process.memoryUsage();
    output.push(`  Memory RSS: ${(memUsage.rss / (1024 * 1024)).toFixed(0)} MB`);
    output.push(`  Memory limit: ${CONFIG.resources.maxMemoryRssMb} MB`);
    output.push(`  Max CPU cores: ${CONFIG.resources.maxCpuCores}`);
    output.push(`  Evaluator API calls/min: ${CONFIG.resources.evaluatorApiCallsPerMin}`);

    if (warning) {
      return { code: 2, output };
    }
    return { code: 0, output };
  }

  // ── Command: recovery-test ──────────────────────────────────

  async cmdRecoveryTest(): Promise<CommandResult> {
    const output: string[] = [];
    const checkpoint = new CheckpointManager(CONFIG.workspaceDir);
    const recovery = new RecoveryManager(checkpoint);

    output.push('RSIS — Recovery System Test');
    output.push('');

    const results = await recovery.runAllTests();

    output.push('  Test Results:');
    for (const r of results) {
      const status = r.passed ? '✓' : '✗';
      output.push(`    ${status} ${r.test}: ${r.detail}`);
    }

    // Summary
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    output.push('');
    output.push(`  Results: ${passed}/${total} tests passed`);
    if (passed === total) {
      output.push('  ✓ All recovery mechanisms operational.');
    } else {
      output.push(`  ⚠ ${total - passed} test(s) failed.`);
    }

    return { code: passed === total ? 0 : 1, output };
  }

  // ── Command: dashboard ──────────────────────────────────────

  async cmdDashboard(host: string = '127.0.0.1', port: number = 8080): Promise<CommandResult> {
    const output: string[] = [];
    output.push(`RSIS Dashboard starting at http://${host}:${port}`);
    output.push('  (Dashboard requires the dashboard package to be built)');
    output.push('  For the full dashboard, run: cd packages/dashboard && npm run dev');
    return { code: 0, output };
  }

  // ── Main dispatch ───────────────────────────────────────────

  async run(argv: string[]): Promise<CommandResult> {
    const args = argv.slice(2); // Skip node and script path
    const command = args[0];

    if (!command || command === 'help' || command === '--help') {
      return this.cmdHelp();
    }

    switch (command) {
      case 'init':
        return await this.cmdInit();
      case 'run': {
        const goalIdx = args.indexOf('--goal') !== -1 ? args.indexOf('--goal') + 1 :
                        args.indexOf('-g') !== -1 ? args.indexOf('-g') + 1 : -1;
        const goal = goalIdx !== -1 ? args[goalIdx] : undefined;
        return await this.cmdRun(goal);
      }
      case 'evolve':
        return await this.cmdEvolve();
      case 'status':
        return this.cmdStatus();
      case 'check':
        return this.cmdCheck();
      case 'recovery-test':
        return await this.cmdRecoveryTest();
      case 'dashboard': {
        const hostIdx = args.indexOf('--host');
        const host = hostIdx !== -1 ? args[hostIdx + 1] : '127.0.0.1';
        const portIdx = args.indexOf('--port') !== -1 ? args.indexOf('--port') + 1 :
                        args.indexOf('-p') !== -1 ? args.indexOf('-p') + 1 : -1;
        const port = portIdx !== -1 ? parseInt(args[portIdx]) : 8080;
        return await this.cmdDashboard(host, port);
      }
      case '--version':
      case 'version':
        return { code: 0, output: [`RSIS v${this.version}`] };
      default:
        return { code: 1, output: [`Unknown command: ${command}`, '', ...this.helpText()] };
    }
  }

  cmdHelp(): CommandResult {
    return { code: 0, output: this.helpText() };
  }

  private helpText(): string[] {
    return [
      `RSIS v${this.version} — Recursive Self-Improvement System`,
      '',
      'Usage: rsis <command> [options]',
      '',
      'Commands:',
      '  init              Initialise workspace',
      '  run --goal X      Run improvement session',
      '  evolve            Run L3 evolution cycle',
      '  dashboard         Start web dashboard',
      '  status            System overview',
      '  check             Check resource limits',
      '  recovery-test     Test recovery mechanisms',
      '',
      'Options:',
      '  --version         Show version',
      '  --help            Show this help',
    ];
  }
}
