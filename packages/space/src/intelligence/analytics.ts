import type { SessionState } from '../types/index.js';

export interface SessionMetrics {
  session_id: string;
  timing: {
    total_minutes: number;
    fastest_series: number;
    slowest_series: number;
    avg_time_per_question_ms: number;
  };
  quality: {
    avg_answer_length: number;
    shortest_answer: string;
    longest_answer: string;
    total_answers: number;
  };
  patterns: {
    series_completion_order: number[];
    abandon_point?: { series_id: number; round: number };
  };
}

export function computeSessionMetrics(session: SessionState): SessionMetrics {
  const answers = Object.entries(session.answers);
  const totalMinutes = Math.round(session.session.total_time_ms / 60000);

  // Answer length stats
  let totalLength = 0;
  let shortest = { qid: '', len: Infinity };
  let longest = { qid: '', len: 0 };

  for (const [qid, answer] of answers) {
    const len = answer.open_ended_text?.length || 0;
    totalLength += len;
    if (len < shortest.len) shortest = { qid, len };
    if (len > longest.len) longest = { qid, len };
  }

  // Series completion order
  const seriesOrder = session.progress.completed_series.slice();

  // Abandon point (if session not completed)
  let abandonPoint: { series_id: number; round: number } | undefined;
  if (session.session.status !== 'completed') {
    abandonPoint = {
      series_id: session.progress.current_series || 1,
      round: session.progress.current_round || 1,
    };
  }

  return {
    session_id: session.session.id,
    timing: {
      total_minutes: totalMinutes,
      fastest_series: 1,
      slowest_series:
        session.progress.completed_series.length > 0
          ? session.progress.completed_series[session.progress.completed_series.length - 1]
          : 1,
      avg_time_per_question_ms: answers.length > 0 ? session.session.total_time_ms / answers.length : 0,
    },
    quality: {
      avg_answer_length: answers.length > 0 ? totalLength / answers.length : 0,
      shortest_answer: shortest.qid,
      longest_answer: longest.qid,
      total_answers: answers.length,
    },
    patterns: {
      series_completion_order: seriesOrder,
      abandon_point: abandonPoint,
    },
  };
}
