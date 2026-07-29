/**
 * RRP v2 Protocol Engine — Full State Machine with Telemetry.
 *
 * TypeScript port of rack/rrp_engine.py.
 *
 * Implements the complete Recursive Refinement Protocol specification:
 *   - AmbiguityVector (4 dimensions)
 *   - TokenBudget (per-round/session limits, saturation %, alerts)
 *   - QuestionQualityIndex (rolling score average)
 *   - UserSatisfactionDelta (cumulative + trend)
 *   - TemporalVelocity (round timing, avg duration)
 *   - TopicCoverage (8-bit bitmask)
 *   - TransactionLedger (immutable audit trail)
 *   - Checkpoints (fork/rollback support)
 *   - Decision log with contradictions and constraints
 *   - Early termination detection
 *   - Diamond dependency: Use Case (U) × Execution Mode (M) × Depth (D)
 */

import * as crypto from 'node:crypto';

// ── Constants ──

export const TOPIC_ARCH = 1 << 0;
export const TOPIC_SEC = 1 << 1;
export const TOPIC_DATA = 1 << 2;
export const TOPIC_PERF = 1 << 3;
export const TOPIC_SCAL = 1 << 4;
export const TOPIC_TEST = 1 << 5;
export const TOPIC_DEPL = 1 << 6;
export const TOPIC_UX = 1 << 7;

export const TOPIC_NAMES: Record<number, string> = {
  [TOPIC_ARCH]: 'ARCH',
  [TOPIC_SEC]: 'SEC',
  [TOPIC_DATA]: 'DATA',
  [TOPIC_PERF]: 'PERF',
  [TOPIC_SCAL]: 'SCAL',
  [TOPIC_TEST]: 'TEST',
  [TOPIC_DEPL]: 'DEPL',
  [TOPIC_UX]: 'UX',
};

export const USE_CASES: Record<number, string> = {
  1: 'Alignment',
  2: 'Ideation',
  3: 'Convergence',
  4: 'Stress Testing',
  5: 'Data Mapping',
  6: 'Determinism',
};

export const EXEC_MODES: Record<number, string> = {
  1: 'Hybrid',
  2: 'Batch',
  3: 'Pulse',
};

// ── AmbiguityVector ──

export interface AmbiguityEstimate {
  requirements?: number;
  data_model?: number;
  edge_case?: number;
  determinism?: number;
}

export class AmbiguityVector {
  requirements: number;
  data_model: number;
  edge_case: number;
  determinism: number;

  constructor(
    requirements = 0.5,
    data_model = 0.5,
    edge_case = 0.5,
    determinism = 0.5,
  ) {
    this.requirements = requirements;
    this.data_model = data_model;
    this.edge_case = edge_case;
    this.determinism = determinism;
  }

  get avg(): number {
    return (
      (this.requirements + this.data_model + this.edge_case + this.determinism) /
      4.0
    );
  }

  get max_dim(): number {
    return Math.max(
      this.requirements,
      this.data_model,
      this.edge_case,
      this.determinism,
    );
  }

  get converged(): boolean {
    return this.max_dim <= 0.05;
  }

  calibrateFromConfidence(
    confidence: number,
    ambiguityEst?: AmbiguityEstimate,
  ): void {
    const base = Math.max(0.0, 0.5 - confidence * 0.4);
    if (ambiguityEst) {
      this.requirements = Math.max(
        0.0,
        Math.min(1.0, ambiguityEst.requirements ?? base),
      );
      this.data_model = Math.max(
        0.0,
        Math.min(1.0, ambiguityEst.data_model ?? base),
      );
      this.edge_case = Math.max(
        0.0,
        Math.min(1.0, ambiguityEst.edge_case ?? base),
      );
      this.determinism = Math.max(
        0.0,
        Math.min(1.0, ambiguityEst.determinism ?? base),
      );
    } else {
      this.requirements = base;
      this.data_model = base * 0.9;
      this.edge_case = base * 1.1;
      this.determinism = base;
    }
  }

  reduce(factor = 0.5): void {
    this.requirements *= factor;
    this.data_model *= factor;
    this.edge_case *= factor;
    this.determinism *= factor;
  }

  toDict(): Record<string, unknown> {
    return {
      requirements: Math.round(this.requirements * 1000) / 1000,
      data_model: Math.round(this.data_model * 1000) / 1000,
      edge_case: Math.round(this.edge_case * 1000) / 1000,
      determinism: Math.round(this.determinism * 1000) / 1000,
      avg: Math.round(this.avg * 1000) / 1000,
      converged: this.converged,
    };
  }
}

// ── TokenBudget ──

export class TokenBudget {
  sessionLimit: number;
  roundLimit: number;
  sessionUsed: number;
  roundUsed: number;
  alerts: string[];

