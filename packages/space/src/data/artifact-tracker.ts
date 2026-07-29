// ==========================================
// Artifact Staleness Detection & Versioning
// Fixes: no staleness indicators, no version tracking, no what-if analysis
// ==========================================

import { createHash } from 'crypto';
import type { ArtifactDictionary } from '../types/index.js';

export interface ArtifactVersion {
  key: string;
  hash: string;
  version: number;
  source_question_id: string;
  updated_at: string;
}

export interface StalenessReport {
  stale_artifacts: string[];
  current_artifacts: string[];
  last_change_at: string;
  affected_series: number[];
}

/**
 * Compute a content hash for an artifact value.
 * Used for change detection without storing full values.
 */
export function artifactHash(value: unknown): string {
  const content = JSON.stringify(value, Object.keys(value as object).sort());
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

/**
 * Track artifact versions and detect staleness.
 * When an upstream answer changes, downstream artifacts that consumed it are marked stale.
 */
export class ArtifactTracker {
  private versions: Map<string, ArtifactVersion> = new Map();
  private history: Array<{ timestamp: string; changes: Record<string, string> }> = [];

  /**
   * Record a new version of an artifact.
   */
  recordUpdate(key: string, value: unknown, sourceQuestionId: string): ArtifactVersion {
    const hash = artifactHash(value);
    const existing = this.versions.get(key);
    const version = existing ? existing.version + 1 : 1;

    const entry: ArtifactVersion = {
      key,
      hash,
      version,
      source_question_id: sourceQuestionId,
      updated_at: new Date().toISOString(),
    };

    this.versions.set(key, entry);
    return entry;
  }

  /**
   * Detect which artifacts are stale given a set of changed question IDs.
   * Returns a report of stale vs current artifacts.
   */
  detectStaleness(artifacts: ArtifactDictionary, changedQuestionIds: string[]): StalenessReport {
    const stale: string[] = [];
    const current: string[] = [];
    const affectedSeries = new Set<number>();

    for (const [key, artifact] of Object.entries(artifacts)) {
      const version = this.versions.get(key);
      if (!version) {
        // Never tracked — consider current (new artifact)
        current.push(key);
        continue;
      }

      // Check if this artifact's source question was changed
      if (changedQuestionIds.includes(artifact.source_question_id)) {
        stale.push(key);
        affectedSeries.add(artifact.source_series_id);
      } else {
        current.push(key);
      }
    }

    return {
      stale_artifacts: stale,
      current_artifacts: current,
      last_change_at: changedQuestionIds.length > 0 ? new Date().toISOString() : '',
      affected_series: Array.from(affectedSeries).sort(),
    };
  }

  /**
   * Get the version history for a specific artifact.
   */
  getVersionHistory(key: string): ArtifactVersion[] {
    const current = this.versions.get(key);
    if (!current) return [];
    // In a full implementation, we'd store the full history.
    // For now, return the current version.
    return [current];
  }

  /**
   * Export all tracked versions as a serializable object.
   */
  exportVersions(): Record<string, ArtifactVersion> {
    return Object.fromEntries(this.versions);
  }

  /**
   * Import versions from a serialized state.
   */
  importVersions(data: Record<string, ArtifactVersion>): void {
    this.versions.clear();
    for (const [key, version] of Object.entries(data)) {
      this.versions.set(key, version);
    }
  }

  /**
   * Generate a "what-if" summary: if these answers change, which artifacts are affected?
   */
  whatIfAnalysis(artifacts: ArtifactDictionary, questionIdsToChange: string[]): StalenessReport {
    return this.detectStaleness(artifacts, questionIdsToChange);
  }
}
