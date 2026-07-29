import type { SessionState, ArtifactDictionary, ExportOptions, FrameworkDefinition } from '../../types/index.js';
import type { ExportMeta } from '../index.js';

export function exportPrompt(
  session: SessionState,
  artifacts: ArtifactDictionary,
  framework: FrameworkDefinition,
  project_name: string,
  opts: ExportOptions = {},
  staleness?: ExportMeta['staleness'],
): { content: string; filename: string; mime_type: string } {
  const lines: string[] = [];

  lines.push(`You are generating a specification for: ${project_name}`);
  lines.push('');
  lines.push('## Context');
  lines.push(`Framework: ${framework.meta.name} v${framework.meta.version}`);
  lines.push(`Status: ${session.session.status} (${session.session.estimated_completion_pct}%)`);
  lines.push('');

  if (staleness && staleness.stale_artifacts.length > 0) {
    lines.push('⚠️ NOTE: Some answers have been updated since export.');
    lines.push('');
  }

  lines.push('## Answers');
  for (const [qid, answer] of Object.entries(session.answers).sort()) {
    lines.push(`### Question ${qid}`);
    lines.push(`Answer: ${answer.open_ended_text}`);
    if (answer.multi_choice_text) {
      lines.push(`Choice: ${answer.multi_choice_text}`);
    }
    lines.push('');
  }

  lines.push('## Artifacts');
  for (const [key, artifact] of Object.entries(artifacts)) {
    const isStale = staleness?.stale_artifacts.includes(key);
    lines.push(`- ${key}: ${JSON.stringify(artifact.value)}${isStale ? ' (STALE)' : ''}`);
  }
  lines.push('');

  lines.push('## Instructions');
  lines.push(
    'Using the answers and artifacts above, generate a complete, well-structured specification document for the project.',
  );
  lines.push(
    'Cover all 7 series dimensions: conceptual depth, ontology, semantics, procedures, technical specs, methodology, and operations.',
  );

  return {
    content: lines.join('\n'),
    filename: `${project_name.replace(/\s+/g, '-').toLowerCase()}-prompt.txt`,
    mime_type: 'text/plain',
  };
}