  constructor(
    sessionLimit = 32000,
    roundLimit = 8000,
    sessionUsed = 0,
    roundUsed = 0,
    alerts: string[] = [],
  ) {
    this.sessionLimit = sessionLimit;
    this.roundLimit = roundLimit;
    this.sessionUsed = sessionUsed;
    this.roundUsed = roundUsed;
    this.alerts = alerts;
  }

  recordRound(tokens: number): void {
    this.roundUsed = tokens;
    this.sessionUsed += tokens;
    const saturation = (this.sessionUsed / this.sessionLimit) * 100;
    if (saturation > 85) {
      this.alerts.push(
        `Session budget ${Math.round(saturation)}% saturated at round`,
      );
    }
    if (this.sessionUsed > this.sessionLimit) {
      this.alerts.push('SESSION BUDGET EXCEEDED');
    }
  }

  get saturationPct(): number {
    return this.sessionLimit > 0
      ? Math.round((this.sessionUsed / this.sessionLimit) * 1000) / 10
      : 0;
  }

  toDict(): Record<string, unknown> {
    return {
      session_limit: this.sessionLimit,
      round_limit: this.roundLimit,
      session_used: this.sessionUsed,
      round_used: this.roundUsed,
      saturation_pct: this.saturationPct,
      alerts: this.alerts,
    };
  }
}

// ── QuestionQualityIndex ──

export class QuestionQualityIndex {
  scores: number[];
  maxSamples: number;

  constructor(maxSamples = 10, scores: number[] = []) {
    this.maxSamples = maxSamples;
    this.scores = scores;
  }

  get average(): number {
    if (this.scores.length === 0) return 0;
    return (
      this.scores.reduce((a, b) => a + b, 0) / this.scores.length
    );
  }

  record(score: number): void {
    const clamped = Math.max(0.0, Math.min(1.0, score));
    this.scores.push(clamped);
    if (this.scores.length > this.maxSamples) {
      this.scores.shift();
    }
  }

  toDict(): Record<string, unknown> {
    return {
      average: Math.round(this.average * 1000) / 1000,
      samples: this.scores.length,
      max_samples: this.maxSamples,
      scores: this.scores.map((s) => Math.round(s * 1000) / 1000),
    };
  }
}

// ── UserSatisfactionDelta ──

export class UserSatisfactionDelta {
  cumulative: number;
  deltas: number[];

  constructor(cumulative = 0, deltas: number[] = []) {
    this.cumulative = cumulative;
    this.deltas = deltas;
  }

  get trend(): number {
    if (this.deltas.length < 2) return 0;
    const recent = this.deltas.slice(-3);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  record(delta: number): void {
    this.deltas.push(delta);
    this.cumulative += delta;
  }

  toDict(): Record<string, unknown> {
    return {
      cumulative: Math.round(this.cumulative * 1000) / 1000,
      trend: Math.round(this.trend * 1000) / 1000,
      deltas: this.deltas.map((d) => Math.round(d * 1000) / 1000),
    };
  }
}

// ── TemporalVelocity ──

export class TemporalVelocity {
  roundTimestamps: number[];
  roundDurations: number[];

  constructor(
    roundTimestamps: number[] = [],
    roundDurations: number[] = [],
  ) {
    this.roundTimestamps = roundTimestamps;
    this.roundDurations = roundDurations;
  }

  get avgDuration(): number {
    if (this.roundDurations.length === 0) return 0;
    return (
      this.roundDurations.reduce((a, b) => a + b, 0) /
      this.roundDurations.length
    );
  }

  recordRound(): number {
    const now = Date.now();
    this.roundTimestamps.push(now);
    if (this.roundTimestamps.length > 1) {
      const prev = this.roundTimestamps[this.roundTimestamps.length - 2];
      this.roundDurations.push(now - prev);
    }
    return now;
  }

  toDict(): Record<string, unknown> {
    return {
      round_count: this.roundTimestamps.length,
      avg_duration_ms: Math.round(this.avgDuration * 100) / 100,
      total_duration_ms:
        this.roundTimestamps.length > 1
          ? this.roundTimestamps[this.roundTimestamps.length - 1] -
            this.roundTimestamps[0]
          : 0,
      round_durations: this.roundDurations.map(
        (d) => Math.round(d * 100) / 100,
      ),
    };
  }
}

// ── TopicCoverage (8-bit bitmask) ──

export class TopicCoverage {
  mask: number;

  constructor(mask = 0) {
    this.mask = mask;
  }

  mark(topic: number): void {
    this.mask |= topic;
  }

  has(topic: number): boolean {
    return (this.mask & topic) !== 0;
  }

