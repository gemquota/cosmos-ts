import type { SessionState, ArtifactDictionary, ArtifactValue } from '../types/index.js';

export interface ArtifactMapping {
  key: string;
  source_question_id: string;
  extractor: (answer: import('../types/index.js').AnswerEntry | undefined) => string | null;
  dependencies: string[];
  source_series_id: number;
}

export const ARTIFACT_MAPPINGS: ArtifactMapping[] = [
  {
    key: 'domain',
    source_question_id: '1.1.1',
    extractor: (a) => a?.open_ended_text || null,
    dependencies: [],
    source_series_id: 1,
  },
  {
    key: 'audience_level',
    source_question_id: '1.1.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: [],
    source_series_id: 1,
  },
  {
    key: 'terminology_preferences',
    source_question_id: '1.3.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: [],
    source_series_id: 1,
  },
  {
    key: 'scaffolding_preference',
    source_question_id: '1.3.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: [],
    source_series_id: 1,
  },
  {
    key: 'abstraction_level',
    source_question_id: '1.2.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: [],
    source_series_id: 1,
  },
  {
    key: 'assumption_level',
    source_question_id: '1.2.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: [],
    source_series_id: 1,
  },

  {
    key: 'entity_list',
    source_question_id: '2.1.1',
    extractor: (a) => a?.open_ended_text || null,
    dependencies: [],
    source_series_id: 2,
  },
  {
    key: 'entity_attributes',
    source_question_id: '2.1.2',
    extractor: (a) => a?.open_ended_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'entity_categories',
    source_question_id: '2.1.3',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'entity_core_peripheral',
    source_question_id: '2.2.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'entity_granularity',
    source_question_id: '2.2.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'entity_attribute_sharing',
    source_question_id: '2.2.3',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'systemic_boundaries',
    source_question_id: '2.3.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: [],
    source_series_id: 2,
  },
  {
    key: 'external_actors',
    source_question_id: '2.3.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: [],
    source_series_id: 2,
  },
  {
    key: 'entity_lifecycles',
    source_question_id: '2.3.3',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'entity_gaps',
    source_question_id: '2.4.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'entity_reclassification',
    source_question_id: '2.4.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'entity_constraints',
    source_question_id: '2.4.3',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'edge_cases',
    source_question_id: '2.5.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'entity_composition',
    source_question_id: '2.5.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },
  {
    key: 'entity_cardinality',
    source_question_id: '2.5.3',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 2,
  },

  {
    key: 'direct_associations',
    source_question_id: '3.1.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 3,
  },
  {
    key: 'association_types',
    source_question_id: '3.1.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 3,
  },
  {
    key: 'hierarchy_structure',
    source_question_id: '3.2.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 3,
  },
  {
    key: 'inheritance_model',
    source_question_id: '3.2.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 3,
  },
  {
    key: 'causal_relationships',
    source_question_id: '3.3.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 3,
  },
  {
    key: 'dependency_chains',
    source_question_id: '3.3.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 3,
  },
  {
    key: 'relationship_mutability',
    source_question_id: '3.4.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: [],
    source_series_id: 3,
  },
  {
    key: 'relationship_composition',
    source_question_id: '3.4.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: [],
    source_series_id: 3,
  },

  {
    key: 'procedure_scope',
    source_question_id: '4.1.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list', 'dependency_chains', 'hierarchy_structure'],
    source_series_id: 4,
  },
  {
    key: 'procedure_steps',
    source_question_id: '4.1.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['entity_list'],
    source_series_id: 4,
  },
  {
    key: 'decision_points',
    source_question_id: '4.2.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['procedure_steps'],
    source_series_id: 4,
  },
  {
    key: 'io_contracts',
    source_question_id: '4.2.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['procedure_steps'],
    source_series_id: 4,
  },
  {
    key: 'error_handling',
    source_question_id: '4.3.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['procedure_steps'],
    source_series_id: 4,
  },
  {
    key: 'step_granularity',
    source_question_id: '4.3.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['procedure_steps'],
    source_series_id: 4,
  },

  {
    key: 'hardware_requirements',
    source_question_id: '5.1.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['domain', 'audience_level'],
    source_series_id: 5,
  },
  {
    key: 'hardware_specs',
    source_question_id: '5.1.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['hardware_requirements'],
    source_series_id: 5,
  },
  {
    key: 'network_requirements',
    source_question_id: '5.1.3',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['hardware_requirements'],
    source_series_id: 5,
  },
  {
    key: 'storage_requirements',
    source_question_id: '5.1.4',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['hardware_requirements'],
    source_series_id: 5,
  },
  {
    key: 'infrastructure_target',
    source_question_id: '5.1.5',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['hardware_requirements'],
    source_series_id: 5,
  },
  {
    key: 'software_stack',
    source_question_id: '5.2.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['domain', 'procedure_steps'],
    source_series_id: 5,
  },
  {
    key: 'os_requirements',
    source_question_id: '5.2.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack'],
    source_series_id: 5,
  },
  {
    key: 'dependency_management',
    source_question_id: '5.2.3',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack'],
    source_series_id: 5,
  },
  {
    key: 'versioning_policy',
    source_question_id: '5.2.4',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack'],
    source_series_id: 5,
  },
  {
    key: 'build_system',
    source_question_id: '5.2.5',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack'],
    source_series_id: 5,
  },
  {
    key: 'performance_targets',
    source_question_id: '5.3.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['procedure_steps'],
    source_series_id: 5,
  },
  {
    key: 'data_volume',
    source_question_id: '5.3.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['performance_targets'],
    source_series_id: 5,
  },
  {
    key: 'availability_targets',
    source_question_id: '5.3.3',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['performance_targets'],
    source_series_id: 5,
  },
  {
    key: 'scalability_model',
    source_question_id: '5.3.4',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['performance_targets'],
    source_series_id: 5,
  },
  {
    key: 'security_requirements',
    source_question_id: '5.3.5',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['performance_targets'],
    source_series_id: 5,
  },
  {
    key: 'integration_targets',
    source_question_id: '5.4.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack'],
    source_series_id: 5,
  },
  {
    key: 'integration_protocols',
    source_question_id: '5.4.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['integration_targets'],
    source_series_id: 5,
  },
  {
    key: 'timeline',
    source_question_id: '5.4.3',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['procedure_steps'],
    source_series_id: 5,
  },
  {
    key: 'deployment_strategy',
    source_question_id: '5.4.4',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack'],
    source_series_id: 5,
  },
  {
    key: 'documentation_requirements',
    source_question_id: '5.4.5',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: [],
    source_series_id: 5,
  },

  {
    key: 'development_cadence',
    source_question_id: '6.1.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['procedure_steps', 'software_stack'],
    source_series_id: 6,
  },
  {
    key: 'team_composition',
    source_question_id: '6.1.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['procedure_steps'],
    source_series_id: 6,
  },
  {
    key: 'quality_practices',
    source_question_id: '6.2.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack'],
    source_series_id: 6,
  },
  {
    key: 'debt_management',
    source_question_id: '6.2.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['quality_practices'],
    source_series_id: 6,
  },
  {
    key: 'communication_patterns',
    source_question_id: '6.3.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['team_composition'],
    source_series_id: 6,
  },
  {
    key: 'decision_making',
    source_question_id: '6.3.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['team_composition'],
    source_series_id: 6,
  },

  {
    key: 'deployment_process',
    source_question_id: '7.1.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack', 'deployment_strategy'],
    source_series_id: 7,
  },
  {
    key: 'environment_management',
    source_question_id: '7.1.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['deployment_process'],
    source_series_id: 7,
  },
  {
    key: 'monitoring_plan',
    source_question_id: '7.2.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack'],
    source_series_id: 7,
  },
  {
    key: 'runtime_configuration',
    source_question_id: '7.2.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack'],
    source_series_id: 7,
  },
  {
    key: 'maintenance_policy',
    source_question_id: '7.3.1',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['software_stack'],
    source_series_id: 7,
  },
  {
    key: 'stewardship_plan',
    source_question_id: '7.3.2',
    extractor: (a) => a?.multi_choice_text || null,
    dependencies: ['team_composition'],
    source_series_id: 7,
  },
];

