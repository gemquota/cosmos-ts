import type {
  SessionState,
  ArtifactDictionary,
  CompletenessReport,
  Contradiction,
  Recommendation,
} from '../types/index.js';
import { scoreCompleteness } from './completeness-scorer.js';
import { detectContradictions } from './contradiction-detector.js';
import { computeSessionMetrics, type SessionMetrics } from './analytics.js';
import { generateRecommendations } from './recommendations.js';
import { analyzeRouting, shouldSkipQuestion, type RoutingDecision } from './adaptive-router.js';

export interface IntelligenceReport {
  metrics: SessionMetrics;
  completeness: CompletenessReport;
  contradictions: Contradiction[];
  recommendations: Recommendation[];
}

export function getIntelligenceReport(session: SessionState, artifacts: ArtifactDictionary): IntelligenceReport {
  return {
    metrics: computeSessionMetrics(session),
    completeness: scoreCompleteness(session, artifacts),
    contradictions: detectContradictions(session, artifacts),
    recommendations: generateRecommendations(session, artifacts),
  };
}

export { scoreCompleteness } from './completeness-scorer.js';
export { detectContradictions } from './contradiction-detector.js';
export { computeSessionMetrics } from './analytics.js';
export { generateRecommendations } from './recommendations.js';
export { analyzeRouting, shouldSkipQuestion } from './adaptive-router.js';
export type { SessionMetrics } from './analytics.js';
export type { RoutingDecision } from './adaptive-router.js';
