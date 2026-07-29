import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface GitConfig {
  autoCommit: boolean;
  commitMessagePrefix: string;
  branch: string;
  remote: string;
}

export interface GitStatus {
  isRepo: boolean;
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  lastCommit: string | null;
}

export interface GitCommitResult {
  hash: string;
  message: string;
  filesChanged: number;
}

const DEFAULT_CONFIG: GitConfig = {
  autoCommit: true,
  commitMessagePrefix: '[space]',
  branch: 'main',
  remote: 'origin',
};

export class GitIntegration {
  private config: GitConfig;
  private repoPath: string;

  constructor(repoPath: string, config: Partial<GitConfig> = {}) {
    this.repoPath = repoPath;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private run(command: string): string {
    try {
      return execSync(command, {
        cwd: this.repoPath,
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch {
      return '';
    }
  }

  isInitialized(): boolean {
    return existsSync(join(this.repoPath, '.git'));
  }

  init(): boolean {
    if (this.isInitialized()) return true;
    try {
      this.run('git init');
      this.run('git config user.email "space@recursive-improvement.dev"');
      this.run('git config user.name "SPACE Engine"');
      return true;
    } catch {
      return false;
    }
  }

  getStatus(): GitStatus {
    if (!this.isInitialized()) {
      return { isRepo: false, branch: '', dirty: false, ahead: 0, behind: 0, lastCommit: null };
    }

    const branch = this.run('git rev-parse --abbrev-ref HEAD') || 'main';
    const dirty = this.run('git status --porcelain') !== '';
    const aheadStr = this.run('git rev-list --count @{u}..HEAD 2>/dev/null') || '0';
    const behindStr = this.run('git rev-list --count HEAD..@{u} 2>/dev/null') || '0';
    const lastCommit = this.run('git log -1 --format="%H %s"') || null;

    return {
      isRepo: true,
      branch,
      dirty,
      ahead: parseInt(aheadStr, 10) || 0,
      behind: parseInt(behindStr, 10) || 0,
      lastCommit,
    };
  }

  stageAll(): void {
    this.run('git add -A');
  }

  stageFiles(files: string[]): void {
    for (const file of files) {
      this.run(`git add "${file}"`);
    }
  }

  /**
   * Get a summary of what changed in the working tree (for commit messages).
   */
  private getDiffSummary(): string {
    const diff = this.run('git diff --stat --cached');
    if (!diff) return '';
    const lines = diff.split('\n').filter(Boolean);
    // Return last line which has the summary: "X files changed, Y insertions(+), Z deletions(-)"
    return lines[lines.length - 1] || '';
  }

  commit(message: string): GitCommitResult | null {
    const status = this.getStatus();
    if (!status.isRepo) return null;

    this.stageAll();

    // Get diff summary for enriched commit message
    const diffSummary = this.getDiffSummary();
    const fullMessage = diffSummary
      ? `${this.config.commitMessagePrefix} ${message}\n\n${diffSummary}`
      : `${this.config.commitMessagePrefix} ${message}`;

    this.run(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`);

    const hash = this.run('git rev-parse --short HEAD');
    const filesChanged = this.run('git diff --stat HEAD~1 --name-only 2>/dev/null').split('\n').filter(Boolean).length;

    return { hash, message: fullMessage, filesChanged };
  }

  autoCommit(context: string, description: string): GitCommitResult | null {
    if (!this.config.autoCommit) return null;
    return this.commit(`${context}: ${description}`);
  }

  diff(compareTo = 'HEAD'): string {
    return this.run(`git diff ${compareTo}`);
  }

  diffStats(compareTo = 'HEAD'): string {
    return this.run(`git diff --stat ${compareTo}`);
  }

  log(count = 10): Array<{ hash: string; message: string; date: string }> {
    const output = this.run(`git log -${count} --format="%H|%s|%ai"`);
    if (!output) return [];

    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, message, date] = line.split('|');
        return { hash, message, date };
      });
  }

  createBranch(name: string): boolean {
    this.run(`git checkout -b ${name}`);
    return this.run('git rev-parse --abbrev-ref HEAD') === name;
  }

  push(remote?: string): boolean {
    const r = remote || this.config.remote;
    return this.run(`git push ${r}`) !== '';
  }

  pull(remote?: string): boolean {
    const r = remote || this.config.remote;
    return this.run(`git pull ${r}`) !== '';
  }

  stash(): boolean {
    return this.run('git stash') !== '';
  }

  stashPop(): boolean {
    return this.run('git stash pop') !== '';
  }

  tag(name: string, message?: string): boolean {
    const msg = message ? ` -m "${message}"` : '';
    return this.run(`git tag${msg} ${name}`) !== '';
  }

  getConfig(): GitConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<GitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export function createGitIntegration(repoPath: string, config?: Partial<GitConfig>): GitIntegration {
  const git = new GitIntegration(repoPath, config);
  if (!git.isInitialized()) {
    git.init();
  }
  return git;
}
