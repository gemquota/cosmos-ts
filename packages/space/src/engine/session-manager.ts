import { randomUUID } from 'crypto';
import type { SessionState, SessionMeta, ProgressState, AnswerEntry, ArtifactDictionary } from '../types/index.js';

export function createSession(project_id: string, framework_version: string = '2.0.0'): SessionState {
  const now = new Date().toISOString();
  const session: SessionState = {
    session: {
      id: `sess_${randomUUID().slice(0, 8)}`,
      project_id,
      framework_version,
      created_at: now,
      updated_at: now,
      status: 'created',
      estimated_completion_pct: 0,
      total_time_ms: 0,
    },
    answers: {},
    progress: {
      completed_rounds: [],
      completed_series: [],
      current_series: 1,
      current_round: 1,
      blocked_on: [],
    },
    artifacts: {},
  };
  return session;
}

export function updateSessionTimestamp(session: SessionState): void {
  session.session.updated_at = new Date().toISOString();
}

export function markSessionRunning(session: SessionState): void {
  session.session.status = 'in_progress';
  updateSessionTimestamp(session);
}

export function markSessionCompleted(session: SessionState): void {
  session.session.status = 'completed';
  session.session.estimated_completion_pct = 100;
  updateSessionTimestamp(session);
}

export function markSessionPaused(session: SessionState): void {
  session.session.status = 'created';
  updateSessionTimestamp(session);
}

export function setAnswer(
  session: SessionState,
  question_id: string,
  series_id: number,
  round: number,
  open_ended_text: string,
  multi_choice_id?: string,
  multi_choice_text?: string,
): void {
  const existing = session.answers[question_id];
  session.answers[question_id] = {
    question_id,
    series_id,
    round,
    open_ended_text,
    multi_choice_id,
    multi_choice_text,
    answered_at: new Date().toISOString(),
    edit_count: existing ? existing.edit_count + 1 : 0,
  };
  updateSessionTimestamp(session);
}

export function isRoundComplete(
  session: SessionState,
  series_id: number,
  round: number,
  questionsInRound: number,
): boolean {
  let answered = 0;
  for (const key of Object.keys(session.answers)) {
    const parts = key.split('.');
    if (parseInt(parts[0]) === series_id && parseInt(parts[1]) === round) {
      answered++;
    }
  }
  return answered >= questionsInRound;
}

export function isSeriesComplete(session: SessionState, series_id: number, totalRounds: number): boolean {
  for (let r = 1; r <= totalRounds; r++) {
    const roundKey = `${series_id}-${r}`;
    if (!session.progress.completed_rounds.includes(roundKey)) {
      return false;
    }
  }
  return true;
}

export function completeRound(session: SessionState, series_id: number, round: number): void {
  const key = `${series_id}-${round}`;
  if (!session.progress.completed_rounds.includes(key)) {
    session.progress.completed_rounds.push(key);
  }
  updateSessionTimestamp(session);
}

export function completeSeries(session: SessionState, series_id: number): void {
  if (!session.progress.completed_series.includes(series_id)) {
    session.progress.completed_series.push(series_id);
  }
  updateSessionTimestamp(session);
}

export function computeCompletionPct(session: SessionState, totalRounds: number): number {
  return Math.round((session.progress.completed_rounds.length / totalRounds) * 100);
}

export function serializeSession(session: SessionState): string {
  return JSON.stringify(session, null, 2);
}

export function deserializeSession(json: string): SessionState {
  return JSON.parse(json) as SessionState;
}
