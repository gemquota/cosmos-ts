// ==========================================
// Artifact Key Validation
// Fixes: artifact key typo detection, schema enforcement
// ==========================================

/**
 * Canonical artifact keys produced by each series.
 * Typo detection: if a framework JSON produces a key not in this set,
 * it's flagged at load time rather than silently producing invalid data.
 */
export const KNOWN_ARTIFACT_KEYS = new Set([
  // Series 1 — Conceptual Depth
  'domain',
  'audience_level',
  'terminology_preferences',
  'scaffolding_preference',

  // Series 2 — Ontological Characteristics
  'entity_list',
  'entity_attributes',
  'entity_categories',
  'entity_hierarchy',
  'entity_constraints',

  // Series 3 — Semantic Relationships
  'relationship_graph',
  'hierarchy_structure',
  'dependency_chains',
  'composition_rules',

  // Series 4 — Procedural Breadth
  'procedure_steps',
  'decision_points',
  'branching_complexity',
  'io_contracts',

  // Series 5 — Technical Specifications
  'hardware_requirements',
  'software_stack',
  'performance_targets',
  'integration_contracts',
  'timeline',
  'security_requirements',
  'testing_strategy',

  // Series 6 — Development Methodologies
  'development_cadence',
  'quality_practices',
  'team_composition',
  'communication_patterns',
  'decision_process',
  'debt_management',

  // Series 7 — Operational / Functional
  'deployment_strategy',
  'environment_management',
  'monitoring_plan',
  'configuration_management',
  'maintenance_policy',
  'stewardship_plan',
] as const);

export type KnownArtifactKey = typeof KNOWN_ARTIFACT_KEYS extends Set<infer K> ? K : never;

/**
 * Validate an artifact key against the known set.
 * Returns validation result with suggestions for typos.
 */
export function validateArtifactKey(key: string): { valid: boolean; suggestion?: string } {
  if (KNOWN_ARTIFACT_KEYS.has(key as any)) {
    return { valid: true };
  }

  // Fuzzy match for typo detection
  const suggestion = findClosestKey(key);
  return {
    valid: false,
    suggestion: suggestion || undefined,
  };
}

/**
 * Find the closest known key to a given string using Levenshtein distance.
 */
function findClosestKey(input: string): string | null {
  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const key of KNOWN_ARTIFACT_KEYS) {
    const dist = levenshteinDistance(input.toLowerCase(), key.toLowerCase());
    if (dist < bestDistance && dist <= 3) {
      bestDistance = dist;
      bestMatch = key;
    }
  }

  return bestMatch;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Validate all artifact keys in a dictionary, returning warnings for unknown keys.
 */
export function validateArtifactDictionary(artifacts: Record<string, unknown>): {
  valid: boolean;
  unknownKeys: Array<{ key: string; suggestion?: string }>;
} {
  const unknownKeys: Array<{ key: string; suggestion?: string }> = [];

  for (const key of Object.keys(artifacts)) {
    const result = validateArtifactKey(key);
    if (!result.valid) {
      unknownKeys.push({ key, suggestion: result.suggestion });
    }
  }

  return {
    valid: unknownKeys.length === 0,
    unknownKeys,
  };
}