  get topics(): string[] {
    const result: string[] = [];
    for (const [bit, name] of Object.entries(TOPIC_NAMES)) {
      if ((this.mask & Number(bit)) !== 0) {
        result.push(name);
      }
    }
    return result;
  }

  get allCovered(): boolean {
    return this.mask === 0xff;
  }

  toDict(): Record<string, unknown> {
    return {
      mask: this.mask,
      binary: this.mask.toString(2).padStart(8, '0'),
      topics: this.topics,
      all_covered: this.allCovered,
    };
  }
}

// ── TransactionLedger ──

export interface LedgerEntry {
  id: string;
  timestamp: string;
  round: number;
  action: string;
  details: string;
  stateSnapshot?: Record<string, unknown>;
}

export class TransactionLedger {
  entries: LedgerEntry[];

  constructor(entries: LedgerEntry[] = []) {
    this.entries = entries;
  }

  record(
    round: number,
    action: string,
    details: string,
    stateSnapshot?: Record<string, unknown>,
  ): string {
    const id = crypto.randomUUID();
    const entry: LedgerEntry = {
      id,
      timestamp: new Date().toISOString(),
      round,
      action,
      details,
      ...(stateSnapshot ? { stateSnapshot } : {}),
    };
    this.entries.push(entry);
    return id;
  }

  get count(): number {
    return this.entries.length;
  }

  toDict(): { count: number; entries: LedgerEntry[] } {
    return { count: this.entries.length, entries: [...this.entries] };
  }
}

// ── Checkpoints ──

export interface CheckpointState {
  ambiguity: Record<string, unknown>;
  budget: Record<string, unknown>;
  qualityIndex: Record<string, unknown>;
  satisfaction: Record<string, unknown>;
  velocity: Record<string, unknown>;
  topicCoverage: Record<string, unknown>;
  ledger: { count: number; entries: LedgerEntry[] };
  round: number;
}

export interface CheckpointRecord {
  id: string;
  label: string;
  timestamp: string;
  state: CheckpointState;
  parentId?: string;
}

export class Checkpoints {
  points: CheckpointRecord[] = [];

  fork(
    label: string,
    state: CheckpointState,
    parentId?: string,
  ): string {
    const id = crypto.randomUUID();
    this.points.push({ id, label, timestamp: new Date().toISOString(), state, parentId });
    return id;
  }

  rollback(checkpointId: string): CheckpointState | null {
    const cp = this.points.find((p) => p.id === checkpointId);
    return cp ? JSON.parse(JSON.stringify(cp.state)) : null;
  }

  get count(): number {
    return this.points.length;
  }

  toDict(): { count: number; checkpoints: CheckpointRecord[] } {
    return { count: this.points.length, checkpoints: [...this.points] };
  }
}

// ── Decision Log Types ──

export interface ConstraintDecision {
  constraint: string;
  decision: string; // LOCKED | RECOMMENDED | OPEN
  round: number;
}

export interface Contradiction {
  between: [string, string];
  description: string;
  round: number;
}

// ── RRPEngine ──

export interface RRPEngineConfig {
  u: number;
  m: number;
  x: number;
  y: number;
  z: number;
  depth: number;
}

export interface RRPEngineOptions {
  u?: number;
  m?: number;
  x?: number;
  y?: number;
  z?: number;
  depth?: number;
}

export class RRPEngine {
  config: RRPEngineConfig;
  sessionId: string;
  goalDescription: string;
  targetFiles: string[];
  round: number;

  ambiguity: AmbiguityVector;
  budget: TokenBudget;
  qualityIndex: QuestionQualityIndex;
  satisfaction: UserSatisfactionDelta;
  velocity: TemporalVelocity;
  topicCoverage: TopicCoverage;
  ledger: TransactionLedger;
  checkpoints: Checkpoints;

  openQuestions: string[];
  multiChoiceQuestions: Array<{ question: string; options: string[] }>;
  probingQuestions: string[];

  decisions: Array<{
    round: number;
    decision: string;
    confidence: number;
    reasoning: string;
  }>;
  contradictions: Contradiction[];
  constraints: Record<string, string>;
  constraintHistory: ConstraintDecision[];

  openRoundAnswers: Array<{
    round: number;
    answers: Array<{ question: string; answer: string }>;
  }>;
  multiChoiceAnswers: Array<{
    round: number;
    answers: Array<{
      question: string;
      options?: string[];
      answer: Record<string, string>;
    }>;
  }>;

  terminatedEarly: boolean;