/**
 * Compute confidence score for an artifact based on answer quality
 */
function computeConfidence(answer: any): number {
  if (!answer) return 0;
  let score = 0;
  if (answer.open_ended_text && answer.open_ended_text.trim().length > 0) score += 0.5;
  if (answer.multi_choice_id) score += 0.3;
  if (answer.open_ended_text && answer.open_ended_text.trim().length > 50) score += 0.2;
  return Math.min(score, 1.0);
}

/**
 * Accumulate artifacts from completed answers in a session
 */
export function accumulateArtifacts(session: SessionState): ArtifactDictionary {
  const artifacts: ArtifactDictionary = {};

  for (const mapping of ARTIFACT_MAPPINGS) {
    const answer = session.answers[mapping.source_question_id];
    if (!answer) continue;

    const value = mapping.extractor(answer);
    if (value === null || value === undefined) continue;

    artifacts[mapping.key] = {
      value,
      source_question_id: mapping.source_question_id,
      source_series_id: parseInt(mapping.source_question_id.split('.')[0]),
      confidence: computeConfidence(answer),
      last_updated: answer.answered_at,
      derived_from: mapping.dependencies,
    };
  }

  return artifacts;
}

/**
 * Get artifact by key, returning undefined if not set
 */
export function getArtifact(artifacts: ArtifactDictionary, key: string): ArtifactValue | undefined {
  return artifacts[key];
}
