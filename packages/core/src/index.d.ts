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
export interface Project {
    name: string;
    href: string;
    color: string;
    badgeColor: string;
    badge: string;
    description: string;
    tags: string[];
    stats?: {
        files: number;
        loc: number;
    };
}
export interface ChartData {
    id: string;
    icon: string;
    title: string;
    data: [string, number, string, string][];
}
export declare function defaultRSISConfig(): RSISConfig;
export declare class Budget {
    maxIterations: number;
    maxTimeMs: number;
    label: string;
    iterations: number;
    private _start;
    constructor(maxIterations: number, maxTimeMs: number, label: string, startTime?: number);
    get isExpired(): boolean;
    get remaining(): number;
    /** Advance one iteration. Returns false if budget is exhausted. */
    tick(): boolean;
    reset(): void;
}
//# sourceMappingURL=index.d.ts.map