  constructor(options: RRPEngineOptions = {}) {
    this.config = {
      u: options.u ?? 4,
      m: options.m ?? 1,
      x: options.x ?? 3,
      y: options.y ?? 3,
      z: options.z ?? 3,
      depth: options.depth ?? 2,
    };
    this.sessionId = crypto.randomUUID();
    this.goalDescription = '';
    this.targetFiles = [];
    this.round = 0;

    this.ambiguity = new AmbiguityVector();
    this.budget = new TokenBudget();
    this.qualityIndex = new QuestionQualityIndex();
    this.satisfaction = new UserSatisfactionDelta();
    this.velocity = new TemporalVelocity();
    this.topicCoverage = new TopicCoverage();
    this.ledger = new TransactionLedger();
    this.checkpoints = new Checkpoints();

    this.openQuestions = [];
    this.multiChoiceQuestions = [];
    this.probingQuestions = [];

    this.decisions = [];
    this.contradictions = [];
    this.constraints = {};
    this.constraintHistory = [];

    this.openRoundAnswers = [];
    this.multiChoiceAnswers = [];

    this.terminatedEarly = false;
  }

  startSession(
    goalDescription: string,
    targetFiles: string[] = [],
  ): string {
    this.sessionId = crypto.randomUUID();
    this.goalDescription = goalDescription;
    this.targetFiles = targetFiles;
    this.round = 0;

    // Reset state
    this.ambiguity = new AmbiguityVector();
    this.budget = new TokenBudget();
    this.qualityIndex = new QuestionQualityIndex();
    this.satisfaction = new UserSatisfactionDelta();
    this.velocity = new TemporalVelocity();
    this.topicCoverage = new TopicCoverage();
    this.ledger = new TransactionLedger();
    this.checkpoints = new Checkpoints();
    this.openQuestions = [];
    this.multiChoiceQuestions = [];
    this.probingQuestions = [];
    this.decisions = [];
    this.contradictions = [];
    this.constraints = {};
    this.constraintHistory = [];
    this.openRoundAnswers = [];
    this.multiChoiceAnswers = [];
    this.terminatedEarly = false;

    this.ledger.record(0, 'session_start', goalDescription, {
      target_files: targetFiles,
    });

    // Create initial checkpoint
    this.saveCheckpoint('session_start');

    return this.sessionId;
  }

  generateOpenQuestions(): string[] {
    const topics = Object.keys(QUESTION_BANK);
    const questions: string[] = [];
    const x = this.config.x;
    for (let i = 0; i < x; i++) {
      const topic = topics[i % topics.length];
      const bank = QUESTION_BANK[topic];
      if (bank) {
        questions.push(bank[i % bank.length]);
      }
    }
    this.openQuestions = questions;
    return questions;
  }

  generateMultiChoice(
    _prevAnswers: string[],
  ): Array<{ question: string; options: string[] }> {
    const mcqs: Array<{ question: string; options: string[] }> = [];
    const topics = [
      'error_handling',
      'type_safety',
      'test_coverage',
      'logging',
      'documentation',
      'code_quality',
      'maintainability',
      'input_validation',
      'performance',
      'security',
    ];
    const y = this.config.y;
    for (let i = 0; i < this.config.x * y; i++) {
      const topic = topics[i % topics.length];
      const bank = MULTI_CHOICE_BANK[topic];
      if (bank) {
        const idx = Math.floor(i / topics.length) % bank.length;
        const q = bank[idx % bank.length];
        mcqs.push({
          question: q.question,
          options: [...q.options],
        });
      }
    }
    this.multiChoiceQuestions = mcqs;
    return mcqs;
  }

  generateProbingQuestions(): string[] {
    const probing: string[] = [];
    const count = this.config.x * this.config.y;
    const shuffled = [...PROBE_QUESTIONS];
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      probing.push(shuffled[i]);
    }
    this.probingQuestions = probing;
    return probing;
  }

  processOpenEnded(
    questions: string[],
    answers: string[],
    satisfaction = 0.7,
  ): void {
    this.round++;
    this.velocity.recordRound();

    // Calculate quality based on answer length and variety
    let qualitySum = 0;
    for (let i = 0; i < answers.length; i++) {
      const wordCount = answers[i].split(/\s+/).length;
      const qScore = Math.min(1.0, wordCount / 30);
      qualitySum += qScore;
    }
    const avgQuality =
      answers.length > 0 ? qualitySum / answers.length : 0.5;
    this.qualityIndex.record(avgQuality);

    this.satisfaction.record(satisfaction);

    // Reduce ambiguity
    this.ambiguity.reduce(0.7);

    this.openRoundAnswers.push({
      round: this.round,
      answers: questions.map((q, i) => ({
        question: q,
        answer: answers[i] ?? '',
      })),
    });

    // Calibrate from confidence
    const conf = 1.0 - this.ambiguity.avg;
    this.ambiguity.calibrateFromConfidence(conf);

    this.ledger.record(
      this.round,
      'open_ended',
      `Processed ${answers.length} open-ended answers`,
      {
        satisfaction,
        avg_quality: avgQuality,
      },
    );

    // Check early termination
    this.checkEarlyTermination();
  }

