import yaml from 'js-yaml';
import type { SessionState, ArtifactDictionary, ExportOptions, FrameworkDefinition } from '../../types/index.js';
import type { ExportMeta } from '../index.js';

export function exportYAML(
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
      exported_at: new Date().toISOString(),
      session_status: session.session.status,
      completion_pct: session.session.estimated_completion_pct,
    },
    summary: {
      answered: Object.keys(session.answers).length,
      completion_pct: session.session.estimated_completion_pct,
    },
    answers: session.answers,
    artifacts,
  };

  if (staleness) {
    data.staleness = staleness;
  }

  return {
    content: yaml.dump(data, { indent: 2, lineWidth: 120, noRefs: true }),
    filename: `${project_name.replace(/\s+/g, '-').toLowerCase()}-specification.yaml`,
    mime_type: 'text/yaml',
  };
}
