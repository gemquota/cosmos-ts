/**
 * Configuration and resource limits for RSIS.
 * Deep port of Python config.py — preserves all dataclasses, defaults, and env overrides.
 */

import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Loop Termination Budgets ──────────────────────────────────────────────

export interface L1Config {
  maxToolCallsPerStep: number;
  stepTimeoutMs: number;
  maxRetries: number;
}

export const DEFAULT_L1_CONFIG: L1Config = {
  maxToolCallsPerStep: 10,
  stepTimeoutMs: 120_000,
  maxRetries: 3,
};

export interface L2Config {
  maxImprovementAttempts: number;
  sessionTimeoutMs: number;
}

export const DEFAULT_L2_CONFIG: L2Config = {
  maxImprovementAttempts: 5,
  sessionTimeoutMs: 1_800_000,
};

export interface L3Config {
  plateauSessions: number;
  plateauTimeoutMs: number;
}

export const DEFAULT_L3_CONFIG: L3Config = {
  plateauSessions: 20,
  plateauTimeoutMs: 86_400_000,
};

// ── Resource Limits ───────────────────────────────────────────────────────

export interface ResourceLimits {
  diskUsagePct: number;
  maxMemoryRssMb: number;
  maxCpuCores: number;
  evaluatorApiCallsPerMin: number;
}

export function defaultResourceLimits(): ResourceLimits {
  return {
    diskUsagePct: 80.0,
    maxMemoryRssMb: 4096,
    maxCpuCores: Math.max(1, (os.cpus().length || 4) - 1),
    evaluatorApiCallsPerMin: 100,
  };
}

// ── Memory Configuration ─────────────────────────────────────────────────

export interface MemoryConfig {
  repoRoot: string;
  gitBranch: string;
  knowledgeGraphPath: string;
  vectorStorePath: string;
  vectorStoreDimension: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  repoRoot: '.',
  gitBranch: 'rsis-evolution',
  knowledgeGraphPath: '.rsis/knowledge_graph.json',
  vectorStorePath: '.rsis/vectors',
  vectorStoreDimension: 384,
};

// ── Evaluator Configuration ──────────────────────────────────────────────

export interface EvaluatorConfig {
  evaluatorPath: string;
  evaluatorPromptPath: string;
  model: string;
  startupDigestVerify: boolean;
  readOnlyMount: boolean;
}

export const DEFAULT_EVALUATOR_CONFIG: EvaluatorConfig = {
  evaluatorPath: 'evaluator/evaluator.py',
  evaluatorPromptPath: 'evaluator/prompt.txt',
  model: 'gpt-4o-mini',
  startupDigestVerify: true,
  readOnlyMount: true,
};

// ── Main Configuration ───────────────────────────────────────────────────

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

export function loadConfig(): RSISConfig {
  const cfg: RSISConfig = {
    l1: { ...DEFAULT_L1_CONFIG },
    l2: { ...DEFAULT_L2_CONFIG },
    l3: { ...DEFAULT_L3_CONFIG },
    resources: defaultResourceLimits(),
    memory: { ...DEFAULT_MEMORY_CONFIG },
    evaluator: { ...DEFAULT_EVALUATOR_CONFIG },
    workspaceDir: '.',
    telemetryDir: '.rsis/telemetry',
    telemetryFlushIntervalMs: 5000,
    logLevel: 'INFO',
    logFile: '.rsis/rsis.log',
    checkpointBeforeMutation: true,
  };

  // Environment overrides — matches Python logic exactly
  if (process.env.RSIS_WORKSPACE) {
    cfg.workspaceDir = path.resolve(process.env.RSIS_WORKSPACE);
  }
  if (process.env.RSIS_LOG_LEVEL) {
    cfg.logLevel = process.env.RSIS_LOG_LEVEL;
  }
  if (process.env.RSIS_EVALUATOR_MODEL) {
    cfg.evaluator.model = process.env.RSIS_EVALUATOR_MODEL;
  }

  return cfg;
}

// Convenience singleton — matches Python's CONFIG
export const CONFIG: RSISConfig = loadConfig();
