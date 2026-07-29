import type { Project, SessionState, SessionSummary, Snapshot, ProjectArchive, ExportResult } from '../types/index.js';

export interface StorageProvider {
  // Project CRUD
  createProject(project: Project): void;
  getProject(project_id: string): Project | null;
  listProjects(): Project[];
  updateProject(project: Project): void;
  deleteProject(project_id: string): void;

  // Session CRUD
  createSession(session: SessionState): void;
  getSession(project_id: string, session_id: string): SessionState | null;
  updateSession(session: SessionState): void;
  deleteSession(project_id: string, session_id: string): void;
  listSessions(project_id: string): SessionSummary[];

  // Snapshots
  saveSnapshot(snapshot: Snapshot): void;
  getLatestSnapshot(session_id: string, project_id: string): Snapshot | null;
  listSnapshots(session_id: string, project_id: string): Snapshot[];

  // Exports
  saveExport(session_id: string, project_id: string, format: string, result: ExportResult): string;

  // Archives
  exportArchive(project_id: string): ProjectArchive | null;
  importArchive(archive: ProjectArchive): void;
}
