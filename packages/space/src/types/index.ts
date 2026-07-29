// ==========================================
// Layer 1: Framework Definition Schema
// ==========================================

export interface FrameworkDefinition {
  meta: FrameworkMeta;
  dependency_graph: DependencyGraph;
  series: SeriesDefinition[];
}

export interface FrameworkMeta {
  name: string;
  version: string;
  description: string;
  total_series: number;
  total_rounds: number;
  total_open_ended: number;
  total_multi_choice: number;
  estimated_completion_minutes: [number, number];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface DependencyNode {
  series_id: number;
  name: string;
  provides: string[];
}

export interface DependencyEdge {
  from: number;
  to: number;
  artifacts: string[];
}

export interface SeriesDefinition {
  id: number;
  name: string;
  description: string;
  depends_on: number[];
  consumes: string[];
  provides: string[];
  rounds: RoundDefinition[];
  x_rounds: number;
  y_open_ended_per_round: number;
  z_multi_choice_per_open: number;
  total_open_ended: number;
  total_multi_choice: number;
}

export interface RoundDefinition {
  round: number;
  focus: string;
  open_ended: OpenEndedQuestion[];
}

export interface OpenEndedQuestion {
  id: string;
  text: string;
  context_template?: string;
  follow_up_choices: MultiChoice[];
}

export interface MultiChoice {
  id: string;
  text: string;
  weight?: number;
}

// ==========================================
// Layer 2: Session State Schema
// ==========================================

export interface SessionState {
  session: SessionMeta;
  answers: Record<string, AnswerEntry>;
  progress: ProgressState;
  artifacts: ArtifactDictionary;
  llm_metadata?: LLMMetadata;
}

export interface SessionMeta {
  id: string;
  project_id: string;
  framework_version: string;
  created_at: string;
  updated_at: string;
  status: 'created' | 'in_progress' | 'completed' | 'abandoned';
  estimated_completion_pct: number;
  total_time_ms: number;
}

export interface AnswerEntry {
  question_id: string;
  series_id: number;
  round: number;
  open_ended_text: string;
  multi_choice_id?: string;
  multi_choice_text?: string;
  answered_at: string;
  edit_count: number;
  llm_refined?: string;
  quality_score?: number;
}

export interface ProgressState {
  completed_rounds: string[];
  completed_series: number[];
  current_series: number | null;
  current_round: number | null;
  last_question_id?: string;
  blocked_on?: string[];
}

export type ArtifactDictionary = Record<string, ArtifactValue>;

export type ArtifactValueContent = string | number | boolean | string[] | Record<string, unknown> | null;

export interface ArtifactValue {
  value: ArtifactValueContent;
  source_question_id: string;
  source_series_id: number;
  confidence: number;
  last_updated: string;
  derived_from?: string[];
}

export interface LLMMetadata {
  provider: string;
  model: string;
  total_tokens_used: number;
  refinement_count: number;
  synthesis_count: number;
}

// ==========================================
// Layer 3: Project Schema
// ==========================================

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  framework_version: string;
  sessions: SessionSummary[];
  active_session_id?: string;
  tags: string[];
}

export interface SessionSummary {
  session_id: string;
  status: SessionMeta['status'];
  completion_pct: number;
  created_at: string;
  updated_at: string;
}

// ==========================================
// Export Types
// ==========================================

export type ExportFormat = 'json' | 'markdown' | 'yaml' | 'prompt' | 'html' | 'diff';

export interface ExportResult {
  content: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export interface ExportOptions {
  include_metadata?: boolean;
  include_empty_answers?: boolean;
  include_artifacts?: boolean;
  project_name?: string;
  template_style?: 'full' | 'compact';
  diff_against?: SessionState;
}

// ==========================================
// Engine Types
// ==========================================

export interface QuestionContext {
  question: OpenEndedQuestion;
  series_id: number;
  series_name: string;
  round: number;
  round_focus: string;
  total_rounds: number;
  context_template?: string;
  artifacts_used: string[];
}

export interface SubmitResult {
  accepted: boolean;
  artifacts_updated: string[];
  round_completed: boolean;
  series_completed: boolean;
  session_completed: boolean;
  next_question?: QuestionContext;
}

export interface ProgressMetrics {
  session_id: string;
  overall: {
    total_questions: number;
    answered: number;
    completion_pct: number;
  };
  by_series: {
    series_id: number;
    name: string;
    total_rounds: number;
    completed_rounds: number;
    total_questions: number;
    answered: number;
    completion_pct: number;
    status: 'locked' | 'available' | 'in_progress' | 'completed';
  }[];
  timing: {
    started_at: string;
    last_activity_at: string;
    active_time_ms: number;
    estimated_remaining_ms: number;
    avg_time_per_question_ms: number;
  };
}

// ==========================================
// Validation Types
// ==========================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AnswerInput {
  open_ended: string;
  choice_id?: string;
}

// ==========================================
// Intelligence Types
// ==========================================

export interface QualityResult {
  score: number;
  dimensions: {
    completeness: number;
    specificity: number;
    consistency: number;
    actionability: number;
  };
  suggestions: string[];
}

export interface CompletenessReport {
  overall_score: number;
  per_dimension: {
    dimension: string;
    score: number;
    status: 'excellent' | 'good' | 'adequate' | 'weak' | 'missing';
    gaps: string[];
    suggestions: string[];
  }[];
  readiness_level: 'draft' | 'review' | 'ready';
}

export interface Contradiction {
  id: string;
  type: 'direct' | 'implied' | 'temporal';
  questions: string[];
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolution_suggestions: string[];
}

export interface Recommendation {
  id: string;
  category: 'gap' | 'enhancement' | 'warning' | 'tip';
  title: string;
  description: string;
  related_questions?: string[];
  related_artifacts?: string[];
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
}

// ==========================================
// Event Types
// ==========================================

export type SpaceEvent =
  | { type: 'session:created'; session_id: string }
  | { type: 'session:resumed'; session_id: string }
  | { type: 'answer:submitted'; question_id: string; series_id: number }
  | { type: 'round:completed'; series_id: number; round: number }
  | { type: 'series:completed'; series_id: number }
  | { type: 'session:completed'; session_id: string }
  | { type: 'artifact:updated'; artifact_key: string; value: ArtifactValueContent }
  | { type: 'export:generated'; format: string; path: string }
  | { type: 'llm:refinement_complete'; question_id: string }
  | { type: 'error'; code: string; message: string };

// ==========================================
// Snapshot Types
// ==========================================

export interface Snapshot {
  id: string;
  session_id: string;
  project_id: string;
  created_at: string;
  trigger: 'round_complete' | 'series_complete' | 'manual' | 'auto';
  series_id: number;
  round: number;
  state: SessionState;
  size_bytes: number;
}

// ==========================================
// Storage Types
// ==========================================

export interface ProjectArchive {
  format_version: string;
  exported_at: string;
  project: Project;
  sessions: SessionState[];
  exports?: ExportResult[];
}
