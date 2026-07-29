import type {
  SessionState,
  ArtifactDictionary,
  ExportFormat,
  ExportOptions,
  FrameworkDefinition,
} from '../types/index.js';
import { exportJSON } from './formatters/json-exporter.js';
import { exportMarkdown } from './formatters/markdown-exporter.js';
import { exportYAML } from './formatters/yaml-exporter.js';
import { exportPrompt } from './formatters/prompt-exporter.js';
import { exportHTML } from './formatters/html-exporter.js';
import { exportDiff as diffExporter } from './formatters/diff-exporter.js';

export interface ExportResult {
  content: string;
  filename: string;
  mime_type: string;
}

export interface ExportMeta {
  staleness?: {
    stale_artifacts: string[];
    current_artifacts: string[];
    affected_series: number[];
  };
}

/**
 * Detect which artifacts have been updated since last export.
 */
function computeStaleness(artifacts: ArtifactDictionary, session: SessionState): ExportMeta['staleness'] {
  const staleKeys: string[] = [];
  const currentKeys: string[] = [];
  const affectedSeries = new Set<number>();

  for (const [key, artifact] of Object.entries(artifacts)) {
    const answer = session.answers[artifact.source_question_id];
    if (answer && answer.edit_count > 0) {
      staleKeys.push(key);
      affectedSeries.add(artifact.source_series_id);
    } else {
      currentKeys.push(key);
    }
  }

  if (staleKeys.length === 0) return undefined;

  return {
    stale_artifacts: staleKeys,
    current_artifacts: currentKeys,
    affected_series: Array.from(affectedSeries).sort(),
  };
}

export function exportSession(
  session: SessionState,
  artifacts: ArtifactDictionary,
  framework: FrameworkDefinition,
  format: ExportFormat,
  project_name: string,
  opts: ExportOptions = {},
): ExportResult {
  // Attach staleness metadata for export formats that support it
  const staleness = opts.include_metadata !== false ? computeStaleness(artifacts, session) : undefined;

  switch (format) {
    case 'json':
      return exportJSON(session, artifacts, framework, project_name, opts, staleness);
    case 'markdown':
      return exportMarkdown(session, artifacts, framework, project_name, opts, staleness);
    case 'yaml':
      return exportYAML(session, artifacts, framework, project_name, opts, staleness);
    case 'prompt':
      return exportPrompt(session, artifacts, framework, project_name, opts, staleness);
    case 'html':
      return exportHTML(session, artifacts, framework, project_name, opts, staleness);
    default:
      throw new Error(`EXPORT_FAILED: Unknown format: ${format}`);
  }
}

export function exportDiff(
  sessionA: SessionState,
  sessionB: SessionState,
  framework: FrameworkDefinition,
  nameA?: string,
  nameB?: string,
): ExportResult {
  return diffExporter(sessionA, sessionB, framework, nameA, nameB);
}

export async function exportToFiles(
  session: SessionState,
  artifacts: ArtifactDictionary,
  framework: FrameworkDefinition,
  output_dir: string,
  formats: ExportFormat[],
  project_name: string,
  opts: ExportOptions = {},
): Promise<string[]> {
  const { writeFileSync, mkdirSync } = await import('fs');
  const { join } = await import('path');

  mkdirSync(output_dir, { recursive: true });

  const paths: string[] = [];
  for (const format of formats) {
    const result = exportSession(session, artifacts, framework, format, project_name, opts);
    const filePath = join(output_dir, result.filename);
    writeFileSync(filePath, result.content);
    paths.push(filePath);
  }

  return paths;
}
