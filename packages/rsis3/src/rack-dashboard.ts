/**
 * Telemetry Dashboard Builder — loads pulse data and generates dashboard HTML.
 *
 * TypeScript port of rack/build_dashboard.py.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Types ──

export interface PulseSummary {
  tot: number;
  pass: number;
  hold: number;
  fail: number;
  impl_count: number;
  ca: number;
  pulse_count: number;
  cd: Record<string, { freq: number; locked: number }>;
}

export interface PulseEntry {
  id: string;
  ts_start: string;
  ts_end: string;
  goals_count: number;
  approved: number;
  duration: number;
  scores: Record<string, unknown>;
  type: string;
  num_goals: number;
  implementation_count: number;
  telemetry: Record<string, unknown>;
  avg_confidence: number;
}

export interface GoalEntry {
  p: string; // pulse id
  d: string; // description
  dec: string; // decision
  conf: number;
  file: string;
  func: string;
  type: string;
  conversation: Array<{ q: string; a: string; r: number }>;
  constraints: Record<string, string>;
  telemetry: Record<string, unknown>;
  contradictions: Array<unknown>;
}

export interface DashboardData {
  pulses: PulseEntry[];
  goals: GoalEntry[];
  score_history: Record<string, Record<string, unknown>>;
  telemetry_aggregates: Record<string, Record<string, unknown>>;
  summary: PulseSummary;
}

// ── loadPulseData ──

export function loadPulseData(pulsesDir: string): DashboardData {
  const allPulses: PulseEntry[] = [];
  const allGoals: GoalEntry[] = [];
  const scoreHistory: Record<string, Record<string, unknown>> = {};
  const telemetryAggregates: Record<string, Record<string, unknown>> = {};
  const constraintCounts: Record<string, { freq: number; locked: number }> = {};
  let totalPass = 0;
  let totalHold = 0;
  let totalFail = 0;
  let totalImpl = 0;

  let files: string[];
  try {
    files = fs.readdirSync(pulsesDir);
  } catch {
    files = [];
  }

  for (const fname of files.sort()) {
    if (!fname.endsWith('.json') || !fname.startsWith('pulse-')) {
      continue;
    }

    let p: Record<string, unknown>;
    try {
      p = JSON.parse(
        fs.readFileSync(path.join(pulsesDir, fname), 'utf-8'),
      );
    } catch {
      continue;
    }

    const pid = String(p['pulse']);
    const post = (p['post_state'] as Record<string, unknown>) ?? {};
    const scores = (post['scores'] as Record<string, unknown>) ?? {};
    scoreHistory[pid] = scores;
    const pulseGoals = (p['goals'] as Array<Record<string, unknown>>) ?? [];
    const rrpTel = (p['rrp_telemetry_aggregate'] as Record<string, unknown>) ?? {};
    telemetryAggregates[pid] = rrpTel;

    const implCount = pulseGoals.filter((g) => {
      if (g.type === 'implementation') return true;
      const ev = g['rrp_evaluation'] as Record<string, unknown> | undefined;
      const trace = ev?.['trace'] as Record<string, unknown> | undefined;
      const ga = trace?.['goal_analysis'] as Record<string, unknown> | undefined;
      return ga?.['goal_type'] === 'implementation';
    }).length;
    totalImpl += implCount;

    const approved = pulseGoals.filter(
      (g) =>
        ((g['rrp_evaluation'] as Record<string, unknown>)?.['decision']) ===
        'PASS',
    ).length;

    const telQualityIndex = (rrpTel['avg_quality_index'] as number) ?? 0;
    const avgConf = telQualityIndex !== 0
      ? telQualityIndex
      : Math.round(
          (pulseGoals.reduce((sum, g) => {
            const ev = g['rrp_evaluation'] as Record<string, unknown>;
            return sum + ((ev['confidence'] as number) ?? 0);
          }, 0) /
            Math.max(pulseGoals.length, 1)) *
            1000,
        ) / 1000;

    allPulses.push({
      id: pid,
      ts_start: (p['timestamp_start'] as string) ?? '',
      ts_end: (p['timestamp_end'] as string) ?? '',
      goals_count: pulseGoals.length,
      approved,
      duration:
        ((p['summary'] as Record<string, unknown>)?.['duration_seconds'] as number) ?? 0,
      scores,
      type: (p['type'] as string) ?? 'standard',
      num_goals:
        ((p['summary'] as Record<string, unknown>)?.['goals_generated'] as number) ??
        pulseGoals.length,
      implementation_count: implCount,
      telemetry: rrpTel,
      avg_confidence: avgConf,
    });

    for (const g of pulseGoals) {
      const ev = (g['rrp_evaluation'] as Record<string, unknown>) ?? {};
      const dec = (ev['decision'] as string) ?? 'UNKNOWN';
      if (dec === 'PASS') totalPass++;
      else if (dec === 'HOLD') totalHold++;
      else if (dec === 'FAIL' || dec === 'DISMISS') totalFail++;

      const trace = (ev['trace'] as Record<string, unknown>) ?? {};
      const constraintExtraction =
        (trace['constraint_extraction'] as Record<string, unknown>) ?? {};
      const constraints =
        (constraintExtraction['constraints'] as Record<string, string>) ?? {};

      for (const [cname, ctype] of Object.entries(constraints)) {
        if (!constraintCounts[cname]) {
          constraintCounts[cname] = { freq: 0, locked: 0 };
        }
        constraintCounts[cname].freq++;
        if (ctype === 'LOCKED' || ctype === 'REQUIRED') {
          constraintCounts[cname].locked++;
        }
      }

      const conversation =
        (ev['conversation'] as Array<Record<string, unknown>>) ?? [];
      const rrpTelG =
        (ev['rrp_telemetry'] as Record<string, unknown>) ?? {};

      allGoals.push({
        p: pid,
        d: (g['description'] as string) ?? '',
        dec,
        conf: (ev['confidence'] as number) ?? 0,
        file: (g['file'] as string) ?? '',
        func: (g['function'] as string) ?? '',
        type:
          (g['type'] as string) ??
          ((trace['goal_analysis'] as Record<string, unknown>)?.['goal_type'] as string) ??
          'implementation',
        conversation: conversation.map((c) => ({
          q: (c['question'] as string) ?? '',
          a: (c['answer'] as string) ?? '',
          r: (c['round'] as number) ?? 1,
        })),
        constraints,
        telemetry: rrpTelG,
        contradictions: (ev['contradictions'] as Array<unknown>) ?? [],
      });
    }
  }

  const summary: PulseSummary = {
    tot: totalPass + totalHold + totalFail,
    pass: totalPass,
    hold: totalHold,
    fail: totalFail,
    impl_count: totalImpl,
    ca:
      allGoals.length > 0
        ? Math.round(
            (allGoals.reduce((sum, g) => sum + g.conf, 0) /
              allGoals.length) *
              1000,
          ) / 1000
        : 0,
    pulse_count: allPulses.length,
    cd: constraintCounts,
  };

  return {
    pulses: allPulses,
    goals: allGoals,
    score_history: scoreHistory,
    telemetry_aggregates: telemetryAggregates,
    summary,
  };
}

// ── buildDashboardHtml ──

export function buildDashboardHtml(
  data: DashboardData,
  templatePath: string,
  outputPath: string,
): number {
  const pulsesJson = JSON.stringify(data.pulses);
  const goalsJson = JSON.stringify(data.goals);
  const scoresJson = JSON.stringify(data.score_history);
  const summaryJson = JSON.stringify(data.summary);
  const telAggJson = JSON.stringify(data.telemetry_aggregates);

  let html: string;
  try {
    html = fs.readFileSync(templatePath, 'utf-8');
  } catch {
    throw new Error(`Template not found: ${templatePath}`);
  }

  html = html
    .replace('PULSES_DATA', pulsesJson)
    .replace('GOALS_DATA', goalsJson)
    .replace('SCORES_DATA', scoresJson)
    .replace('SUMMARY_DATA', summaryJson)
    .replace('TEL_AGG_DATA', telAggJson);

  fs.writeFileSync(outputPath, html, 'utf-8');
  return html.length;
}
