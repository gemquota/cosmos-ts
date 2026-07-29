/**
 * Git-based checkpoint manager.
 * Deep port of Python checkpoint.py — preserves checkpoint-before-mutation invariant.
 */

import { createHash } from 'node:crypto';
import { execSync, ExecSyncOptions } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Checkpoint {
  hash: string;
  message: string;
  timestamp: string;
}

export class CheckpointManager {
  private repoRoot: string;
  private digestCache: Map<string, string> = new Map();

  constructor(repoRoot: string = '.') {
    this.repoRoot = path.resolve(repoRoot);
  }

  // ── git helpers ───────────────────────────────────────────────────

  private git(...args: string[]): { stdout: string; stderr: string; code: number } {
    try {
      const result = execSync(
        ['git', '-C', this.repoRoot, ...args].join(' '),
        { encoding: 'utf-8', timeout: 30_000 } as ExecSyncOptions,
      );
      const out = typeof result === 'string' ? result : result.toString();
      return { stdout: out.trim(), stderr: '', code: 0 };
    } catch (err: any) {
      const out = err.stdout ? (typeof err.stdout === 'string' ? err.stdout : err.stdout.toString()) : '';
      const errOut = err.stderr ? (typeof err.stderr === 'string' ? err.stderr : err.stderr.toString()) : '';
      return { stdout: out.trim(), stderr: errOut.trim(), code: err.status ?? 1 };
    }
  }

  ensureRepo(): void {
    const gitDir = path.join(this.repoRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      console.log(`Initialising git repository at ${this.repoRoot}`);
      this.git('init', '-b', 'main');
      this.git('config', 'user.email', 'rsis@localhost');
      this.git('config', 'user.name', 'RSIS');
    }
  }

  hasChanges(): boolean {
    const r = this.git('status', '--porcelain');
    return r.stdout.length > 0;
  }

  /** Create a git checkpoint (commit). Returns commit hash or null. */
  checkpoint(message: string = ''): string | null {
    this.ensureRepo();
    if (!this.hasChanges()) {
      return null;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const commitMsg = `rsis-checkpoint: ${message || 'pre-mutation'} [${timestamp}]`;

    this.git('add', '-A');
    const r = this.git('commit', '-m', commitMsg);
    if (r.code !== 0) {
      console.warn(`Checkpoint failed: ${r.stderr}`);
      return null;
    }

    const r2 = this.git('rev-parse', 'HEAD');
    const commitHash = r2.stdout;
    console.log(`Checkpoint created: ${commitHash.slice(0, 12)} — ${commitMsg}`);
    return commitHash;
  }

  /** Rollback to a specific commit. */
  rollback(commitHash: string): boolean {
    console.warn(`Rolling back to ${commitHash.slice(0, 12)}`);
    let r = this.git('checkout', commitHash, '--');
    if (r.code !== 0) {
      console.error(`Rollback checkout failed: ${r.stderr}`);
      return false;
    }
    r = this.git('reset', '--hard', commitHash);
    return r.code === 0;
  }

  /** Rollback to the most recent RSIS checkpoint. */
  rollbackLastCheckpoint(): boolean {
    const r = this.git('log', '--oneline', '-20', '--grep=rsis-checkpoint:');
    const commits = r.stdout.split('\n').filter(Boolean);
    if (commits.length === 0) {
      console.warn('No RSIS checkpoints found to rollback to.');
      return false;
    }
    const commitHash = commits[0].split(/\s+/)[0];
    return this.rollback(commitHash);
  }

  /** Return the most recent RSIS checkpoint hash. */
  latestCheckpoint(): string | null {
    const r = this.git('log', '--oneline', '-1', '--grep=rsis-checkpoint:', '--format=%H');
    return r.stdout || null;
  }

  // ── Digest verification ───────────────────────────────────────────

  sha256Digest(filePath: string): string {
    const absPath = path.resolve(this.repoRoot, filePath);
    const cached = this.digestCache.get(absPath);
    if (cached) return cached;

    const h = createHash('sha256');
    const data = fs.readFileSync(absPath);
    h.update(data);
    const digest = h.digest('hex');
    this.digestCache.set(absPath, digest);
    return digest;
  }

  verifyDigest(filePath: string, expected: string): boolean {
    const actual = this.sha256Digest(filePath);
    const ok = actual === expected;
    if (!ok) {
      console.error(
        `Digest mismatch for ${filePath}: expected=${expected.slice(0, 16)} got=${actual.slice(0, 16)}`,
      );
    }
    return ok;
  }

  /** Get list of checkpoint hashes for recovery */
  listCheckpoints(limit: number = 20): Checkpoint[] {
    const r = this.git('log', '--oneline', `-${limit}`, '--grep=rsis-checkpoint:', '--format=%H||%s');
    return r.stdout.split('\n').filter(Boolean).map(line => {
      const [hash, ...rest] = line.split('||');
      const msg = rest.join('||');
      return { hash, message: msg, timestamp: '' };
    });
  }
}
