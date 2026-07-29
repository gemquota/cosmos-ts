// RSIS3 — Cognitive Engine (TypeScript port)
export { L1ActionLoop } from './loop-l1.js';
export type { ToolCall, L1Result } from './loop-l1.js';
export { L2ImprovementLoop } from './loop-l2.js';
export type { ImprovementCandidate, L2Result } from './loop-l2.js';
export { L3EvolutionLoop } from './loop-l3.js';
export type { Generation, L3Result } from './loop-l3.js';
export { TelemetryCollector, WorkspaceMonitor } from './telemetry.js';
export type { TelemetryEventData } from './telemetry.js';
export { MemoryManager, NGramVectorizer, VectorStore, RSISKnowledgeGraph } from './memory.js';
export type { KnowledgeNode, KnowledgeEdge, MemoryEntry } from './memory.js';
export { CheckpointManager } from './checkpoint.js';
export type { Checkpoint } from './checkpoint.js';
export { ResourceEnforcer, ResourceSeverity } from './resource-monitor.js';
export type { ResourceAlert } from './resource-monitor.js';
export { RecoveryManager, FailureInjector } from './recovery.js';
export type { RecoveryTestResult } from './recovery.js';
export { EvaluatorClient } from './evaluator.js';
export type { EvalScore, EvalResult } from './evaluator.js';
export { TelemetryExtrapolator } from './extrapolation.js';
export type { DataPoint, TrendLine, ExtrapolationResult } from './extrapolation.js';
export { RSISApp } from './app.js';
export type { CommandResult } from './app.js';
export { CONFIG, loadConfig } from './config.js';
export type { RSISConfig, L1Config, L2Config, L3Config, ResourceLimits, MemoryConfig, EvaluatorConfig } from './config.js';
export { Budget, TimeoutError, withDeadline, deadline, sleep } from './timeout.js';

// ── RRP Engine (rack/rrp_engine.py) ──
export {
  AmbiguityVector,
  TokenBudget,
  QuestionQualityIndex,
  UserSatisfactionDelta,
  TemporalVelocity,
  TopicCoverage,
  TransactionLedger,
  Checkpoints,
  RRPEngine,
  runRRPSession,
} from './rrp-engine.js';
export type {
  AmbiguityEstimate,
  LedgerEntry,
  CheckpointState,
  CheckpointRecord,
  ConstraintDecision,
  Contradiction,
  RRPEngineConfig,
  RRPEngineOptions,
  RRPSessionOptions,
  RRPSessionResult,
} from './rrp-engine.js';

// ── RRP Conversation (rack/rrp_conversation.py) ──
export { RRPConversation, RRPBridge } from './rrp-conversation.js';
export type {
  ConversationQA,
  MultiChoiceQA,
  RoundLogEntry,
  RRPConversationResult,
  RRPBridgeResult,
} from './rrp-conversation.js';

// ── Rack Dashboard (rack/build_dashboard.py) ──
export { loadPulseData, buildDashboardHtml } from './rack-dashboard.js';
export type {
  DashboardData,
  PulseEntry,
  GoalEntry,
} from './rack-dashboard.js';

// ── Run RRP Pulse (rack/run_rrp_pulse.py) ──
export { captureTelemetry, runPulse } from './run-rrp-pulse.js';
export type {
  TelemetrySnapshot,
  PulseResult,
  GoalResultData,
  PulseExecutionSummary,
  TelemetryAggregate,
  GoalInfo,
} from './run-rrp-pulse.js';

// ── Dashboard App (rsis/dashboard/app.py) ──
export { RSISDashboard } from './dashboard-app.js';
export type { DashboardStatus } from './dashboard-app.js';

// ── Telemetry Dashboard (telemetry-dashboard/backend/app.py) ──
export { TelemetryDashboard } from './telemetry-dashboard.js';
export type { TelemetryDashboardStatus } from './telemetry-dashboard.js';

// ── Telemetry Server (telemetry-dashboard/server.py) ──
export { TelemetryServer } from './telemetry-server.js';
export type { PulseFileInfo, ServerConfig } from './telemetry-server.js';
