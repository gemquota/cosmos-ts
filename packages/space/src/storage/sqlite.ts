import initSqlJs, { type Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Project, SessionState, SessionSummary, Snapshot, ProjectArchive, ExportResult } from '../types/index.js';
import type { StorageProvider } from './types.js';

function ensureDir(filePath: string) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT,
    updated_at TEXT,
    framework_version TEXT,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    status TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    project_id TEXT,
    data TEXT NOT NULL,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    format TEXT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  CREATE INDEX IF NOT EXISTS idx_snapshots_session ON snapshots(session_id);
  CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id);
  CREATE INDEX IF NOT EXISTS idx_exports_session ON exports(session_id);
`;

export class SQLiteStorage implements StorageProvider {
  private db: Database;
  private dbPath: string;

  private constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  static async create(dbPath: string): Promise<SQLiteStorage> {
    const SQL = await initSqlJs();
    let db: Database;

    if (existsSync(dbPath)) {
      const buffer = readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      ensureDir(dbPath);
      db = new SQL.Database();
    }

    const storage = new SQLiteStorage(db, dbPath);
    storage.db.run(SCHEMA_SQL);
    return storage;
  }

  private persist(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  // Project operations
  createProject(project: Project): void {
    this.db.run(
      'INSERT INTO projects (id, name, description, created_at, updated_at, framework_version, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        project.id,
        project.name,
        project.description || '',
        project.created_at,
        project.updated_at,
        project.framework_version || '',
        JSON.stringify(project),
      ],
    );
    this.persist();
  }

  getProject(project_id: string): Project | null {
    const result = this.db.exec('SELECT data FROM projects WHERE id = ?', [project_id]);
    if (!result.length || !result[0].values.length) return null;
    return JSON.parse(result[0].values[0][0] as string);
  }

  listProjects(): Project[] {
    const result = this.db.exec('SELECT data FROM projects ORDER BY created_at DESC');
    if (!result.length) return [];
    return result[0].values.map((row: any[]) => JSON.parse(row[0] as string));
  }

  updateProject(project: Project): void {
    project.updated_at = new Date().toISOString();
    this.db.run(
      'UPDATE projects SET name = ?, description = ?, updated_at = ?, framework_version = ?, data = ? WHERE id = ?',
      [
        project.name,
        project.description || '',
        project.updated_at,
        project.framework_version || '',
        JSON.stringify(project),
        project.id,
      ],
    );
    this.persist();
  }

  deleteProject(project_id: string): void {
    this.db.run('DELETE FROM exports WHERE project_id = ?', [project_id]);
    this.db.run('DELETE FROM snapshots WHERE project_id = ?', [project_id]);
    this.db.run('DELETE FROM sessions WHERE project_id = ?', [project_id]);
    this.db.run('DELETE FROM projects WHERE id = ?', [project_id]);
    this.persist();
  }

  // Session operations
  createSession(session: SessionState): void {
    this.db.run(
      'INSERT INTO sessions (id, project_id, data, created_at, updated_at, status) VALUES (?, ?, ?, ?, ?, ?)',
      [
        session.session.id,
        session.session.project_id,
        JSON.stringify(session),
        session.session.created_at,
        session.session.updated_at,
        session.session.status,
      ],
    );
    this.persist();
  }

  getSession(project_id: string, session_id: string): SessionState | null {
    const result = this.db.exec('SELECT data FROM sessions WHERE id = ? AND project_id = ?', [session_id, project_id]);
    if (!result.length || !result[0].values.length) return null;
    return JSON.parse(result[0].values[0][0] as string);
  }

  updateSession(session: SessionState): void {
    this.db.run('UPDATE sessions SET data = ?, updated_at = ?, status = ? WHERE id = ? AND project_id = ?', [
      JSON.stringify(session),
      session.session.updated_at,
      session.session.status,
      session.session.id,
      session.session.project_id,
    ]);
    this.persist();
  }

  deleteSession(project_id: string, session_id: string): void {
    this.db.run('DELETE FROM snapshots WHERE session_id = ? AND project_id = ?', [session_id, project_id]);
    this.db.run('DELETE FROM exports WHERE session_id = ? AND project_id = ?', [session_id, project_id]);
    this.db.run('DELETE FROM sessions WHERE id = ? AND project_id = ?', [session_id, project_id]);
    this.persist();
  }

  listSessions(project_id: string): SessionSummary[] {
    const result = this.db.exec('SELECT data FROM sessions WHERE project_id = ? ORDER BY created_at DESC', [
      project_id,
    ]);
    if (!result.length) return [];
    return result[0].values.map((row: any[]) => {
      const state: SessionState = JSON.parse(row[0] as string);
      return {
        session_id: state.session.id,
        status: state.session.status,
        completion_pct: state.session.estimated_completion_pct,
        created_at: state.session.created_at,
        updated_at: state.session.updated_at,
      };
    });
  }

  // Snapshot operations
  saveSnapshot(snapshot: Snapshot): void {
    const projectId = snapshot.project_id || '';
    this.db.run(
      'INSERT OR REPLACE INTO snapshots (id, session_id, project_id, data, created_at) VALUES (?, ?, ?, ?, ?)',
      [snapshot.id, snapshot.session_id, projectId, JSON.stringify(snapshot), snapshot.created_at],
    );
    this.persist();
  }

  getLatestSnapshot(session_id: string, project_id: string): Snapshot | null {
    const result = this.db.exec(
      'SELECT data FROM snapshots WHERE session_id = ? AND project_id = ? ORDER BY created_at DESC LIMIT 1',
      [session_id, project_id],
    );
    if (!result.length || !result[0].values.length) return null;
    return JSON.parse(result[0].values[0][0] as string);
  }

  listSnapshots(session_id: string, project_id: string): Snapshot[] {
    const result = this.db.exec(
      'SELECT data FROM snapshots WHERE session_id = ? AND project_id = ? ORDER BY created_at DESC',
      [session_id, project_id],
    );
    if (!result.length) return [];
    return result[0].values.map((row: any[]) => JSON.parse(row[0] as string));
  }

  // Export operations
  saveExport(session_id: string, project_id: string, format: string, result: ExportResult): string {
    const now = new Date().toISOString();
    this.db.run(
      'INSERT INTO exports (session_id, project_id, format, filename, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [session_id, project_id, format, result.filename, result.content, now],
    );
    this.persist();
    return `${project_id}/exports/${session_id}/${result.filename}`;
  }

  // Archive operations
  exportArchive(project_id: string): ProjectArchive | null {
    const project = this.getProject(project_id);
    if (!project) return null;

    const sessionsResult = this.db.exec('SELECT data FROM sessions WHERE project_id = ?', [project_id]);
    const sessions: SessionState[] = sessionsResult.length
      ? sessionsResult[0].values.map((row: any[]) => JSON.parse(row[0] as string))
      : [];

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

  // Utility
  close(): void {
    this.persist();
    this.db.close();
  }

  getDbPath(): string {
    return this.dbPath;
  }
}
