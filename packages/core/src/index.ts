// COSMOS Core — Shared types, configs, and utilities

// ── Config ──────────────────────────────────────────────────────
export interface L1Config {
  maxToolCallsPerStep: number;
  stepTimeoutMs: number;
  maxRetries: number;
}

export interface L2Config {
  maxImprovementAttempts: number;
  sessionTimeoutMs: number;
}

export interface L3Config {
  plateauSessions: number;
  plateauTimeoutMs: number;
}

export interface ResourceLimits {
  diskUsagePct: number;
  maxMemoryRssMb: number;
  maxCpuCores: number;
  evaluatorApiCallsPerMin: number;
}

export interface MemoryConfig {
  repoRoot: string;
  gitBranch: string;
  knowledgeGraphPath: string;
  vectorStorePath: string;
  vectorStoreDimension: number;
}

export interface EvaluatorConfig {
  model: string;
  startupDigestVerify: boolean;
  readOnlyMount: boolean;
}

export interface RSISConfig {
  l1: L1Config;
  l2: L2Config;
  l3: L3Config;
  resources: ResourceLimits;
  memory: MemoryConfig;
  evaluator: EvaluatorConfig;
  workspaceDir: string;
  telemetryDir: string;
  telemetryFlushIntervalMs: number;
  logLevel: string;
  logFile: string | null;
  checkpointBeforeMutation: boolean;
}

// ── RSIS Types ──────────────────────────────────────────────────

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

export interface EvalScore {
  name: string;
  score: number;
  weight: number;
}

export interface EvalResult {
  scores: EvalScore[];
  passed: boolean;
  summary: string;
  timestamp: string;
}

export interface ImprovementRecord {
  description: string;
  targetFiles: string[];
  evalScores: EvalScore[];
  outcome: 'applied' | 'failed' | 'rolled_back';
  goal: string;
  timestamp: string;
}

export interface L2Result {
  applied: ImprovementRecord | null;
  attempts: number;
  evalResults: EvalResult[];
}

export interface L3Result {
  evolved: boolean;
  generations: number;
  bestScore: number;
}

export interface TelemetryEvent {
  eventType: string;
  metadata: Record<string, unknown>;
  timestamp?: string;
  sessionId?: string;
}

export interface Checkpoint {
  id: string;
  timestamp: string;
  description: string;
  files: string[];
}

// ── MyKB Types ──────────────────────────────────────────────────

export interface WikiFile {
  name: string;
  path: string;
  title: string;
  docType: string;
  tags: string[];
  preview: string;
  size: number;
  content?: string;
}

export interface WikiTreeNode {
  type: 'dir' | 'file';
  name: string;
  children?: WikiTreeNode[];
  count?: number;
  path?: string;
  title?: string;
  docType?: string;
  tags?: string[];
  preview?: string;
  size?: number;
}

export interface WikiTree {
  name: string;
  type: 'dir';
  children: WikiTreeNode[];
  stats: {
    totalFiles: number;
    totalDomains: number;
    domains: string[];
  };
}

export interface Frontmatter {
  title?: string;
  type?: string;
  tags: string[];
}

// ── Space Types ─────────────────────────────────────────────────

export interface ProbeQuestion {
  id: string;
  category: string;
  question: string;
  weight: number;
}

export interface SpecificationDoc {
  title: string;
  sections: SpecSection[];
  generatedAt: string;
  probesUsed: number;
}

export interface SpecSection {
  heading: string;
  content: string;
  probes: string[];
}

// ── Dashboard Types ─────────────────────────────────────────────

export interface Project {
  name: string;
  href: string;
  color: string;
  badgeColor: string;
  badge: string;
  description: string;
  tags: string[];
  stats?: { files: number; loc: number };
}

export interface ChartData {
  id: string;
  icon: string;
  title: string;
  data: [string, number, string, string][];
}

// ── Utility ─────────────────────────────────────────────────────

export function defaultRSISConfig(): RSISConfig {
  return {
    l1: { maxToolCallsPerStep: 10, stepTimeoutMs: 120_000, maxRetries: 3 },
    l2: { maxImprovementAttempts: 5, sessionTimeoutMs: 1_800_000 },
    l3: { plateauSessions: 20, plateauTimeoutMs: 86_400_000 },
    resources: { diskUsagePct: 80, maxMemoryRssMb: 4096, maxCpuCores: 3, evaluatorApiCallsPerMin: 100 },
    memory: { repoRoot: '.', gitBranch: 'rsis-evolution', knowledgeGraphPath: '.rsis/knowledge_graph.json', vectorStorePath: '.rsis/vectors', vectorStoreDimension: 384 },
    evaluator: { model: 'gpt-4o-mini', startupDigestVerify: true, readOnlyMount: true },
    workspaceDir: '.',
    telemetryDir: '.rsis/telemetry',
    telemetryFlushIntervalMs: 5000,
    logLevel: 'INFO',
    logFile: '.rsis/rsis.log',
    checkpointBeforeMutation: true,
  };
}

export class Budget {
  iterations = 0;
  private _start = Date.now();

  constructor(
    public maxIterations: number,
    public maxTimeMs: number,
    public label: string,
    startTime?: number,
  ) {
    if (startTime !== undefined) this._start = startTime;
  }

  get isExpired(): boolean {
    return Date.now() - this._start > this.maxTimeMs;
  }

  get remaining(): number {
    return this.maxTimeMs - (Date.now() - this._start);
  }

  /** Advance one iteration. Returns false if budget is exhausted. */
  tick(): boolean {
    this.iterations++;
    if (this.iterations > this.maxIterations) {
      return false;
    }
    const elapsed = Date.now() - this._start;
    if (elapsed > this.maxTimeMs) {
      return false;
    }
    return true;
  }

  reset(): void {
    this.iterations = 0;
    this._start = Date.now();
  }
}
