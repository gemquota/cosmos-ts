import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import type { Project, SessionState, SessionSummary, Snapshot, ProjectArchive, ExportResult } from '../types/index.js';
import type { StorageProvider } from './types.js';

function ensureDir(filePath: string) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export class FileSystemStorage implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true });
  }

  // Project operations
  createProject(project: Project): void {
    const dir = this.projectDir(project.id);
    mkdirSync(join(dir, 'sessions'), { recursive: true });
    mkdirSync(join(dir, 'exports'), { recursive: true });
    writeFileSync(join(dir, '.space.json'), JSON.stringify(project, null, 2));
  }

  getProject(project_id: string): Project | null {
    const path = join(this.projectDir(project_id), '.space.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  listProjects(): Project[] {
    if (!existsSync(this.baseDir)) return [];
    return readdirSync(this.baseDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => this.getProject(e.name))
      .filter(Boolean) as Project[];
  }

  updateProject(project: Project): void {
    const updated = { ...project, updated_at: new Date().toISOString() };
    writeFileSync(join(this.projectDir(project.id), '.space.json'), JSON.stringify(updated, null, 2));
  }

  deleteProject(project_id: string): void {
    const dir = this.projectDir(project_id);
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  }

  // Session operations
  createSession(session: SessionState): void {
    const dir = this.sessionDir(session.session.project_id, session.session.id);
    ensureDir(join(dir, 'state.json'));
    mkdirSync(join(dir, 'snapshots'), { recursive: true });
    writeFileSync(join(dir, 'state.json'), JSON.stringify(session, null, 2));
  }

  getSession(project_id: string, session_id: string): SessionState | null {
    const path = join(this.sessionDir(project_id, session_id), 'state.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  updateSession(session: SessionState): void {
    const path = join(this.sessionDir(session.session.project_id, session.session.id), 'state.json');
    ensureDir(path);
    writeFileSync(path, JSON.stringify(session, null, 2));
  }

  deleteSession(project_id: string, session_id: string): void {
    const dir = this.sessionDir(project_id, session_id);
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  }

  listSessions(project_id: string): SessionSummary[] {
    const sessionsDir = join(this.projectDir(project_id), 'sessions');
    if (!existsSync(sessionsDir)) return [];
    return readdirSync(sessionsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const statePath = join(sessionsDir, e.name, 'state.json');
        if (!existsSync(statePath)) return null;
        const state: SessionState = JSON.parse(readFileSync(statePath, 'utf-8'));
        return {
          session_id: state.session.id,
          status: state.session.status,
          completion_pct: state.session.estimated_completion_pct,
          created_at: state.session.created_at,
          updated_at: state.session.updated_at,
        };
      })
      .filter(Boolean) as SessionSummary[];
  }

  // Snapshot operations
  saveSnapshot(snapshot: Snapshot): void {
    const project_id = snapshot.project_id || this.findProjectForSession(snapshot.session_id);
    if (!project_id) {
      const fallbackDir = join(this.baseDir, '_snapshots', snapshot.session_id);
      ensureDir(join(fallbackDir, `${snapshot.id}.json`));
      writeFileSync(join(fallbackDir, `${snapshot.id}.json`), JSON.stringify(snapshot, null, 2));
      return;
    }
    const dir = this.snapshotDir(snapshot.session_id, project_id);
    ensureDir(join(dir, `${snapshot.id}.json`));
    writeFileSync(join(dir, `${snapshot.id}.json`), JSON.stringify(snapshot, null, 2));
  }

  getLatestSnapshot(session_id: string, project_id: string): Snapshot | null {
    const dir = this.snapshotDir(session_id, project_id);
    if (!existsSync(dir)) return null;
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ name: f, mtime: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .map((f) => f.name);
    if (files.length === 0) return null;
    return JSON.parse(readFileSync(join(dir, files[0]), 'utf-8'));
  }

  listSnapshots(session_id: string, project_id: string): Snapshot[] {
    const dir = this.snapshotDir(session_id, project_id);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')));
  }

  // Export operations
  saveExport(session_id: string, project_id: string, format: string, result: ExportResult): string {
    const dir = join(this.projectDir(project_id), 'exports', session_id);
    ensureDir(join(dir, result.filename));
    writeFileSync(join(dir, result.filename), result.content);
    return join(dir, result.filename);
  }

  // Archive operations
  exportArchive(project_id: string): ProjectArchive | null {
    const project = this.getProject(project_id);
    if (!project) return null;

    const sessions = this.listSessions(project_id)
      .map((s) => this.getSession(project_id, s.session_id))
      .filter((s): s is SessionState => s !== null);

    return {
      format_version: '2.0.0',
      exported_at: new Date().toISOString(),
      project,
      sessions,
    };
  }

  importArchive(archive: ProjectArchive): void {
    this.createProject(archive.project);
    for (const session of archive.sessions) {
      this.createSession(session);
    }
  }

  // Path helpers
  private projectDir(project_id: string): string {
    return join(this.baseDir, project_id);
  }

  private sessionDir(project_id: string, session_id: string): string {
    return join(this.projectDir(project_id), 'sessions', session_id);
  }

  private snapshotDir(session_id: string, project_id?: string): string {
    if (project_id) {
      return join(this.sessionDir(project_id, session_id), 'snapshots');
    }
    const found = this.findProjectForSession(session_id);
    if (found) {
      return join(this.sessionDir(found, session_id), 'snapshots');
    }
    return join(this.baseDir, '_snapshots', session_id);
  }

  private findProjectForSession(session_id: string): string | null {
    for (const p of this.listProjects()) {
      const dir = join(this.projectDir(p.id), 'sessions', session_id);
      if (existsSync(dir)) return p.id;
    }
    return null;
  }
}

/**
 * Auto-save manager — triggers saves at intervals and on events
 */
export class AutoSaveManager {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private storage: StorageProvider,
    private session: () => SessionState | null,
    private intervalMs: number = 10000,
  ) {}

  start(): void {
    this.interval = setInterval(() => {
      const s = this.session();
      if (s && s.session.status === 'in_progress') {
        this.storage.updateSession(s);
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
  }

  saveNow(): void {
    const s = this.session();
    if (s) this.storage.updateSession(s);
  }
}
