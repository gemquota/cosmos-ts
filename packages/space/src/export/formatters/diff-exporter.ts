import type { SessionState, ExportOptions, FrameworkDefinition } from '../../types/index.js';

export function exportDiff(
  sessionA: SessionState,
  sessionB: SessionState,
  framework: FrameworkDefinition,
  nameA: string = 'Session A',
  nameB: string = 'Session B',
): { content: string; filename: string; mime_type: string } {
  const lines: string[] = [];

  lines.push(`# Specification Diff: ${nameA} → ${nameB}`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  const allQuestionIds = new Set([...Object.keys(sessionA.answers), ...Object.keys(sessionB.answers)]);

  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const qid of allQuestionIds) {
    const ansA = sessionA.answers[qid];
    const ansB = sessionB.answers[qid];

    if (!ansA && ansB) {
      added.push(qid);
    } else if (ansA && !ansB) {
      removed.push(qid);
    } else if (ansA && ansB && ansA.open_ended_text !== ansB.open_ended_text) {
      changed.push(qid);
    }
  }

  lines.push(`## Summary`);
  lines.push(`- Changed: ${changed.length} answers`);
  lines.push(`- Added (only in ${nameB}): ${added.length}`);
  lines.push(`- Removed (only in ${nameA}): ${removed.length}`);
  lines.push('');

  if (changed.length > 0) {
    lines.push('## Changed Answers');
    lines.push('');
    lines.push(`| Question | ${nameA} | ${nameB} |`);
    lines.push('|----------|--------|--------|');
    for (const qid of changed) {
      const textA = sessionA.answers[qid]?.open_ended_text?.substring(0, 50) || '';
      const textB = sessionB.answers[qid]?.open_ended_text?.substring(0, 50) || '';
      lines.push(
        `| ${qid} | ${textA}${textA.length >= 50 ? '...' : ''} | ${textB}${textB.length >= 50 ? '...' : ''} |`,
      );
    }
    lines.push('');
  }

  if (added.length > 0) {
    lines.push(`## Added (only in ${nameB})`);
    for (const qid of added) {
      lines.push(`- ${qid}: ${sessionB.answers[qid]?.open_ended_text?.substring(0, 100) || ''}`);
    }
    lines.push('');
  }

  if (removed.length > 0) {
    lines.push(`## Removed (only in ${nameA})`);
    for (const qid of removed) {
      lines.push(`- ${qid}: ${sessionA.answers[qid]?.open_ended_text?.substring(0, 100) || ''}`);
    }
    lines.push('');
  }

  if (changed.length === 0 && added.length === 0 && removed.length === 0) {
    lines.push('*No differences found.*');
  }

  return {
    content: lines.join('\n'),
    filename: `specification-diff.md`,
    mime_type: 'text/markdown',
  };
}
