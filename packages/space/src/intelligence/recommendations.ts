import type { SessionState, ArtifactDictionary, Recommendation } from '../types/index.js';

export function generateRecommendations(session: SessionState, artifacts: ArtifactDictionary): Recommendation[] {
  const recs: Recommendation[] = [];

  // Check for missing critical artifacts
  const criticalArtifacts = ['domain', 'audience_level', 'entity_list', 'software_stack', 'procedure_steps'];
  for (const key of criticalArtifacts) {
    if (!artifacts[key] || artifacts[key].confidence === 0) {
      const questionId =
        key === 'domain'
          ? '1.1.1'
          : key === 'audience_level'
            ? '1.1.2'
            : key === 'entity_list'
              ? '2.1.1'
              : key === 'software_stack'
                ? '5.2.1'
                : '4.1.2';
      recs.push({
        id: `gap-${key}`,
        category: 'gap',
        title: `Missing: ${key.replace(/_/g, ' ')}`,
        description: `The "${key}" artifact is not yet defined. Consider answering question ${questionId}.`,
        related_artifacts: [key],
        priority: 'high',
        actionable: true,
      });
    }
  }

  // Check for under-documented entities
  const entityList = (artifacts.entity_list?.value as string) || '';
  if (entityList && entityList.length < 100) {
    recs.push({
      id: 'enhancement-entities',
      category: 'enhancement',
      title: 'Entity model may be under-documented',
      description: 'The entity list is quite brief. Consider expanding with more detail.',
      related_artifacts: ['entity_list'],
      priority: 'medium',
      actionable: true,
    });
  }

  // Check for team/methodology consistency
  const team = (artifacts.team_composition?.value as string) || '';
  const cadence = (artifacts.development_cadence?.value as string) || '';
  if (team.includes('solo') && cadence.includes('sprint')) {
    recs.push({
      id: 'warning-team-methodology',
      category: 'warning',
      title: 'Team-methodology mismatch',
      description: 'Solo team with Scrum methodology may be inefficient. Consider Kanban.',
      related_artifacts: ['team_composition', 'development_cadence'],
      priority: 'medium',
      actionable: true,
    });
  }

  // Completeness milestone
  const totalRounds = 25;
  const completedRounds = session.progress.completed_rounds.length;
  const pct = Math.round((completedRounds / totalRounds) * 100);

  if (pct >= 80) {
    recs.push({
      id: 'tip-nearly-done',
      category: 'tip',
      title: `Almost there! ${pct}% complete`,
      description: `Just ${totalRounds - completedRounds} more rounds to complete the specification.`,
      priority: 'low',
      actionable: false,
    });
  } else if (pct >= 50) {
    recs.push({
      id: 'tip-halfway',
      category: 'tip',
      title: `Halfway there! ${pct}% complete`,
      description: 'Good progress! Consider reviewing collected artifacts for consistency.',
      priority: 'low',
      actionable: false,
    });
  }

  return recs;
}
