import type { SessionState, ProgressMetrics, FrameworkDefinition } from '../types/index.js';
import { getSeriesStatus, type SeriesStatus } from './dependency-resolver.js';

/**
 * Compute detailed progress metrics for a session
 */
export function computeProgressMetrics(session: SessionState, framework: FrameworkDefinition): ProgressMetrics {
  const totalQuestions = framework.series.reduce((acc, s) => {
    return acc + s.rounds.reduce((rAcc, r) => rAcc + r.open_ended.length, 0);
  }, 0);

  const answered = Object.keys(session.answers).length;

  const bySeries = framework.series.map((s) => {
    const status = getSeriesStatus(
      s,
      session.progress.completed_rounds,
      session.progress.completed_series,
      framework.series,
    );
    const completedRounds = s.rounds.filter((r) =>
      session.progress.completed_rounds.includes(`${s.id}-${r.round}`),
    ).length;
    const seriesQuestions = s.rounds.reduce((acc, r) => acc + r.open_ended.length, 0);
    const seriesAnswered = Object.keys(session.answers).filter((k) => k.startsWith(`${s.id}.`)).length;

    return {
      series_id: s.id,
      name: s.name,
      total_rounds: s.x_rounds,
      completed_rounds: completedRounds,
      total_questions: seriesQuestions,
      answered: seriesAnswered,
      completion_pct: seriesQuestions > 0 ? Math.round((seriesAnswered / seriesQuestions) * 100) : 0,
      status,
    };
  });

  const startedAt = session.session.created_at;
  const lastActivity = session.session.updated_at;
  const activeTime = session.session.total_time_ms;
  const avgTimePerQ = answered > 0 ? activeTime / answered : 0;
  const remaining = totalQuestions - answered;
  const estimatedRemaining = avgTimePerQ * remaining;

  return {
    session_id: session.session.id,
    overall: {
      total_questions: totalQuestions,
      answered,
      completion_pct: Math.round((answered / totalQuestions) * 100),
    },
    by_series: bySeries,
    timing: {
      started_at: startedAt,
      last_activity_at: lastActivity,
      active_time_ms: activeTime,
      estimated_remaining_ms: estimatedRemaining,
      avg_time_per_question_ms: avgTimePerQ,
    },
  };
}
