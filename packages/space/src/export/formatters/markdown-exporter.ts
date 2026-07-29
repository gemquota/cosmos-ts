import type {
  SessionState,
  ArtifactDictionary,
  ExportOptions,
  FrameworkDefinition,
  SeriesDefinition,
} from '../../types/index.js';
import type { ExportMeta } from '../index.js';

export function exportMarkdown(
  session: SessionState,
  artifacts: ArtifactDictionary,
  framework: FrameworkDefinition,
  project_name: string,
  opts: ExportOptions = {},
  staleness?: ExportMeta['staleness'],
): { content: string; filename: string; mime_type: string } {
  const lines: string[] = [];

  lines.push(`# ${project_name} — Specification Document`);
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Framework:** ${framework.meta.name} v${framework.meta.version}`);
  lines.push(`**Session:** ${session.session.id}`);
  lines.push(`**Status:** ${session.session.status} (${session.session.estimated_completion_pct}% complete)`);
  lines.push('');

  // Staleness warning
  if (staleness && staleness.stale_artifacts.length > 0) {
    lines.push('> ⚠️ **Staleness Warning:** Some artifacts have been updated since this export.');
    lines.push('> Run export again for the most current data.');
    lines.push('');
  }

  // Table of Contents
  lines.push('');
  lines.push('## Table of Contents');
  lines.push('');
  lines.push('- [Series Progress](#series-progress)');
  lines.push('- [Answers](#answers)');
  lines.push('- [Artifacts](#artifacts)');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Series progress
  lines.push('## Series Progress');
  lines.push('');
  lines.push('| Series | Rounds Complete | Status |');
  lines.push('|--------|:---------------:|:------:|');
  for (const series of framework.series) {
    const completedRounds = series.rounds.filter((r) =>
      session.progress.completed_rounds.includes(`${series.id}-${r.round}`),
    ).length;
    const status =
      completedRounds === series.rounds.length ? '✅ Complete' : completedRounds > 0 ? '🔄 In Progress' : '⏳ Pending';
    lines.push(`| ${series.id}. ${series.name} | ${completedRounds}/${series.rounds.length} | ${status} |`);
  }
  lines.push('');

  // Answers
  lines.push('## Answers');
  lines.push('');
  for (const series of framework.series) {
    const seriesAnswers = Object.entries(session.answers).filter(([id]) => id.startsWith(`${series.id}.`));
    if (seriesAnswers.length === 0) continue;

    lines.push(`### <a id="series-${series.id}"></a>Series ${series.id}: ${series.name}`);
    lines.push('');

    for (const [qid, answer] of seriesAnswers) {
      const question = series.rounds.flatMap((r) => r.open_ended).find((q) => q.id === qid);

      lines.push(`**Q${qid}:** ${question?.text || 'Unknown question'}`);
      lines.push('');
      lines.push(`> ${answer.open_ended_text}`);
      if (answer.multi_choice_text) {
        lines.push(`> *Choice: ${answer.multi_choice_text}*`);
      }
      lines.push('');
    }
  }

  // Artifacts
  if (opts.include_artifacts !== false) {
    lines.push('## Artifacts');
    lines.push('');
    lines.push('| Key | Value | Confidence |');
    lines.push('|-----|-------|:----------:|');
    for (const [key, artifact] of Object.entries(artifacts)) {
      const isStale = staleness?.stale_artifacts.includes(key);
      const marker = isStale ? ' ⚠️' : '';
      lines.push(`| ${key}${marker} | ${String(artifact.value).slice(0, 80)} | ${artifact.confidence} |`);
    }
    lines.push('');
  }

  return {
    content: lines.join('\n'),
    filename: `${project_name.replace(/\s+/g, '-').toLowerCase()}-specification.md`,
    mime_type: 'text/markdown',
  };
}