  processMultiChoice(
    questions: Array<{ question: string; options?: string[] }>,
    answers: Array<Record<string, string>>,
    satisfaction = 0.8,
  ): void {
    this.round++;
    this.velocity.recordRound();

    for (const ans of answers) {
      for (const [key, value] of Object.entries(ans)) {
        this.constraints[key] = value;
        this.constraintHistory.push({
          constraint: key,
          decision: value,
          round: this.round,
        });
      }
    }

    this.qualityIndex.record(0.85);
    this.satisfaction.record(satisfaction);
    this.ambiguity.reduce(0.6);

    this.multiChoiceAnswers.push({
      round: this.round,
      answers: questions.map((q, i) => ({
        question: q.question,
        options: q.options,
        answer: answers[i] ?? {},
      })),
    });

    this.ledger.record(
      this.round,
      'multi_choice',
      `Processed ${answers.length} multi-choice answers`,
      { satisfaction, constraints: Object.keys(answers[0] ?? {}) },
    );

    this.checkEarlyTermination();
  }

  checkEarlyTermination(): void {
    const roundCheck = this.round >= Math.max(3, Math.floor(this.config.z * 0.7));
    const ambCheck = this.ambiguity.converged;
    const topicCheck = this.topicCoverage.allCovered;
    const sufficientScore = this.qualityIndex.average >= 0.7;

    if (roundCheck && (ambCheck || topicCheck) && sufficientScore) {
      this.terminatedEarly = true;
      this.ledger.record(
        this.round,
        'early_termination',
        `Early termination at round ${this.round}: converged=${ambCheck}, topics=${topicCheck}`,
      );
    }
  }

  processDecision(
    decision: string,
    confidence: number,
    reasoning: string,
  ): void {
    this.decisions.push({
      round: this.round,
      decision,
      confidence,
      reasoning,
    });
    this.ledger.record(
      this.round,
      'decision',
      `${decision} (conf=${confidence})`,
      { reasoning },
    );
  }

  saveCheckpoint(label: string, parentId?: string): string {
    const state: CheckpointState = {
      ambiguity: this.ambiguity.toDict(),
      budget: this.budget.toDict(),
      qualityIndex: this.qualityIndex.toDict(),
      satisfaction: this.satisfaction.toDict(),
      velocity: this.velocity.toDict(),
      topicCoverage: this.topicCoverage.toDict(),
      ledger: this.ledger.toDict(),
      round: this.round,
    };
    return this.checkpoints.fork(label, state, parentId);
  }

  rollback(checkpointId: string): boolean {
    const state = this.checkpoints.rollback(checkpointId);
    if (!state) return false;

    // Restore state from checkpoint
    const amb = state.ambiguity as Record<string, number>;
    this.ambiguity = new AmbiguityVector(
      amb.requirements,
      amb.data_model,
      amb.edge_case,
      amb.determinism,
    );

    const bud = state.budget as Record<string, number>;
    this.budget = new TokenBudget(
      bud.session_limit,
      bud.round_limit,
      bud.session_used,
      bud.round_used,
      [...(state.budget.alerts as string[])],
    );

    const qi = state.qualityIndex as Record<string, number>;
    this.qualityIndex = new QuestionQualityIndex(qi.max_samples);
    // Note: scores are not restored from serialized form in this simplified port

    this.round = state.round as number;

    this.ledger.record(
      this.round,
      'rollback',
      `Rolled back to checkpoint ${checkpointId}`,
    );
    return true;
  }

