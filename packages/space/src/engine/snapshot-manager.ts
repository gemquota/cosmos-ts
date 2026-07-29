import { randomUUID } from 'crypto';
import type { SessionState, Snapshot } from '../types/index.js';
import type { StorageProvider } from '../storage/types.js';

/**
 * Manages automatic snapshot creation on round/series completion events.
 */
export class SnapshotManager {
  constructor(
    private storage: StorageProvider,
    private auto_snapshot: boolean = true,
  ) {}

  /**
   * Create a snapshot triggered by a round or series completion.
   */
  createSnapshot(
    session: SessionState,
    trigger: 'round_complete' | 'series_complete' | 'manual' | 'auto',
    series_id: number,
    round: number,
  ): Snapshot {
    const snapshot: Snapshot = {
      id: `snap_${randomUUID().slice(0, 8)}`,
      session_id: session.session.id,
      project_id: session.session.project_id,
      created_at: new Date().toISOString(),
      trigger,
      series_id,
      round,
      state: JSON.parse(JSON.stringify(session)),
      size_bytes: JSON.stringify(session).length,
    };

    if (this.auto_snapshot) {
      this.storage.saveSnapshot(snapshot);
    }

    return snapshot;
  }

  /**
   * Restore a session from a snapshot, recomputing artifacts.
   */
  restoreFromSnapshot(snapshot: Snapshot): SessionState {
    const restored = JSON.parse(JSON.stringify(snapshot.state));
    // Recompute artifacts from restored answers
    try {
      const { accumulateArtifacts } = require('../data/artifact-mapping.js');
      restored.artifacts = accumulateArtifacts(restored);
    } catch {
      // If accumulateArtifacts is not available, use stored artifacts
    }
    return restored;
  }

  /**
   * Get the latest snapshot for a session.
   */
  getLatest(session_id: string, project_id: string): Snapshot | null {
    return this.storage.getLatestSnapshot(session_id, project_id);
  }

  /**
   * List all snapshots for a session.
   */
  listSnapshots(session_id: string, project_id: string): Snapshot[] {
    return this.storage.listSnapshots(session_id, project_id);
  }

  /**
   * Recover session from the latest snapshot after corruption.
   */
  recover(session_id: string, project_id: string): SessionState | null {
    const snapshot = this.getLatest(session_id, project_id);
    if (!snapshot) return null;
    return this.restoreFromSnapshot(snapshot);
  }
}
