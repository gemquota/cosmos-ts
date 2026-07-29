import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type {
  FrameworkDefinition,
  FrameworkMeta,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  SeriesDefinition,
} from '../types/index.js';

/**
 * Load framework from v1 format files (framework.json + json/*.json)
 * and produce a v2 FrameworkDefinition.
 */
/**
 * Load framework from v1 format files.
 * @param frameworkDir - Directory containing framework.json + json/*.json
 * @param locale - Optional locale code to load translated framework files (e.g. "es", "fr")
 */
export function loadFrameworkFromV1(frameworkDir: string, locale?: string): FrameworkDefinition {
  const frameworkJsonPath = join(frameworkDir, 'framework.json');
  if (!existsSync(frameworkJsonPath)) {
    throw new Error(`FRAMEWORK_NOT_FOUND: framework.json not found at ${frameworkJsonPath}`);
  }

  let frameworkJson;
  try {
    frameworkJson = JSON.parse(readFileSync(frameworkJsonPath, 'utf-8'));
  } catch (e: any) {
    throw new Error(`FRAMEWORK_PARSE_ERROR: Invalid JSON in framework.json: ${e.message}`);
  }

  // Load all series from json/ directory
  const seriesDir = locale ? join(frameworkDir, 'json', locale) : join(frameworkDir, 'json');
  const fallbackDir = join(frameworkDir, 'json');
  const seriesFiles = [
    '01-conceptual-depth.json',
    '02-ontological-characteristics.json',
    '03-semantic-relationships.json',
    '04-procedural-breadth.json',
    '05-technical-specifications.json',
    '06-development-methodologies.json',
    '07-operational-functional.json',
  ];

  const series: SeriesDefinition[] = [];

  for (const file of seriesFiles) {
    let filePath = join(seriesDir, file);
    if (!existsSync(filePath)) {
      // Fallback to English locale
      filePath = join(fallbackDir, file);
      if (!existsSync(filePath)) {
        throw new Error(`FRAMEWORK_INVALID: Series file not found: ${filePath}`);
      }
    }
    let data;
    try {
      data = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch (e: any) {
      throw new Error(`FRAMEWORK_PARSE_ERROR: Invalid JSON in ${file}: ${e.message}`);
    }
    const s = data.series;
    series.push({
      id: s.id,
      name: s.name,
      description: s.description,
      depends_on: s.depends_on || [],
      consumes: s.consumes || [],
      provides: s.provides || [],
      rounds: data.rounds,
      x_rounds: s.x_rounds,
      y_open_ended_per_round: s.y_open_ended_per_round,
      z_multi_choice_per_open: s.z_multi_choice_per_open,
      total_open_ended: data.rounds.reduce((sum: number, r: any) => sum + r.open_ended.length, 0),
      total_multi_choice: data.rounds.reduce(
        (sum: number, r: any) =>
          sum + r.open_ended.reduce((s2: number, oe: any) => s2 + oe.follow_up_choices.length, 0),
        0,
      ),
    });
  }

  // Build dependency graph from framework.json edges
  const edges: DependencyEdge[] = frameworkJson.dependency_chain.edges.map((e: any) => ({
    from: e.from,
    to: e.to,
    artifacts: e.artifacts,
  }));

  const nodes: DependencyNode[] = series.map((s) => ({
    series_id: s.id,
    name: s.name,
    provides: s.provides,
  }));

  const meta: FrameworkMeta = {
    name: frameworkJson.meta.name,
    version: '2.0.0',
    description: frameworkJson.meta.description,
    total_series: frameworkJson.meta.total_series,
    total_rounds: frameworkJson.meta.total_rounds,
    total_open_ended: frameworkJson.meta.total_open_ended_questions,
    total_multi_choice: frameworkJson.meta.total_multi_choice_followups,
    estimated_completion_minutes: [45, 75],
  };

  const dependency_graph: DependencyGraph = { nodes, edges };

  return { meta, dependency_graph, series };
}

/**
 * Validate a FrameworkDefinition (R1-R8 rules)
 */
export function validateFramework(fw: FrameworkDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // R1: Unique question IDs
  const qIds = new Set<string>();
  for (const s of fw.series) {
    for (const r of s.rounds) {
      for (const oe of r.open_ended) {
        if (qIds.has(oe.id)) errors.push(`R1: Duplicate question ID: ${oe.id}`);
        qIds.add(oe.id);
      }
    }
  }

  // R2: MC IDs start with parent question ID
  for (const s of fw.series) {
    for (const r of s.rounds) {
      for (const oe of r.open_ended) {
        for (const mc of oe.follow_up_choices) {
          if (!mc.id.startsWith(oe.id + '.')) {
            errors.push(`R2: MC ID ${mc.id} does not start with question ID ${oe.id}.`);
          }
        }
      }
    }
  }

  // R3: Acyclic dependency graph (topological sort)
  const visited = new Set<number>();
  const temp = new Set<number>();
  let hasCycle = false;

  function dfs(nodeId: number): void {
    if (temp.has(nodeId)) {
      hasCycle = true;
      return;
    }
    if (visited.has(nodeId)) return;
    temp.add(nodeId);
    const children = fw.dependency_graph.edges.filter((e) => e.from === nodeId).map((e) => e.to);
    for (const child of children) dfs(child);
    temp.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of fw.dependency_graph.nodes) {
    dfs(node.series_id);
  }
  if (hasCycle) errors.push('R3: Dependency graph contains a cycle');

  // R4: depends_on IDs are lower than dependent
  for (const s of fw.series) {
    for (const dep of s.depends_on) {
      if (dep >= s.id) errors.push(`R4: Series ${s.id} depends on ${dep} (must be lower)`);
    }
  }

  // R6: total_rounds = sum of series.rounds.length
  const totalRounds = fw.series.reduce((acc, s) => acc + s.rounds.length, 0);
  if (totalRounds !== fw.meta.total_rounds) {
    errors.push(`R6: total_rounds mismatch: expected ${fw.meta.total_rounds}, got ${totalRounds}`);
  }

  // R7 + R8: Single pass for question and MC counts
  let totalOE = 0;
  let totalMC = 0;
  for (const s of fw.series) {
    for (const r of s.rounds) {
      totalOE += r.open_ended.length;
      for (const oe of r.open_ended) {
        totalMC += oe.follow_up_choices.length;
      }
    }
  }
  if (totalOE !== fw.meta.total_open_ended) {
    errors.push(`R7: total_open_ended mismatch: expected ${fw.meta.total_open_ended}, got ${totalOE}`);
  }
  if (totalMC !== fw.meta.total_multi_choice) {
    errors.push(`R8: total_multi_choice mismatch: expected ${fw.meta.total_multi_choice}, got ${totalMC}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Topological sort of series by dependency graph
 */
export function topologicalSort(fw: FrameworkDefinition): number[] {
  const inDegree = new Map<number, number>();
  const adj = new Map<number, number[]>();

  for (const node of fw.dependency_graph.nodes) {
    inDegree.set(node.series_id, 0);
    adj.set(node.series_id, []);
  }

  for (const edge of fw.dependency_graph.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    adj.get(edge.from)!.push(edge.to);
  }

  const queue: number[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result: number[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const child of adj.get(node) || []) {
      const newDeg = (inDegree.get(child) || 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) queue.push(child);
    }
  }

  return result;
}
