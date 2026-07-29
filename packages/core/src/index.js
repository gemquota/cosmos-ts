// COSMOS Core — Shared types, configs, and utilities
// ── Utility ─────────────────────────────────────────────────────
export function defaultRSISConfig() {
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
    maxIterations;
    maxTimeMs;
    label;
    iterations = 0;
    _start = Date.now();
    constructor(maxIterations, maxTimeMs, label, startTime) {
        this.maxIterations = maxIterations;
        this.maxTimeMs = maxTimeMs;
        this.label = label;
        if (startTime !== undefined)
            this._start = startTime;
    }
    get isExpired() {
        return Date.now() - this._start > this.maxTimeMs;
    }
    get remaining() {
        return this.maxTimeMs - (Date.now() - this._start);
    }
    /** Advance one iteration. Returns false if budget is exhausted. */
    tick() {
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
    reset() {
        this.iterations = 0;
        this._start = Date.now();
    }
}
//# sourceMappingURL=index.js.map