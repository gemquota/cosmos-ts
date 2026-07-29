import type {
  FrameworkDefinition,
  SeriesDefinition,
  RoundDefinition,
  OpenEndedQuestion,
  QuestionContext,
  SessionState,
} from '../types/index.js';

/**
 * Get the current question context for a session
 */
export function getCurrentQuestion(framework: FrameworkDefinition, session: SessionState): QuestionContext | null {
  const currentSeries = session.progress.current_series;
  const currentRound = session.progress.current_round;

  if (!currentSeries || !currentRound) return null;

  const series = framework.series.find((s) => s.id === currentSeries);
  if (!series) return null;

  const round = series.rounds.find((r) => r.round === currentRound);
  if (!round) return null;

  // Find first unanswered question in this round
  const unanswered = round.open_ended.find((oe) => {
    const key = oe.id;
    const ans = session.answers[key];
    return !ans || !ans.open_ended_text?.trim() || !ans.multi_choice_id;
  });

  if (!unanswered) return null; // Round is complete

  return {
    question: unanswered,
    series_id: series.id,
    series_name: series.name,
    round: round.round,
    round_focus: round.focus,
    total_rounds: series.x_rounds,
    context_template: unanswered.context_template,
    artifacts_used: [],
  };
}

/**
 * Advance to the next question in the session
 * Returns the next QuestionContext or null if session is complete
 */
export function advanceToNextQuestion(framework: FrameworkDefinition, session: SessionState): QuestionContext | null {
  const currentSeries = session.progress.current_series;
  const currentRound = session.progress.current_round;

  if (!currentSeries || !currentRound) return null;

  const series = framework.series.find((s) => s.id === currentSeries);
  if (!series) return null;

  const round = series.rounds.find((r) => r.round === currentRound);
  if (!round) return null;

  // Check if there are more unanswered questions in current round
  const nextUnanswered = round.open_ended.find((oe) => {
    const key = oe.id;
    const ans = session.answers[key];
    return !ans || !ans.open_ended_text?.trim() || !ans.multi_choice_id;
  });

  if (nextUnanswered) {
    // Stay in current round
    session.progress.current_series = currentSeries;
    session.progress.current_round = currentRound;
    return getCurrentQuestion(framework, session);
  }

  // Current round is complete, advance to next round
  if (currentRound < series.x_rounds) {
    session.progress.current_round = currentRound + 1;
    session.progress.last_question_id = undefined;
    return getCurrentQuestion(framework, session);
  }

  // Current series is complete, find next available series
  const nextSeries = findNextSeries(framework, session);
  if (nextSeries) {
    session.progress.current_series = nextSeries.id;
    session.progress.current_round = 1;
    session.progress.last_question_id = undefined;
    return getCurrentQuestion(framework, session);
  }

  // No more series — session complete
  return null;
}

/**
 * Find the next series that should be worked on
 */
function findNextSeries(framework: FrameworkDefinition, session: SessionState): SeriesDefinition | null {
  for (const series of framework.series) {
    if (session.progress.completed_series.includes(series.id)) continue;

    // Check if dependencies are met
    const depsMet = series.depends_on.every((depId) => {
      const dep = framework.series.find((s) => s.id === depId);
      if (!dep) return false;
      return dep.rounds.every((r) => session.progress.completed_rounds.includes(`${depId}-${r.round}`));
    });

    if (depsMet) return series;
  }
  return null;
}

/**
 * Go back to the previous question
 */
export function goToPreviousQuestion(framework: FrameworkDefinition, session: SessionState): QuestionContext | null {
  const currentSeries = session.progress.current_series;
  const currentRound = session.progress.current_round;

  if (!currentSeries || !currentRound) return null;

  const series = framework.series.find((s) => s.id === currentSeries);
  if (!series) return null;

  const round = series.rounds.find((r) => r.round === currentRound);
  if (!round) return null;

  // Find last answered question in current round
  const answeredInReverse = [...round.open_ended].reverse();
  const lastAnswered = answeredInReverse.find((oe) => {
    const key = oe.id;
    return session.answers[key];
  });

  if (lastAnswered) {
    return {
      question: lastAnswered,
      series_id: series.id,
      series_name: series.name,
      round: round.round,
      round_focus: round.focus,
      total_rounds: series.x_rounds,
      artifacts_used: [],
    };
  }

  // Go to previous round
  if (currentRound > 1) {
    session.progress.current_round = currentRound - 1;
    return getCurrentQuestion(framework, session);
  }

  // Go to previous series
  const prevSeriesIdx = framework.series.findIndex((s) => s.id === currentSeries);
  if (prevSeriesIdx > 0) {
    const prevSeries = framework.series[prevSeriesIdx - 1];
    session.progress.current_series = prevSeries.id;
    session.progress.current_round = prevSeries.x_rounds;
    return getCurrentQuestion(framework, session);
  }

  return null;
}