  finalize(): Record<string, unknown> {
    const totalRounds = this.round;

    // Compute final confidence
    const ambiguityScore = this.ambiguity.avg;
    const confidence = Math.max(
      0.3,
      Math.min(0.95, 1.0 - ambiguityScore),
    );

    // Determine decision if none recorded
    if (this.decisions.length === 0) {
      let decision: string;
      if (this.ambiguity.converged || this.topicCoverage.allCovered) {
        decision = 'PASS';
      } else if (ambiguityScore > 0.6) {
        decision = 'HOLD';
      } else {
        decision = 'PASS';
      }
      const reasoning = `Session complete: ${totalRounds} rounds. Ambiguity=${ambiguityScore.toFixed(2)}, Topics=${this.topicCoverage.mask.toString(2).padStart(8, '0')}`;
      this.processDecision(decision, confidence, reasoning);
    }

    this.ledger.record(totalRounds, 'session_end', 'Session finalized');

    return {
      session_id: this.sessionId,
      goal: this.goalDescription,
      target_files: this.targetFiles,
      config: this.config,
      total_rounds: totalRounds,
      terminated_early: this.terminatedEarly,
      ambiguity: this.ambiguity.toDict(),
      budget: this.budget.toDict(),
      quality_index: this.qualityIndex.toDict(),
      satisfaction: this.satisfaction.toDict(),
      velocity: this.velocity.toDict(),
      topic_coverage: this.topicCoverage.toDict(),
      ledger: this.ledger.toDict(),
      checkpoints: this.checkpoints.toDict(),
      decisions: [...this.decisions],
      constraints: { ...this.constraints },
      constraint_history: this.constraintHistory,
      contradictions: [...this.contradictions],
      decision: this.decisions[this.decisions.length - 1]?.decision ?? 'PASS',
      confidence: this.decisions[this.decisions.length - 1]?.confidence ?? confidence,
      reasoning: this.decisions[this.decisions.length - 1]?.reasoning ?? '',
    };
  }
}

// ── Question Banks (shared with rrp-conversation.ts) ──

export interface QuestionEntry {
  question: string;
  options: string[];
}

export const QUESTION_BANK: Record<string, string[]> = {
  error_handling: [
    'What error types or edge cases should this code handle?',
    'Should failures be silent (log only), loud (raise exception), or retry with backoff?',
    "What's the recovery strategy if this operation fails partway through?",
    'How should we propagate errors — exception chaining or custom error types?',
    'Are there resource cleanup concerns (file handles, connections) on failure?',
    'Should we differentiate between transient vs permanent failures?',
  ],
  type_safety: [
    'What input types should this function accept and what constraints apply?',
    "What return type best represents this operation's possible outcomes?",
    'How should we represent optional/missing values — None, Optional, or sentinel?',
    'Should we enforce types at runtime, at static-analysis time, or both?',
    'How do we handle variant types without losing type information?',
    'What type contracts should exist between this function and its callers?',
  ],
  test_coverage: [
    'What are the key scenarios (happy, error, edge) that need test coverage?',
    "How do we verify this change doesn't break existing behavior?",
    'Should we prioritize unit tests, integration, or property-based tests?',
    'What mocking strategy isolates this code from its dependencies?',
    'How do we measure whether test coverage is adequate?',
    'What regression tests should we add to prevent repeat issues?',
  ],
  logging: [
    'What operations and state changes should be visible in logs?',
    'What log levels (DEBUG, INFO, WARNING, ERROR) suit different events?',
    'What contextual data (timing, params, request IDs) should logs include?',
    'How should we handle PII or sensitive data in log messages?',
    'Should we use structured logging (JSON) or plain text?',
    'What log retention and rotation strategy applies here?',
  ],
  documentation: [
    'What aspects of this code need documentation — API, internals, both?',
    'What docstring format (Google, NumPy, Sphinx) fits this codebase?',
    'Should docs include usage examples, edge-case notes, or design rationale?',
    'How do we keep documentation in sync with code changes?',
    'What README or architecture docs should reference this module?',
    'Who is the audience for this documentation — users or maintainers?',
  ],
  code_quality: [
    'What complexity issues exist — long functions, deep nesting, duplication?',
    'Which patterns or abstractions would improve readability most?',
    'Are there duplicated code blocks across files that could be unified?',
    'How should we balance conciseness against explicitness?',
    'What naming conventions should guide variable, function, and class names?',
    'Should we extract this into smaller modules or keep it cohesive?',
  ],
  input_validation: [
    'What external inputs (user, file, network) reach this code path?',
    'What are the valid ranges, formats, and types for each input?',
    'Should we reject invalid inputs loudly or coerce/cleanse them?',
    'At what boundary should validation happen — public API or internal?',
    'How do we validate without duplicating checks across layers?',
    'What error message format helps callers fix invalid inputs?',
  ],
  maintainability: [
    'What makes this code hard to maintain or reason about currently?',
    'How should we decompose this into smaller, focused units?',
    'What dependencies exist and how tightly coupled are they?',
    'What testability improvements would make this easier to change?',
    'How do we reduce cognitive load for future maintainers?',
    'What configuration should be externalized vs hardcoded?',
  ],
  performance: [
    'What performance characteristics matter for this code path?',
    'Are there known bottlenecks in the current approach?',
    'Should we optimize for latency, throughput, or memory usage?',
    'What caching strategy could apply here?',
    'How do we avoid premature optimization?',
    'What profiling data supports our performance choices?',
  ],
  security: [
    'What security threats could target this code?',
    'Should we sanitize, validate, or escape inputs at this layer?',
    'What authentication or authorization checks belong here?',
    'How do we avoid introducing vulnerabilities (XSS, injection, etc.)?',
    'What least-privilege principles apply to this component?',
    'How should secrets and credentials be managed?',
  ],
};

