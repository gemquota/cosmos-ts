import type {
  SessionState,
  ArtifactDictionary,
  ExportFormat,
  ExportOptions,
  FrameworkDefinition,
} from '../../types/index.js';
import type { ExportMeta } from '../index.js';

export function exportJSON(
  session: SessionState,
  artifacts: ArtifactDictionary,
  framework: FrameworkDefinition,
  project_name: string,
  opts: ExportOptions = {},
  staleness?: ExportMeta['staleness'],
): { content: string; filename: string; mime_type: string } {
  const data: Record<string, any> = {
    meta: {
      project_name,
      framework_version: framework.meta.version,
      framework_name: framework.meta.name,
      exported_at: new Date().toISOString(),
      session_status: session.session.status,
      completion_pct: session.session.estimated_completion_pct,
    },
    session: {
      id: session.session.id,
      project_id: session.session.project_id,
      created_at: session.session.created_at,
      status: session.session.status,
    },
    summary: {
      total_questions: framework.meta.total_open_ended,
      total_multi_choice: framework.meta.total_multi_choice,
      answered: Object.keys(session.answers).length,
      completion_pct: session.session.estimated_completion_pct,
    },
    answers: session.answers,
    artifacts,
  };

  if (staleness) {
    data.staleness = staleness;
    data.warnings =
      staleness.stale_artifacts.length > 0
        ? [
            `${staleness.stale_artifacts.length} artifact(s) have been updated since export. Run export again for current data.`,
          ]
        : [];
  }

  return {
    content: JSON.stringify(data, null, 2),
    filename: `${project_name.replace(/\s+/g, '-').toLowerCase()}-specification.json`,
    mime_type: 'application/json',
  };
}
