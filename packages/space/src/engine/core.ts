import { randomUUID } from 'crypto';
import type { SpaceConfig } from '../config/defaults.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import type {
  FrameworkDefinition,
  SessionState,
  QuestionContext,
  SubmitResult,
  ArtifactDictionary,
  ExportFormat,
  ExportResult,
  ProgressMetrics,
  SpaceEvent,
  Snapshot,
} from '../types/index.js';
import { loadFrameworkFromV1, validateFramework } from '../data/framework-loader.js';
import { accumulateArtifacts } from '../data/artifact-mapping.js';
import { ArtifactTracker } from '../data/artifact-tracker.js';
import {
  createSession,
  setAnswer,
  completeRound,
  completeSeries,
  markSessionRunning,
  markSessionCompleted,
  computeCompletionPct,
  serializeSession,
  deserializeSession,
  updateSessionTimestamp,
} from './session-manager.js';
import { getCurrentQuestion, advanceToNextQuestion, goToPreviousQuestion } from './question-router.js';
import { validateAnswer } from './validator.js';
import { computeProgressMetrics } from './progress.js';
import { SnapshotManager } from './snapshot-manager.js';
import type { StorageProvider } from '../storage/types.js';

type EventHandler = (event: SpaceEvent) => void;

export interface SpaceInstance {
  config: SpaceConfig;
  framework: FrameworkDefinition;
  sessions: Map<string, SessionState>;

  // Session lifecycle
  initProject(name: string, description?: string): { id: string; name: string };
  startSession(project_id: string): SessionState;
  resumeSession(session_id: string, project_id?: string): SessionState | null;

  // Question flow
  getCurrentQuestion(session_id: string): QuestionContext | null;
  submitAnswer(session_id: string, question_id: string, open_ended: string, choice_id: string): SubmitResult;
  skipQuestion(session_id: string, question_id: string, reason: string): void;

  // Queries
  getProgress(session_id: string): ProgressMetrics | null;
  getArtifacts(session_id: string): ArtifactDictionary;
  getStalenessReport(session_id: string): any;

  // Events
  on(event: string, handler: EventHandler): () => void;

  // Serialization
  saveSession(session_id: string): string;
  loadSession(json: string): SessionState;

  // Storage
  setStorageProvider(provider: StorageProvider): void;
}