export const MULTI_CHOICE_BANK: Record<string, QuestionEntry[]> = {
  error_handling: [
    {
      question: 'Error handling strategy?',
      options: ['LOG_ONLY', 'RAISE_EXCEPTION', 'RETRY_BACKOFF', 'CONTEXTUAL'],
    },
    {
      question: 'Error recovery approach?',
      options: ['ROLLBACK', 'CONTINUE', 'COMPENSATE', 'ABORT'],
    },
  ],
  type_safety: [
    {
      question: 'Type enforcement level?',
      options: ['RUNTIME', 'STATIC', 'BOTH', 'NONE'],
    },
  ],
  test_coverage: [
    {
      question: 'Test priority?',
      options: ['UNIT', 'INTEGRATION', 'PROPERTY_BASED', 'ALL'],
    },
  ],
  logging: [
    {
      question: 'Log format?',
      options: ['STRUCTURED_JSON', 'PLAIN_TEXT', 'BOTH'],
    },
  ],
  documentation: [
    {
      question: 'Documentation scope?',
      options: ['API_ONLY', 'INTERNALS_ONLY', 'BOTH', 'NONE'],
    },
  ],
  code_quality: [
    {
      question: 'Code quality priority?',
      options: ['READABILITY', 'PERFORMANCE', 'MAINTAINABILITY', 'BALANCED'],
    },
  ],
  maintainability: [
    {
      question: 'Module structure?',
      options: ['MONOLITHIC', 'MODULAR', 'MICRO', 'HYBRID'],
    },
  ],
  input_validation: [
    {
      question: 'Validation boundary?',
      options: ['PUBLIC_API', 'INTERNAL', 'BOTH', 'NONE'],
    },
  ],
  performance: [
    {
      question: 'Optimization target?',
      options: ['LATENCY', 'THROUGHPUT', 'MEMORY', 'BALANCED'],
    },
  ],
  security: [
    {
      question: 'Security approach?',
      options: ['SANITIZE', 'VALIDATE', 'ESCAPE', 'ALL'],
    },
  ],
};

export const PROBE_QUESTIONS: string[] = [
  'Have all architectural concerns been addressed?',
  'Are there any remaining security vulnerabilities?',
  'Is the data model complete and normalized?',
  'Are performance requirements achievable?',
  'Is test coverage adequate for production?',
  'Can the deployment be automated safely?',
  'Are there any contradictions in the constraints?',
  'Is the user experience satisfactory?',
  'Have edge cases been sufficiently tested?',
  'Are there scalability concerns?',
  'Is the solution maintainable long-term?',
  'Have all error paths been handled?',
];

// ── run_rrp_session() ──

export interface RRPSessionOptions {
  goalDescription: string;
  targetFiles?: string[];
  x?: number;
  y?: number;
  z?: number;
  u?: number;
  m?: number;
  depth?: number;
  interactive?: boolean;
  userAnswerFn?: (question: string) => string;
}

export interface RRPSessionResult {
  session_id: string;
  goal: string;
  target_files: string[];
  config: RRPEngineConfig;
  total_rounds: number;
  rounds: number;
  terminated_early: boolean;
  ambiguity: Record<string, unknown>;
  budget: Record<string, unknown>;
  quality_index: Record<string, unknown>;
  satisfaction: Record<string, unknown>;
  velocity: Record<string, unknown>;
  topic_coverage: Record<string, unknown>;
  ledger: { count: number; entries: LedgerEntry[] };
  checkpoints: { count: number; checkpoints: CheckpointRecord[] };
  decisions: Array<{
    round: number;
    decision: string;
    confidence: number;
    reasoning: string;
  }>;
  constraints: Record<string, string>;
  constraint_history: ConstraintDecision[];
  contradictions: Contradiction[];
  decision: string;
  confidence: number;
  reasoning: string;
  total_questions: number;
  conversation_log?: Array<Record<string, unknown>>;
}

