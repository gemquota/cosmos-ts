import type { SessionState, ArtifactDictionary, CompletenessReport } from '../types/index.js';

interface Dimension {
  id: string;
  name: string;
  required_artifacts: string[];
  weight: number;
}

const DIMENSIONS: Dimension[] = [
  {
    id: 'domain_clarity',
    name: 'Domain Clarity',
    required_artifacts: ['domain', 'audience_level', 'terminology_preferences'],
    weight: 0.15,
  },
  {
    id: 'entity_model',
    name: 'Entity Model',
    required_artifacts: ['entity_list', 'entity_attributes', 'entity_categories'],
    weight: 0.2,
  },
  {
    id: 'relationship_map',
    name: 'Relationship Map',
    required_artifacts: ['hierarchy_structure', 'dependency_chains'],
    weight: 0.15,
  },
  {
    id: 'procedures',
    name: 'Procedural Coverage',
    required_artifacts: ['procedure_steps', 'decision_points', 'step_granularity'],
    weight: 0.1,
  },
  {
    id: 'technical',
    name: 'Technical Readiness',
    required_artifacts: ['software_stack', 'performance_targets', 'hardware_requirements'],
    weight: 0.2,
  },
  {
    id: 'methodology',
    name: 'Methodology',
    required_artifacts: ['development_cadence', 'quality_practices', 'team_composition'],
    weight: 0.1,
  },
  {
    id: 'operations',
    name: 'Operational Readiness',
    required_artifacts: ['deployment_strategy', 'monitoring_plan', 'maintenance_policy'],
    weight: 0.1,
  },
];

export function scoreCompleteness(session: SessionState, artifacts: ArtifactDictionary): CompletenessReport {
  const per_dimension = DIMENSIONS.map((dim) => {
    const present = dim.required_artifacts.filter((k) => artifacts[k] && artifacts[k].confidence > 0);
    const score = dim.required_artifacts.length > 0 ? (present.length / dim.required_artifacts.length) * 100 : 0;
    const gaps = dim.required_artifacts.filter((k) => !artifacts[k] || artifacts[k].confidence === 0);
    const status: CompletenessReport['per_dimension'][0]['status'] =
      score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'adequate' : score > 0 ? 'weak' : 'missing';

    return {
      dimension: dim.name,
      score,
      status,
      gaps: gaps.map((k) => `Missing: ${k}`),
      suggestions: gaps.length > 0 ? [`Define ${gaps.join(', ')}`] : [],
    };
  });

  const overall_score = per_dimension.reduce((sum, d, i) => sum + d.score * DIMENSIONS[i].weight, 0);
  const readiness_level: CompletenessReport['readiness_level'] =
    overall_score >= 80 ? 'ready' : overall_score >= 50 ? 'review' : 'draft';

  return { overall_score, per_dimension, readiness_level };
}
