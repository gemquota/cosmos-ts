// MyKB — Git-Backed Temporal History Engine (ported from temporal_engine.py)
// Auto-commits file changes with standardized timestamps.
// Provides 'time-travel' file retrieval and audit-log APIs.

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, isAbsolute, relative, resolve } from 'path';

// ── Types ──────────────────────────────────────────────────────

export interface CommitEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
  committedDate: number;
}

export interface SnapshotResult {
  file: string;
  timestamp: string;
  restoredFrom: string;
  committedAt: string;
  content: string;
  size: number;
}

export interface TemporalError {
  error: string;
}

export interface StatusResult {
  branch: string;
  lastCommit: string | null;
  staged: number;
  unstaged: number;
  untracked: number;
}

const COMMIT_AUTHOR = 'mykb-daemon <daemon@mykb.local>';

// ── TemporalEngine Class ──────────────────────────────────────

export class TemporalEngine {
  private repoPath: string;

  constructor(repoPath?: string) {
    this.repoPath = repoPath ?? process.cwd();
  }

  /**
   * Run a git command and return stdout.
   */
  private git(...args: string[]): string {
    try {
      return execSync(`git ${args.join(' ')}`, {
        cwd: this.repoPath,
        encoding: 'utf-8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch (e: unknown) {
      const err = e as { stderr?: string; stdout?: string; message?: string };
      throw new Error(err.stderr?.trim() || err.stdout?.trim() || String(err));
    }
  }

  /**
   * Check if the repo path is a git repository.
   */
  isRepo(): boolean {
    try {
      this.git('rev-parse', '--git-dir');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format current UTC time as ISO 8601.
   */
  formatTs(date?: Date): string {
    const d = date ?? new Date();
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  /**
   * Parse ISO 8601 or UNIX timestamp.
   */
  parseTs(tsStr: string): Date | null {
    // Try UNIX timestamp (number or float string)
    const num = Number(tsStr);
    if (!isNaN(num) && tsStr.match(/^\d+(\.\d+)?$/)) {
      const d = new Date(num * 1000);
      if (!isNaN(d.getTime())) return d;
    }

    // Try ISO 8601
    try {
      const d = new Date(tsStr.replace('Z', '+00:00'));
      if (!isNaN(d.getTime())) return d;
    } catch {
      // ignore
    }

    return null;
  }

  // ── Status Command ──────────────────────────────────────────

  cmdStatus(): StatusResult {
    if (!this.isRepo()) {
      throw new Error('Not a git repository');
    }

    const branch = this.git('rev-parse', '--abbrev-ref', 'HEAD');
    let lastCommit: string | null = null;
    try {
      const logOutput = this.git('log', '-1', '--format=%H %ai');
      if (logOutput) {
        const parts = logOutput.split(' ');
        lastCommit = parts[0]?.slice(0, 12) ?? null;
      }
    } catch {
      // No commits yet
    }

    const staged = this.git('diff', '--cached', '--name-only').split('\n').filter(Boolean).length;
    const unstaged = this.git('diff', '--name-only').split('\n').filter(Boolean).length;
    const untracked = this.git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean).length;

    return {
      branch,
      lastCommit,
      staged,
      unstaged,
      untracked,
    };
  }

  // ── Commit Command ──────────────────────────────────────────

  cmdCommit(targetPath?: string): string {
    if (!this.isRepo()) {
      throw new Error('Not a git repository');
    }

    const ts = this.formatTs();

    if (targetPath === '--all' || !targetPath) {
      // Stage all tracked changes + new files
      this.git('add', '-A');
      // Check if anything to commit
      const status = this.git('status', '--porcelain');
      if (status) {
        this.git('commit', '-m', `auto-commit: ${ts}`, '--author', COMMIT_AUTHOR);
        return `Committed all changes at ${ts}`;
      } else {
        return 'Nothing to commit';
      }
    } else {
      // Resolve path
      const absPath = isAbsolute(targetPath) ? targetPath : resolve(this.repoPath, targetPath);
      if (!existsSync(absPath)) {
        throw new Error(`File not found: ${targetPath}`);
      }
      const rel = relative(this.repoPath, absPath).replace(/\\/g, '/');
      this.git('add', rel);
      this.git('commit', '-m', `auto-commit [${rel}]: ${ts}`, '--author', COMMIT_AUTHOR);
      return `Committed ${rel} at ${ts}`;
    }
  }

  cmdCommitAll(): string {
    return this.cmdCommit('--all');
  }

  // ── History Command ─────────────────────────────────────────

  cmdHistory(filepath: string): CommitEntry[] | TemporalError {
    const absPath = isAbsolute(filepath) ? filepath : resolve(this.repoPath, filepath);
    const rel = relative(this.repoPath, absPath).replace(/\\/g, '/');

    if (!existsSync(absPath)) {
      return { error: `File not found: ${filepath}` };
    }

    try {
      const logOutput = this.git('log', '--follow', '--format=%H|%an <%ae>|%aI|%s|%ct', '--', rel);
      if (!logOutput) return [];

      const commits: CommitEntry[] = logOutput.split('\n').filter(Boolean).map((line) => {
        const [hash, author, date, ...msgParts] = line.split('|');
        return {
          hash: hash!.slice(0, 12),
          author: author ?? '',
          date: date ?? '',
          message: msgParts.join('|').trim(),
          committedDate: new Date(date ?? '').getTime() / 1000,
        };
      });

      return commits;
    } catch {
      return [];
    }
  }

  // ── Snapshot Command ────────────────────────────────────────

  cmdSnapshot(filepath: string, timestamp: string): SnapshotResult | TemporalError {
    const absPath = isAbsolute(filepath) ? filepath : resolve(this.repoPath, filepath);
    const rel = relative(this.repoPath, absPath).replace(/\\/g, '/');

    const dt = this.parseTs(timestamp);
    if (!dt) {
      return { error: `Invalid timestamp: ${timestamp}` };
    }

    if (!existsSync(absPath)) {
      return { error: `File not found: ${filepath}` };
    }

    const targetTs = dt.getTime() / 1000;

    try {
      // Get all commits for this file
      const logOutput = this.git('log', '--follow', '--format=%H|%ct', '--', rel);
      if (!logOutput) {
        return { error: 'No commits found for this file' };
      }

      const lines = logOutput.split('\n').filter(Boolean);
      let bestCommit = '';
      let bestDiff = Infinity;

      for (const line of lines) {
        const [hash, tsStr] = line.split('|');
        const commitTs = parseFloat(tsStr!);
        const diff = Math.abs(commitTs - targetTs);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestCommit = hash!;
        }
      }

      if (!bestCommit) {
        return { error: 'No commits found for this file' };
      }

      // Get file content at that commit
      const content = this.git('show', `${bestCommit}:${rel}`);
      const committedAt = this.git('log', '-1', '--format=%cI', bestCommit);

      return {
        file: rel,
        timestamp,
        restoredFrom: bestCommit.slice(0, 12),
        committedAt,
        content,
        size: content.length,
      };
    } catch (e) {
      return { error: String(e) };
    }
  }

  // ── Diff Command ───────────────────────────────────────────

  cmdDiff(filepath?: string): string {
    if (filepath) {
      const absPath = isAbsolute(filepath) ? filepath : resolve(this.repoPath, filepath);
      const rel = relative(this.repoPath, absPath).replace(/\\/g, '/');
      return this.git('diff', rel);
    } else {
      return this.git('diff');
    }
  }
}

// ── CLI Entry Point ────────────────────────────────────────────

export function runTemporalEngineCli(args: string[]): void {
  const engine = new TemporalEngine();

  if (args.length < 1) {
    const path = join(import.meta.url, '..');
    console.error(`Usage:
  node temporal_engine.js status        # show repo state
  node temporal_engine.js commit <path>  # commit a specific file
  node temporal_engine.js commit-all     # commit all changes
  node temporal_engine.js history <path>  # show file history
  node temporal_engine.js snapshot <path> <timestamp>  # get file at time`);
    return;
  }

  const cmd = args[0];

  try {
    switch (cmd) {
      case 'status': {
        const status = engine.cmdStatus();
        console.log(`Branch: ${status.branch}`);
        console.log(`Last commit: ${status.lastCommit ?? 'Repo initialized — no commits yet'}`);
        console.log(`Files changed: ${status.unstaged} unstaged, ${status.staged} staged`);
        console.log(`Untracked: ${status.untracked}`);
        break;
      }

      case 'commit': {
        const target = args[1] ?? '--all';
        const result = engine.cmdCommit(target);
        console.log(result);
        break;
      }

      case 'commit-all': {
        const result = engine.cmdCommitAll();
        console.log(result);
        break;
      }

      case 'history': {
        if (args.length < 2) {
          console.error('Usage: temporal_engine.js history <filepath>');
          return;
        }
        const result = engine.cmdHistory(args[1]);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'snapshot': {
        if (args.length < 3) {
          console.error('Usage: temporal_engine.js snapshot <filepath> <timestamp>');
          return;
        }
        const result = engine.cmdSnapshot(args[1], args[2]);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'diff': {
        const target = args[1] ?? undefined;
        const diff = engine.cmdDiff(target);
        if (diff) {
          console.log(diff);
        } else {
          console.log('No differences');
        }
        break;
      }

      default:
        console.error(`Unknown command: ${cmd}`);
    }
  } catch (e: unknown) {
    console.error(String(e));
  }
}

// If run directly
const isMain = process.argv[1]?.endsWith('temporal-engine.ts') || process.argv[1]?.endsWith('temporal-engine.js');
if (isMain) {
  runTemporalEngineCli(process.argv.slice(2));
}
