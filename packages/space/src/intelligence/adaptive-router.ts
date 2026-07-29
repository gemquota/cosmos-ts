import type { SessionState, FrameworkDefinition, ArtifactDictionary } from '../types/index.js';

export interface RoutingDecision {
  action: 'proceed' | 'skip' | 'clarify' | 'recommend_review';
  reason: string;
  suggestion?: string;
}

/**
 * Analyze routing given session state and artifacts.
 * Determines whether to proceed normally, skip a question,
 * request clarification, or recommend review of earlier answers.
 */
export function analyzeRouting(session: SessionState, framework: FrameworkDefinition): RoutingDecision[] {
  const decisions: RoutingDecision[] = [];

  // 1. Check if current series dependencies are met
  const { current_series } = session.progress;
  if (current_series !== null) {
    const seriesDef = framework.series.find((s) => s.id === current_series);
    if (seriesDef && seriesDef.depends_on.length > 0) {
      const missingDeps = seriesDef.depends_on.filter((depId) => !session.progress.completed_series.includes(depId));
      if (missingDeps.length > 0) {
        decisions.push({
          action: 'clarify',
          reason: `Series ${current_series} depends on series ${missingDeps.join(', ')} which ${missingDeps.length === 1 ? 'is' : 'are'} not yet completed`,
          suggestion: `Complete series ${missingDeps.join(', ')} before proceeding`,
        });
      }
    }
  }

  // 2. Check for repeated edit counts (stuck on a question)
  const highEditAnswers = Object.entries(session.answers).filter(([_, a]) => a.edit_count >= 3);
  if (highEditAnswers.length > 0) {
    decisions.push({
      action: 'recommend_review',
      reason: `${highEditAnswers.length} question(s) have been edited 3+ times, suggesting difficulty or uncertainty`,
      suggestion: 'Consider whether the question needs clarification or a fresh perspective',
    });
  }

  // 3. Check answer comprehensiveness
  const shortAnswers = Object.entries(session.answers).filter(
    ([_, a]) => a.open_ended_text.length < 10 && !a.open_ended_text.startsWith('[Skipped'),
  );
  if (shortAnswers.length > 0) {
    decisions.push({
      action: 'clarify',
      reason: `${shortAnswers.length} answer(s) are very short (< 10 chars) and may need elaboration`,
      suggestion: 'Expand short answers for better context in downstream questions',
    });
  }

  // 4. Check for skipped questions
  const skippedCount = Object.entries(session.answers).filter(([_, a]) =>
    a.open_ended_text.startsWith('[Skipped'),
  ).length;
  if (skippedCount > 0) {
    decisions.push({
      action: 'recommend_review',
      reason: `${skippedCount} question(s) were skipped and may leave gaps in the specification`,
      suggestion: 'Consider returning to skipped questions for completeness',
    });
  }

  // 5. Check for contradictions using artifact patterns
  const hasSoloTeam = session.artifacts['team_composition']?.value?.toString().toLowerCase().includes('solo');
  const hasScrum = session.artifacts['development_cadence']?.value?.toString().toLowerCase().includes('sprint');
  if (hasSoloTeam && hasScrum) {
    decisions.push({
      action: 'recommend_review',
      reason: 'Potential contradiction: solo developer with scrum/sprint methodology',
      suggestion: 'Consider Kanban for solo work or define a team for Scrum',
    });
  }

  return decisions;
}

/**
 * Determine whether a specific question should be skipped based on
 * previous answers and accumulated context.
 */
export function shouldSkipQuestion(
  questionId: string,
  session: SessionState,
  framework: FrameworkDefinition,
): RoutingDecision | null {
  // Parse question ID for series info
  const parts = questionId.split('.');
  const seriesId = parseInt(parts[0]);

  const seriesDef = framework.series.find((s) => s.id === seriesId);
  if (!seriesDef) return null;

  // Skip if series dependencies are not met
  if (seriesDef.depends_on.length > 0) {
    const missingDeps = seriesDef.depends_on.filter((depId) => !session.progress.completed_series.includes(depId));
    if (missingDeps.length > 0) {
      return {
        action: 'skip',
        reason: `Series ${seriesId} requires completing series ${missingDeps.join(', ')} first`,
      };
    }
  }

  // Skip if already answered
  if (session.answers[questionId]) {
    return {
      action: 'skip',
      reason: 'Question already answered',
    };
  }

  return null;
}
