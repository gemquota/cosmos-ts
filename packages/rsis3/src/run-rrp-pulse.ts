/**
 * Pulse execution with full RRP v2 protocol including all telemetry dimensions.
 *
 * TypeScript port of rack/run_rrp_pulse.py.
 *
 * Records: AmbiguityVector, TokenBudget, QuestionQualityIndex,
 *          UserSatisfactionDelta, TemporalVelocity, TopicCoverage,
 *          TransactionLedger, Checkpoints, Decision log, contradictions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { runRRPSession, RRPEngine } from './rrp-engine.js';
import type { RRPSessionResult } from './rrp-engine.js';

// ── Types ──

export interface TelemetrySnapshot {
  timestamp: string;
  version: string;
  improvements: {
    total: number;
    successful: number;
    rate: number;
  };
  scores: Record<string, number>;
  scoresDetail: Record<string, { aggregate: number; metrics: Record<string, number> }>;
  kg: { nodes: number; edges: number; maxNodes: number };
  identity: {
    snapshots: number;
    anomalyScore: number;
    inCrisis: boolean;
    consecutiveFailures: number;
    cycleCount: number;
  };
  evaluatorMode: string;
}

export interface PulseResult {
  pulse: string;
  timestamp_start: string;
  timestamp_end: string;
  type: string;
  protocol: string;
  rrp_config: { u: number; m: number; x: number; y: number; z: number; depth: number };
  pre_state: TelemetrySnapshot;
  post_state: TelemetrySnapshot;
  signals: { total_stubs: number; goals_evaluated: number };
  goals: GoalResultData[];
  improvements: Array<Record<string, unknown>>;
  summary: PulseExecutionSummary;
  rrp_telemetry_aggregate: TelemetryAggregate;
}

export interface GoalResultData {
  description: string;
  file: string;
  function: string;
  type: string;
  rrp_evaluation: Record<string, unknown>;
  rrp_refinement: RRPSessionResult;
}

export interface PulseExecutionSummary {
  goals_generated: number;
  goals_approved: number;
  goals_held: number;
  goals_rejected: number;
  duration_seconds: number;
  eval_mode: string;
  total_questions: number;
  total_rounds: number;
  avg_ambiguity: number;
}

export interface TelemetryAggregate {
  total_questions: number;
  total_rounds: number;
  total_ledger_entries: number;
  total_checkpoints: number;
  avg_quality_index: number;
  avg_satisfaction: number;
  avg_budget_saturation: number;
  all_topics: string[];
}

// ── captureTelemetry ──

export function captureTelemetry(): TelemetrySnapshot {
  // Simplified port — in real system this queries SelfModel, KnowledgeGraph, etc.
  const now = new Date().toISOString();

  return {
    timestamp: now,
    version: '0.0.14',
    improvements: {
      total: 0,
      successful: 0,
      rate: 0,
    },
    scores: {},
    scoresDetail: {},
    kg: { nodes: 0, edges: 0, maxNodes: 10000 },
    identity: {
      snapshots: 0,
      anomalyScore: 0,
      inCrisis: false,
      consecutiveFailures: 0,
      cycleCount: 0,
    },
    evaluatorMode: 'rrp_v2_full',
  };
}

// ── Goal Info ──

export interface GoalInfo {
  description: string;
  files: string[];
}

// ── runPulse ──

export function runPulse(
  pulseNum: number,
  numGoals = 4,
  options: {
    x?: number;
    y?: number;
    z?: number;
    u?: number;
    m?: number;
    depth?: number;
    pulsesDir?: string;
    goalsInfo?: GoalInfo[];
  } = {},
): PulseResult {
  const {
    x = 3,
    y = 3,
    z = 3,
    u = 4,
    m = 1,
    depth = 2,
    pulsesDir = 'pulses',
    goalsInfo,
  } = options;

  const startTime = new Date();

  console.log('='.repeat(60));
  console.log(`  PULSE ${String(pulseNum).padStart(3, '0')} — RRP v2 Full Protocol`);
  console.log(`  Config: U=${u} M=${m} X=${x} Y=${y} Z=${z} Depth=${depth}`);
  console.log('='.repeat(60));
  console.log();

  // 1. Pre-state
  console.log('📊 Capturing pre-state...');
  const preState = captureTelemetry();

  // 2. Determine goals
  let goalsToEval: GoalInfo[];
  if (goalsInfo && goalsInfo.length > 0) {
    goalsToEval = goalsInfo;
  } else {
    console.log(`🔍 Using ${numGoals} default improvement goals...`);
    const targets: GoalInfo[] = [
      {
        description: 'Improve type safety across RSIS modules',
        files: ['rsis/codegen.ts'],
      },
      {
        description: 'Add error handling to rsis/checkpoint.ts',
        files: ['rsis/checkpoint.ts'],
      },
      {
        description: 'Refactor rsis/loop_l2.ts for better maintainability',
        files: ['rsis/loop_l2.ts'],
      },
      {
        description: 'Add logging to rsis/memory.ts operations',
        files: ['rsis/memory.ts'],
      },
    ];
    goalsToEval = targets.slice(0, numGoals);
  }

  // 3. Run RRP v2 sessions
  console.log();
  console.log(`🔬 RRP v2 Protocol (${goalsToEval.length} goals)...`);
  console.log(`   ${'─'.repeat(52)}`);
  console.log();

  const goalsData: GoalResultData[] = [];
  const improvementsData: Array<Record<string, unknown>> = [];

  for (let idx = 0; idx < goalsToEval.length; idx++) {
    const { description, files } = goalsToEval[idx];
    console.log(`   ┌─ Goal [${idx + 1}/${goalsToEval.length}]`);
    console.log(`   │ ${description.slice(0, 80)}`);

    // Run full RRP v2 session
    const result = runRRPSession({
      goalDescription: description,
      targetFiles: files,
      x,
      y,
      z,
      u,
      m,
      depth,
    });

    const tel = result as unknown as Record<string, unknown>;
    const rrpTelemetry = tel['rrp_telemetry'] as Record<string, unknown> ?? {};
    const txCount = (rrpTelemetry['transaction_count'] as number) ?? result.ledger.count;
    const cpCount = (rrpTelemetry['checkpoint_count'] as number) ?? result.checkpoints.count;
    const qi = result.quality_index as Record<string, unknown> ?? {};
    const qiAvg = (qi['average'] as number) ?? 0;
    const sat = result.satisfaction as Record<string, unknown> ?? {};
    const satCum = (sat['cumulative'] as number) ?? 0;
    const tc = result.topic_coverage as Record<string, unknown> ?? {};
    const tcTopics = (tc['topics'] as string[]) ?? [];

    console.log(
      `   ├─ Decision: ${result.decision} (conf: ${result.confidence.toFixed(2)})`,
    );
    console.log(
      `   ├─ Questions: ${result.total_questions} rounds: ${result.total_rounds}`,
    );
    console.log(
      `   ├─ Ambiguity: ${(result.ambiguity as Record<string, number>)?.['avg']?.toFixed(3) ?? '?'}`,
    );
    console.log(
      `   ├─ Quality: ${qiAvg.toFixed(2)} | Satisfaction: ${satCum.toFixed(2)}`,
    );
    console.log(
      `   ├─ Topics: [${tcTopics.join(', ')}]`,
    );
    console.log(
      `   └─ Ledger: ${txCount} entries, ${cpCount} checkpoints`,
    );
    console.log();

    const goalResultData: GoalResultData = {
      description,
      file: files[0] ?? '',
      function: files[0]?.split('/').pop()?.replace('.ts', '') ?? '',
      type: 'implementation',
      rrp_evaluation: {
        decision: result.decision,
        confidence: result.confidence,
        reasoning: result.reasoning,
        trace: {
          ambiguity_assessment: {
            avg_ambiguity: (result.ambiguity as Record<string, number>).avg ?? 0,
            vector: result.ambiguity,
          },
          constraint_extraction: {
            constraints: result.constraints,
          },
        },
        contradictions: result.contradictions,
        rrp_telemetry: {
          budget: result.budget,
          quality_index: result.quality_index,
          satisfaction: result.satisfaction,
          velocity: result.velocity,
          topic_coverage: result.topic_coverage,
          transaction_count: txCount,
          checkpoint_count: cpCount,
        },
      },
      rrp_refinement: result,
    };

    goalsData.push(goalResultData);

    improvementsData.push({
      description,
      decision: result.decision,
      confidence: result.confidence,
      file: files[0] ?? '',
    });
  }

  // 4. Post-state
  console.log('📊 Capturing post-state...');
  const postState = captureTelemetry();

  // 5. Compile pulse
  const endTime = new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationS = durationMs / 1000;
  const approved = goalsData.filter(
    (g) => g.rrp_evaluation.decision === 'PASS',
  ).length;
  const held = goalsData.filter(
    (g) => g.rrp_evaluation.decision === 'HOLD',
  ).length;

  const allTopicsSet = new Set<string>();
  for (const g of goalsData) {
    const tel = g.rrp_evaluation.rrp_telemetry as Record<string, unknown>;
    const tc = tel.topic_coverage as Record<string, unknown> ?? {};
    const topics = tc.topics as string[] ?? [];
    for (const t of topics) allTopicsSet.add(t);
  }

  const pulse: PulseResult = {
    pulse: String(pulseNum).padStart(3, '0'),
    timestamp_start: startTime.toISOString(),
    timestamp_end: endTime.toISOString(),
    type: 'rrp_v2_full',
    protocol:
      'RRP v2 — Full Telemetry (AmbiguityVector, TokenBudget, QualityIndex, Satisfaction, TemporalVelocity, TopicCoverage, TransactionLedger)',
    rrp_config: { u, m, x, y, z, depth },
    pre_state: preState,
    post_state: postState,
    signals: { total_stubs: 0, goals_evaluated: goalsToEval.length },
    goals: goalsData,
    improvements: improvementsData,
    summary: {
      goals_generated: goalsToEval.length,
      goals_approved: approved,
      goals_held: held,
      goals_rejected: goalsToEval.length - approved - held,
      duration_seconds: Math.round(durationS * 10) / 10,
      eval_mode: 'rrp_v2_full',
      total_questions: goalsData.reduce(
        (s, g) => s + (g.rrp_refinement.total_questions ?? 0),
        0,
      ),
      total_rounds: goalsData.reduce(
        (s, g) => s + (g.rrp_refinement.total_rounds ?? 0),
        0,
      ),
      avg_ambiguity:
        goalsData.length > 0
          ? Math.round(
              (goalsData.reduce((s, g) => {
                const amb = (g as any).rrp_evaluation?.trace?.ambiguity_assessment as Record<string, number>;
                return s + (amb?.avg_ambiguity ?? 0);
              }, 0) /
                goalsData.length) *
                1000,
            ) / 1000
          : 0,
    },
    rrp_telemetry_aggregate: {
      total_questions: goalsData.reduce(
        (s, g) => s + (g.rrp_refinement.total_questions ?? 0),
        0,
      ),
      total_rounds: goalsData.reduce(
        (s, g) => s + (g.rrp_refinement.total_rounds ?? 0),
        0,
      ),
      total_ledger_entries: goalsData.reduce(
        (s, g) =>
          s +
          ((g.rrp_evaluation.rrp_telemetry as Record<string, number>)
            ?.transaction_count ?? 0),
        0,
      ),
      total_checkpoints: goalsData.reduce(
        (s, g) =>
          s +
          ((g.rrp_evaluation.rrp_telemetry as Record<string, number>)
            ?.checkpoint_count ?? 0),
        0,
      ),
      avg_quality_index:
        goalsData.length > 0
          ? Math.round(
              (goalsData.reduce((s, g) => {
                const qi = (g as any).rrp_evaluation?.rrp_telemetry?.quality_index as Record<string, number>;
                return s + (qi?.average ?? 0);
              }, 0) /
                goalsData.length) *
                1000,
            ) / 1000
          : 0,
      avg_satisfaction:
        goalsData.length > 0
          ? Math.round(
              (goalsData.reduce((s, g) => {
                const sat = (g as any).rrp_evaluation?.rrp_telemetry?.satisfaction as Record<string, number>;
                return s + (sat?.cumulative ?? 0);
              }, 0) /
                goalsData.length) *
                1000,
            ) / 1000
          : 0,
      avg_budget_saturation:
        goalsData.length > 0
          ? Math.round(
              (goalsData.reduce((s, g) => {
                const bud = (g as any).rrp_evaluation?.rrp_telemetry?.budget as Record<string, number>;
                return s + (bud?.saturation_pct ?? 0);
              }, 0) /
                goalsData.length) *
                10,
            ) / 10
          : 0,
      all_topics: [...allTopicsSet],
    },
  };

  // Save pulse to file
  const pulsesDirPath = path.resolve(pulsesDir);
  if (!fs.existsSync(pulsesDirPath)) {
    fs.mkdirSync(pulsesDirPath, { recursive: true });
  }

  const pulsePath = path.join(pulsesDirPath, `pulse-${String(pulseNum).padStart(3, '0')}.json`);
  fs.writeFileSync(pulsePath, JSON.stringify(pulse, null, 2), 'utf-8');

  const latestPath = path.join(pulsesDirPath, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(pulse, null, 2), 'utf-8');

  // Print summary
  const agg = pulse.rrp_telemetry_aggregate;
  console.log('='.repeat(60));
  console.log(`  PULSE ${String(pulseNum).padStart(3, '0')} COMPLETE`);
  console.log('='.repeat(60));
  console.log(`  Duration: ${durationS.toFixed(1)}s`);
  console.log(`  Goals: ${goalsToEval.length} evaluated, ${approved} PASS, ${held} HOLD`);
  console.log(`  Questions: ${agg.total_questions} across ${agg.total_rounds} rounds`);
  console.log(`  Avg Ambiguity: ${pulse.summary.avg_ambiguity.toFixed(2)}`);
  console.log(`  Avg Quality: ${agg.avg_quality_index.toFixed(2)} | Avg Satisfaction: ${agg.avg_satisfaction.toFixed(2)}`);
  console.log(`  Budget Saturation: ${agg.avg_budget_saturation}%`);
  console.log(`  Ledger Entries: ${agg.total_ledger_entries} | Checkpoints: ${agg.total_checkpoints}`);
  console.log(`  Topics: ${JSON.stringify(agg.all_topics)}`);
  console.log(`  File: ${pulsePath}`);
  console.log();

  return pulse;
}