export function runRRPSession(
  options: RRPSessionOptions,
): RRPSessionResult {
  const {
    goalDescription,
    targetFiles = [],
    x = 3,
    y = 3,
    z = 3,
    u = 4,
    m = 1,
    depth = 2,
  } = options;

  const engine = new RRPEngine({ u, m, x, y, z, depth });
  engine.startSession(goalDescription, targetFiles);

  const conversationLog: Array<Record<string, unknown>> = [];
  let totalQuestions = 0;

  for (let roundNum = 1; roundNum <= z + 1; roundNum++) {
    if (roundNum === 1) {
      // Round 1: X open-ended questions
      const questions = engine.generateOpenQuestions();
      const topics = Object.keys(QUESTION_BANK);
      const answers: string[] = [];

      for (let qi = 0; qi < questions.length; qi++) {
        const topic = topics[qi % topics.length];
        answers.push(
          `Implement with ${topic}. Following best practices consistent with existing codebase.`,
        );
      }

      for (let qi = 0; qi < questions.length; qi++) {
        conversationLog.push({
          round: roundNum,
          phase: 'open_ended',
          question: questions[qi],
          answer: answers[qi],
        });
      }

      engine.processOpenEnded(questions, answers, 0.7);
      totalQuestions += questions.length;
    } else if (roundNum <= z) {
      // Rounds 2..Z: Multi-choice follow-ups
      const prevAnswers =
        conversationLog
          .filter((c) => c.round === roundNum - 1)
          .map((c) => c.answer as string) ?? [''];
      const mcqs = engine.generateMultiChoice(prevAnswers);
      const constraintTypes = [
        'error_handling',
        'type_safety',
        'test_coverage',
        'logging',
        'documentation',
        'security',
        'code_quality',
        'maintainability',
        'input_validation',
        'performance',
      ];
      const mcAnswers: Array<Record<string, string>> = [];

      for (let mi = 0; mi < mcqs.length; mi++) {
        const ct = constraintTypes[mi % constraintTypes.length];
        const ans: Record<string, string> = { [ct]: 'LOCKED' };
        if (mi % 3 === 0) ans.type_safety = 'RECOMMENDED';
        if (mi % 5 === 0) ans.test_coverage = 'LOCKED';
        mcAnswers.push(ans);
      }

      for (let mi = 0; mi < mcqs.length; mi++) {
        conversationLog.push({
          round: roundNum,
          phase: 'multi_choice',
          question: mcqs[mi].question,
          options: mcqs[mi].options,
          answer: mcAnswers[mi],
        });
      }

      engine.processMultiChoice(mcqs, mcAnswers, 0.8);
      totalQuestions += mcqs.length;

      // New open-ended questions
      const newQuestions = engine.generateOpenQuestions();
      const newAnswers = newQuestions.map(
        () => 'Auto-answer: consistent with previously locked constraints.',
      );

      for (let qi = 0; qi < newQuestions.length; qi++) {
        conversationLog.push({
          round: roundNum,
          phase: 'open_ended',
          question: newQuestions[qi],
          answer: newAnswers[qi],
        });
      }

      engine.processOpenEnded(newQuestions, newAnswers, 0.75);
      totalQuestions += newQuestions.length;
    } else {
      // Final round: Probing questions → decision
      const probing = engine.generateProbingQuestions();
      const probeTopics = [
        'All architectural concerns addressed with modular design.',
        'Security requirements satisfied through input validation and authentication.',
        'Data model properly normalized with appropriate indexes.',
        'Performance targets achievable with caching layer.',
        'Test coverage meets threshold with unit and integration tests.',
        'Deployment pipeline configured with automated rollback.',
      ];
      const probeAnswers: string[] = [];

      for (let pi = 0; pi < probing.length; pi++) {
        let ans = probeTopics[pi % probeTopics.length];
        if (pi % 2 === 0) ans += ' No contradictions detected.';
        probeAnswers.push(ans);
      }

      for (let pi = 0; pi < probing.length; pi++) {
        conversationLog.push({
          round: roundNum,
          phase: 'probing',
          question: probing[pi],
          answer: probeAnswers[pi],
        });
      }

      // Compute final confidence from ambiguity
      const ambiguityScore = engine.ambiguity.avg;
      const confidence = Math.max(
        0.3,
        Math.min(0.95, 1.0 - ambiguityScore),
      );

      // Check for early termination
      const roundCheck = roundNum >= Math.max(3, Math.floor(z * 0.7));
      const ambCheck = engine.ambiguity.converged;
      const topicCheck = engine.topicCoverage.allCovered;

      let decision: string;
      if (roundCheck && (ambCheck || topicCheck)) {
        decision = 'PASS';
      } else if (ambiguityScore > 0.6) {
        decision = 'HOLD';
      } else {
        decision = 'PASS';
      }

      const reasoning = `RRP session complete: ${totalQuestions} questions across ${roundNum} rounds. Ambiguity=${ambiguityScore.toFixed(2)}, Topics=${engine.topicCoverage.mask.toString(2).padStart(8, '0')}`;

      engine.processDecision(decision, confidence, reasoning);
      totalQuestions += probing.length;
    }
  }

  const result = engine.finalize();
  return {
    ...result,
    total_questions: totalQuestions,
    conversation_log: conversationLog,
  } as unknown as RRPSessionResult;
}
