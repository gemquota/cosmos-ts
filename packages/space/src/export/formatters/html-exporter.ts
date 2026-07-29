import type { SessionState, ArtifactDictionary, ExportOptions, FrameworkDefinition } from '../../types/index.js';
import type { ExportMeta } from '../index.js';

export function exportHTML(
  session: SessionState,
  artifacts: ArtifactDictionary,
  framework: FrameworkDefinition,
  project_name: string,
  opts: ExportOptions = {},
  staleness?: ExportMeta['staleness'],
): { content: string; filename: string; mime_type: string } {
  const items: string[] = [];

  items.push('<!DOCTYPE html>');
  items.push('<html lang="en">');
  items.push('<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">');
  items.push(`<title>${project_name} — Specification</title>`);
  items.push(`<style>
    body{font-family:system-ui,sans-serif;line-height:1.6;max-width:800px;margin:0 auto;padding:2rem;color:#e8eaf0;background:#0c0e14}
    h1{font-size:1.8rem;background:linear-gradient(135deg,#8aa8ff,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    h2{border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:.5rem;margin-top:2rem}
    .meta{color:#8b90a3;font-size:.9rem}
    .stale-warning{background:rgba(255,200,0,.1);border:1px solid rgba(255,200,0,.3);padding:1rem;border-radius:8px;margin:1rem 0}
    .answer{margin:1rem 0;padding:1rem;background:#181b27;border:1px solid rgba(255,255,255,.06);border-radius:8px}
    .answer-q{font-weight:600;margin-bottom:.5rem}
    .answer-text{color:#e8eaf0}
    .answer-choice{color:#8b90a3;font-style:italic;margin-top:.25rem}
    .artifact-table{width:100%;border-collapse:collapse;margin:1rem 0}
    .artifact-table th,.artifact-table td{text-align:left;padding:.5rem;border-bottom:1px solid rgba(255,255,255,.06)}
    .stale{color:#fbbf24}
    a{color:#6c8cff}
  details{margin:1rem 0;background:#181b27;border:1px solid rgba(255,255,255,.06);border-radius:8px}
  details summary{padding:.75rem 1rem;cursor:pointer;font-weight:600}
  details[open] summary{border-bottom:1px solid rgba(255,255,255,.06)}
  details .detail-body{padding:.75rem 1rem}
  </style></head><body>`);
  items.push(`<h1>${project_name}</h1>`);
  items.push(
    `<div class="meta">Framework: ${framework.meta.name} v${framework.meta.version} | Status: ${session.session.status} (${session.session.estimated_completion_pct}%)</div>`,
  );
  items.push(`<div class="meta">Session: ${session.session.id} | Generated: ${new Date().toISOString()}</div>`);

  if (staleness && staleness.stale_artifacts.length > 0) {
    items.push(
      '<div class="stale-warning" role="alert">⚠️ <strong>Staleness Warning:</strong> Some artifacts have been updated since export. Run export again for the most current data.</div>',
    );
  }

  // Series progress
  items.push('<h2>Series Progress</h2>');
  items.push('<table class="artifact-table"><tr><th>Series</th><th>Progress</th><th>Status</th></tr>');
  for (const series of framework.series) {
    const completedRounds = series.rounds.filter((r) =>
      session.progress.completed_rounds.includes(`${series.id}-${r.round}`),
    ).length;
    const status =
      completedRounds === series.rounds.length ? '✅ Complete' : completedRounds > 0 ? '🔄 In Progress' : '⏳ Pending';
    items.push(
      `<tr><td>${series.id}. ${series.name}</td><td>${completedRounds}/${series.rounds.length}</td><td>${status}</td></tr>`,
    );
  }
  items.push('</table>');

  // Answers
  items.push('<h2 id="answers">Answers</h2>');
  for (const [qid, answer] of Object.entries(session.answers).sort()) {
    items.push(`<div class="answer"><div class="answer-q">Q${qid}</div>`);
    items.push(`<div class="answer-text">${escapeHtml(answer.open_ended_text)}</div>`);
    if (answer.multi_choice_text) {
      items.push(`<div class="answer-choice">→ ${escapeHtml(answer.multi_choice_text)}</div>`);
    }
    items.push('</div>');
  }

  // Artifacts
  items.push('<h2>Artifacts</h2>');
  items.push('<table class="artifact-table"><tr><th>Key</th><th>Value</th><th>Confidence</th></tr>');
  for (const [key, artifact] of Object.entries(artifacts)) {
    const isStale = staleness?.stale_artifacts.includes(key);
    const cls = isStale ? ' class="stale"' : '';
    items.push(
      `<tr${cls}><td>${key}${isStale ? ' ⚠️' : ''}</td><td>${escapeHtml(String(artifact.value)).slice(0, 100)}</td><td>${artifact.confidence}</td></tr>`,
    );
  }
  items.push('</table>');

  items.push('</body></html>');

  return {
    content: items.join('\n'),
    filename: `${project_name.replace(/\s+/g, '-').toLowerCase()}-specification.html`,
    mime_type: 'text/html',
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