export function createSpace(config?: Partial<SpaceConfig>): SpaceInstance {
  const merged = { ...DEFAULT_CONFIG, ...config };

  // Load framework
  const fwDir = merged.framework_dir;
  const altDir = '/data/data/com.termux/files/home/dev/space/prompt-framework';
  let framework: FrameworkDefinition;

  try {
    framework = loadFrameworkFromV1(fwDir);
  } catch {
    framework = loadFrameworkFromV1(altDir);
  }

  const validation = validateFramework(framework);
  if (!validation.valid) {
    throw new Error(`FRAMEWORK_INVALID: ${validation.errors.join('; ')}`);
  }

  const sessions = new Map<string, SessionState>();
  const eventHandlers = new Map<string, EventHandler[]>();
  const artifactTracker = new ArtifactTracker();
  let snapshotManager: SnapshotManager | null = null;

  function emit(event: SpaceEvent) {
    const handlers = eventHandlers.get(event.type) || [];
    for (const h of handlers) h(event);
  }

  const instance: SpaceInstance = {
    config: merged,
    framework,
    sessions,

    initProject(name: string, description?: string) {
      const id = `proj_${randomUUID().slice(0, 8)}`;
      return { id, name };
    },

    startSession(project_id: string): SessionState {
      const session = createSession(project_id, framework.meta.version);
      markSessionRunning(session);
      sessions.set(session.session.id, session);
      emit({ type: 'session:created', session_id: session.session.id });
      return session;
    },

    resumeSession(session_id: string, project_id?: string): SessionState | null {
      const session = sessions.get(session_id);
      if (!session) return null;

      // Version check: warn if framework version differs
      if (session.session.framework_version !== framework.meta.version) {
        console.warn(
          `[engine] Session framework v${session.session.framework_version} differs from current v${framework.meta.version}`,
        );
      }

      // Validate that the session's question IDs still exist in current framework
      const allQuestionIds = new Set<string>();
      for (const series of framework.series) {
        for (const round of series.rounds) {
          for (const q of round.open_ended) {
            allQuestionIds.add(q.id);
          }
        }
      }

      const invalidQuestions: string[] = [];
      for (const qid of Object.keys(session.answers)) {
        if (!allQuestionIds.has(qid)) {
          invalidQuestions.push(qid);
        }
      }

      if (invalidQuestions.length > 0) {
        console.warn(
          `[engine] Session has ${invalidQuestions.length} question(s) not in current framework (${invalidQuestions.slice(0, 3).join(', ')}${invalidQuestions.length > 3 ? '...' : ''})`,
        );
      }

      // Recompute artifacts from restored answers
      session.artifacts = accumulateArtifacts(session);

      markSessionRunning(session);
      emit({ type: 'session:resumed', session_id });
      return session;
    },

    getCurrentQuestion(session_id: string): QuestionContext | null {
      const session = sessions.get(session_id);
      if (!session) return null;
      return getCurrentQuestion(framework, session);
    },

    submitAnswer(session_id: string, question_id: string, open_ended: string, choice_id: string): SubmitResult {
      const session = sessions.get(session_id);
      if (!session) {
        return {
          accepted: false,
          artifacts_updated: [],
          round_completed: false,
          series_completed: false,
          session_completed: false,
        };
      }

      // Parse question ID to get series and round
      const parts = question_id.split('.');
      const seriesId = parseInt(parts[0]);
      const roundNum = parseInt(parts[1]);

      // Find the question for validation
      const series = framework.series.find((s) => s.id === seriesId);
      if (!series) {
        return {
          accepted: false,
          artifacts_updated: [],
          round_completed: false,
          series_completed: false,
          session_completed: false,
        };
      }

      const round = series.rounds.find((r) => r.round === roundNum);
      if (!round) {
        return {
          accepted: false,
          artifacts_updated: [],
          round_completed: false,
          series_completed: false,
          session_completed: false,
        };
      }

      const question = round.open_ended.find((q) => q.id === question_id);
      if (!question) {
        return {
          accepted: false,
          artifacts_updated: [],
          round_completed: false,
          series_completed: false,
          session_completed: false,
        };
      }

      // Validate
      const valResult = validateAnswer({ open_ended, choice_id }, question);
      if (!valResult.valid) {
        return {
          accepted: false,
          artifacts_updated: [],
          round_completed: false,
          series_completed: false,
          session_completed: false,
        };
      }

      // Find multi-choice text
      const selectedChoice = question.follow_up_choices.find((c) => c.id === choice_id);

      // Record previous artifact state for staleness detection
      const previousArtifacts = { ...session.artifacts };
      const previousKeys = new Set(Object.keys(previousArtifacts));

      // Set answer
      setAnswer(session, question_id, seriesId, roundNum, open_ended, choice_id, selectedChoice?.text);
      emit({ type: 'answer:submitted', question_id, series_id: seriesId });

      // Track the artifact change
      artifactTracker.recordUpdate(question_id, { open_ended, choice_id }, question_id);

      let round_completed = false;
      let series_completed = false;
      let session_completed = false;

      // Check if round is complete AFTER this answer
      const roundComplete = round.open_ended.every((oe) => {
        const key = oe.id;
        const ans = session.answers[key];
        return ans && ans.open_ended_text?.trim() && ans.multi_choice_id;
      });

      if (roundComplete) {
        completeRound(session, seriesId, roundNum);
        round_completed = true;
        emit({ type: 'round:completed', series_id: seriesId, round: roundNum });

        // Create snapshot on round completion
        if (snapshotManager) {
          snapshotManager.createSnapshot(session, 'round_complete', seriesId, roundNum);
        }

        // Check if series is complete
        if (series.x_rounds === roundNum) {
          completeSeries(session, seriesId);
          series_completed = true;
          emit({ type: 'series:completed', series_id: seriesId });

          // Create snapshot on series completion
          if (snapshotManager) {
            snapshotManager.createSnapshot(session, 'series_complete', seriesId, roundNum);
          }

          // Check if all series are complete
          if (seriesId === framework.series[framework.series.length - 1].id) {
            markSessionCompleted(session);
            session_completed = true;
            emit({ type: 'session:completed', session_id });
          }
        }
      }

      // Update artifacts
      session.artifacts = accumulateArtifacts(session);

      // Detect staleness: which artifact keys changed?
      const newKeys = Object.keys(session.artifacts);
      const staleKeys = newKeys.filter((k) => {
        const old = previousArtifacts[k];
        const cur = session.artifacts[k];
        if (!old) return false; // New artifact, not stale
        return JSON.stringify(old.value) !== JSON.stringify(cur.value);
      });

      if (staleKeys.length > 0) {
        emit({ type: 'artifact:updated', artifact_key: staleKeys.join(','), value: null });
      }

      // Update completion percentage
      session.session.estimated_completion_pct = computeCompletionPct(session, framework.meta.total_rounds);

      // Get next question AFTER round completion check
      let nextQuestion = null;
      if (!session_completed) {
        nextQuestion = advanceToNextQuestion(framework, session);
      }

      return {
        accepted: true,
        artifacts_updated: staleKeys.length > 0 ? staleKeys : newKeys,
        round_completed,
        series_completed,
        session_completed,
        next_question: nextQuestion || undefined,
      };
    },

    skipQuestion(session_id: string, question_id: string, reason: string): void {
      const session = sessions.get(session_id);
      if (!session) return;

      const parts = question_id.split('.');
      const seriesId = parseInt(parts[0]);
      const roundNum = parseInt(parts[1]);

      setAnswer(session, question_id, seriesId, roundNum, `[Skipped: ${reason}]`, undefined, undefined);
    },

    getProgress(session_id: string): ProgressMetrics | null {
      const session = sessions.get(session_id);
      if (!session) return null;
      return computeProgressMetrics(session, framework);
    },

    getArtifacts(session_id: string): ArtifactDictionary {
      const session = sessions.get(session_id);
      if (!session) return {};
      return session.artifacts;
    },

    getStalenessReport(session_id: string) {
      const session = sessions.get(session_id);
      if (!session) return null;
      const changedIds = Object.keys(session.answers).filter((qid) => session.answers[qid].edit_count > 0);
      return artifactTracker.detectStaleness(session.artifacts, changedIds);
    },

    on(event: string, handler: EventHandler) {
      const handlers = eventHandlers.get(event) || [];
      handlers.push(handler);
      eventHandlers.set(event, handlers);
      return () => {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      };
    },

    saveSession(session_id: string): string {
      const session = sessions.get(session_id);
      if (!session) throw new Error(`SESSION_NOT_FOUND: ${session_id}`);
      return serializeSession(session);
    },

    loadSession(json: string): SessionState {
      const session = deserializeSession(json);
      sessions.set(session.session.id, session);
      return session;
    },

    setStorageProvider(provider: StorageProvider) {
      snapshotManager = new SnapshotManager(provider, true);
    },
  };

  return instance;
}
