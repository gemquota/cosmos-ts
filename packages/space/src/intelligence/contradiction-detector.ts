import type { SessionState, ArtifactDictionary, Contradiction } from '../types/index.js';

interface ContradictionRule {
  id: string;
  type: Contradiction['type'];
  severity: Contradiction['severity'];
  check: (session: SessionState, artifacts: ArtifactDictionary) => Contradiction | null;
}

const RULES: ContradictionRule[] = [
  {
    id: 'solo-vs-scrum',
    type: 'direct',
    severity: 'medium',
    check: (session, artifacts) => {
      const team = (artifacts.team_composition?.value as string) || '';
      const cadence = (artifacts.development_cadence?.value as string) || '';
      if (team.toLowerCase().includes('solo') && cadence.toLowerCase().includes('sprint')) {
        return {
          id: 'solo-vs-scrum',
          type: 'direct',
          severity: 'medium',
          questions: ['6.1.1', '6.1.2'],
          description: 'Solo developer selected but Scrum sprint methodology chosen. Scrum typically requires a team.',
          resolution_suggestions: ['Consider Kanban for solo work', 'Or: define a small team (2-3 people)'],
        };
      }
      return null;
    },
  },
  {
    id: 'low-traffic-high-hw',
    type: 'implied',
    severity: 'low',
    check: (session, artifacts) => {
      const perf = (artifacts.performance_targets?.value as string) || '';
      const hw = (artifacts.hardware_requirements?.value as string) || '';
      if (perf.includes('Low traffic') && hw.includes('Enterprise')) {
        return {
          id: 'low-traffic-high-hw',
          type: 'implied',
          severity: 'low',
          questions: ['5.1.1', '5.3.1'],
          description: 'Enterprise hardware selected for a low-traffic application. Consider downscaling.',
          resolution_suggestions: ['Match hardware to traffic expectations', 'Consider cloud-native for flexibility'],
        };
      }
      return null;
    },
  },
  {
    id: 'no-integrations-heavy-stack',
    type: 'implied',
    severity: 'low',
    check: (session, artifacts) => {
      const integrations = (artifacts.integration_targets?.value as string) || '';
      const stack = (artifacts.software_stack?.value as string) || '';
      if (integrations.includes('No integrations') && stack.includes('Polyglot')) {
        return {
          id: 'no-integrations-heavy-stack',
          type: 'implied',
          severity: 'low',
          questions: ['5.2.1', '5.4.1'],
          description: 'Polyglot stack selected with no external integrations. A simpler stack may suffice.',
          resolution_suggestions: ['Consider reducing language diversity', 'Or: identify integration opportunities'],
        };
      }
      return null;
    },
  },
  {
    id: 'fast-timeline-complex-proc',
    type: 'implied',
    severity: 'medium',
    check: (session, artifacts) => {
      const timeline = (artifacts.timeline?.value as string) || '';
      const proc = (artifacts.procedure_steps?.value as string) || '';
      if (timeline.includes('Quick') && proc.includes('9+ steps')) {
        return {
          id: 'fast-timeline-complex-proc',
          type: 'implied',
          severity: 'medium',
          questions: ['4.1.2', '5.4.3'],
          description: 'Quick timeline with a complex 9+ step procedure. May need to simplify or extend timeline.',
          resolution_suggestions: ['Reduce procedural complexity', 'Or: extend the timeline'],
        };
      }
      return null;
    },
  },
  {
    id: 'beginner-vs-expert',
    type: 'direct',
    severity: 'medium',
    check: (session, artifacts) => {
      const audience = (artifacts.audience_level?.value as string) || '';
      const absLevel = (artifacts.assumption_level?.value as string) || '';
      if (audience.includes('Learners') && (absLevel.includes('Formal') || absLevel.includes('proof'))) {
        return {
          id: 'beginner-vs-expert',
          type: 'direct',
          severity: 'medium',
          questions: ['1.1.2', '1.2.2'],
          description: 'Learner audience selected but formal proofs expected.',
          resolution_suggestions: ['Switch to concrete examples', 'Or: select expert audience'],
        };
      }
      return null;
    },
  },
  {
    id: 'cloud-vs-air-gap',
    type: 'direct',
    severity: 'high',
    check: (session, artifacts) => {
      const deploy = (artifacts.deployment_strategy?.value as string) || '';
      const infra = (artifacts.hardware_requirements?.value as string) || '';
      if (deploy.includes('Cloud') && infra.includes('Air-gapped')) {
        return {
          id: 'cloud-vs-air-gap',
          type: 'direct',
          severity: 'high',
          questions: ['5.3.1', '7.1.1'],
          description: 'Cloud deployment with air-gapped hardware - mutually exclusive.',
          resolution_suggestions: ['Remove air-gap for cloud', 'Or: switch to on-premises'],
        };
      }
      return null;
    },
  },
  {
    id: 'rapid-timeline-heavy-integration',
    type: 'temporal',
    severity: 'medium',
    check: (session, artifacts) => {
      const timeline = (artifacts.timeline?.value as string) || '';
      const integrations = (artifacts.integration_targets?.value as string) || '';
      if (
        (timeline.includes('2 weeks') || timeline.includes('1 month')) &&
        (integrations.includes('multiple') || integrations.includes('many'))
      ) {
        return {
          id: 'rapid-timeline-heavy-integration',
          type: 'temporal',
          severity: 'medium',
          questions: ['5.4.3', '5.2.1'],
          description: 'Short timeline with multiple integration targets.',
          resolution_suggestions: ['Extend timeline', 'Or: reduce integration scope'],
        };
      }
      return null;
    },
  },
  {
    id: 'solo-no-testing',
    type: 'implied',
    severity: 'low',
    check: (session, artifacts) => {
      const team = (artifacts.team_composition?.value as string) || '';
      const quality = (artifacts.quality_practices?.value as string) || '';
      if (team.includes('Solo') && (quality.includes('None') || quality.includes('Manual'))) {
        return {
          id: 'solo-no-testing',
          type: 'implied',
          severity: 'low',
          questions: ['6.1.2', '6.2.1'],
          description: 'Solo development with no automated testing.',
          resolution_suggestions: ['Add basic automated tests', 'Or: plan manual QA cycles'],
        };
      }
      return null;
    },
  },
  {
    id: 'mvp-vs-full-feature',
    type: 'direct',
    severity: 'medium',
    check: (session, artifacts) => {
      const scope = (artifacts.procedure_steps?.value as string) || '';
      const timeline = (artifacts.timeline?.value as string) || '';
      if (scope.includes('9+ steps') && (timeline.includes('MVP') || timeline.includes('Quick'))) {
        return {
          id: 'mvp-vs-full-feature',
          type: 'direct',
          severity: 'medium',
          questions: ['4.1.2', '5.4.3'],
          description: 'Full operational scope for MVP timeline. MVPs should be minimal.',
          resolution_suggestions: ['Reduce scope to core features', 'Or: rename to full release'],
        };
      }
      return null;
    },
  },
  {
    id: 'monolith-vs-microservices',
    type: 'direct',
    severity: 'medium',
    check: (session, artifacts) => {
      const stack = (artifacts.software_stack?.value as string) || '';
      const deploy = (artifacts.deployment_strategy?.value as string) || '';
      if (stack.includes('Monolith') && deploy.includes('Microservices')) {
        return {
          id: 'monolith-vs-microservices',
          type: 'direct',
          severity: 'medium',
          questions: ['5.2.1', '7.1.1'],
          description: 'Monolithic architecture with microservices deployment. Contradictory patterns.',
          resolution_suggestions: ['Choose monolithic deployment', 'Or: adopt microservices architecture'],
        };
      }
      return null;
    },
  },
];

export function detectContradictions(session: SessionState, artifacts: ArtifactDictionary): Contradiction[] {
  const contradictions: Contradiction[] = [];
  for (const rule of RULES) {
    const c = rule.check(session, artifacts);
    if (c) contradictions.push(c);
  }
  return contradictions;
}
