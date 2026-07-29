// ==========================================
// Artifact Extraction Service
// Fixes: Session owns too many responsibilities,
//         extract artifact extraction into dedicated service
// ==========================================

import type { AnswerEntry, ArtifactDictionary, ArtifactValueContent } from '../types/index.js';
import { validateArtifactKey } from './artifact-keys.js';

export interface ExtractionResult {
  artifacts: ArtifactDictionary;
  warnings: ExtractionWarning[];
}

export interface ExtractionWarning {
  question_id: string;
  artifact_key: string;
  message: string;
  suggestion?: string;
}

/**
 * Extracts structured artifacts from free-text answers.
 * Separated from SessionManager to follow single-responsibility principle.
 *
 * Each series defines an extraction pattern:
 * - Series 1: Simple keyword extraction for domain/audience
 * - Series 2: Entity recognition and attribute mapping
 * - Series 3: Relationship graph construction
 * - Series 4: Procedure step extraction
 * - Series 5: Technical spec extraction
 * - Series 6: Methodology extraction
 * - Series 7: Operations extraction
 */
export class ArtifactExtractor {
  private extractionPatterns: Map<number, ExtractionPattern> = new Map();

  constructor() {
    this.registerDefaultPatterns();
  }

  private registerDefaultPatterns(): void {
    // Series 1 — Domain & Audience
    this.extractionPatterns.set(1, {
      series_id: 1,
      mappings: [
        { question_pattern: '1.1.1', artifact_key: 'domain', transform: (text) => this.extractDomain(text) },
        {
          question_pattern: '1.1.2',
          artifact_key: 'audience_level',
          transform: (text) => this.extractAudienceLevel(text),
        },
        {
          question_pattern: '1.2.1',
          artifact_key: 'terminology_preferences',
          transform: (text) => this.extractTerminology(text),
        },
        {
          question_pattern: '1.2.2',
          artifact_key: 'scaffolding_preference',
          transform: (text) => this.extractScaffolding(text),
        },
      ],
    });

    // Series 2 — Ontological Characteristics
    this.extractionPatterns.set(2, {
      series_id: 2,
      mappings: [
        { question_pattern: '2.1', artifact_key: 'entity_list', transform: (text) => this.extractEntities(text) },
        {
          question_pattern: '2.1.2',
          artifact_key: 'entity_attributes',
          transform: (text) => this.extractAttributes(text),
        },
        {
          question_pattern: '2.1.3',
          artifact_key: 'entity_categories',
          transform: (text) => this.extractCategories(text),
        },
        { question_pattern: '2.2', artifact_key: 'entity_hierarchy', transform: (text) => this.extractHierarchy(text) },
        {
          question_pattern: '2.3',
          artifact_key: 'entity_constraints',
          transform: (text) => this.extractConstraints(text),
        },
      ],
    });

    // Series 3 — Semantic Relationships
    this.extractionPatterns.set(3, {
      series_id: 3,
      mappings: [
        {
          question_pattern: '3.1',
          artifact_key: 'relationship_graph',
          transform: (text) => this.extractRelationships(text),
        },
        {
          question_pattern: '3.2',
          artifact_key: 'hierarchy_structure',
          transform: (text) => this.extractHierarchyStructure(text),
        },
        {
          question_pattern: '3.3',
          artifact_key: 'dependency_chains',
          transform: (text) => this.extractDependencies(text),
        },
        {
          question_pattern: '3.4',
          artifact_key: 'composition_rules',
          transform: (text) => this.extractCompositionRules(text),
        },
      ],
    });

    // Series 4 — Procedural Breadth
    this.extractionPatterns.set(4, {
      series_id: 4,
      mappings: [
        { question_pattern: '4.1', artifact_key: 'procedure_steps', transform: (text) => this.extractProcedures(text) },
        {
          question_pattern: '4.2.1',
          artifact_key: 'decision_points',
          transform: (text) => this.extractDecisions(text),
        },
        { question_pattern: '4.2.2', artifact_key: 'io_contracts', transform: (text) => this.extractIOContracts(text) },
        {
          question_pattern: '4.3',
          artifact_key: 'branching_complexity',
          transform: (text) => this.extractBranching(text),
        },
      ],
    });

    // Series 5 — Technical Specifications
    this.extractionPatterns.set(5, {
      series_id: 5,
      mappings: [
        {
          question_pattern: '5.1',
          artifact_key: 'hardware_requirements',
          transform: (text) => this.extractHardware(text),
        },
        {
          question_pattern: '5.2',
          artifact_key: 'software_stack',
          transform: (text) => this.extractSoftwareStack(text),
        },
        {
          question_pattern: '5.3.1',
          artifact_key: 'performance_targets',
          transform: (text) => this.extractPerformance(text),
        },
        {
          question_pattern: '5.3.3',
          artifact_key: 'security_requirements',
          transform: (text) => this.extractSecurity(text),
        },
        {
          question_pattern: '5.3.4',
          artifact_key: 'testing_strategy',
          transform: (text) => this.extractTestingStrategy(text),
        },
        {
          question_pattern: '5.4',
          artifact_key: 'integration_contracts',
          transform: (text) => this.extractIntegrations(text),
        },
      ],
    });

    // Series 6 — Development Methodologies
    this.extractionPatterns.set(6, {
      series_id: 6,
      mappings: [
        {
          question_pattern: '6.1.1',
          artifact_key: 'development_cadence',
          transform: (text) => this.extractCadence(text),
        },
        {
          question_pattern: '6.1.2',
          artifact_key: 'team_composition',
          transform: (text) => this.extractTeamComposition(text),
        },
        {
          question_pattern: '6.2.1',
          artifact_key: 'quality_practices',
          transform: (text) => this.extractQualityPractices(text),
        },
        {
          question_pattern: '6.2.2',
          artifact_key: 'debt_management',
          transform: (text) => this.extractDebtManagement(text),
        },
        {
          question_pattern: '6.3.1',
          artifact_key: 'communication_patterns',
          transform: (text) => this.extractCommunication(text),
        },
        {
          question_pattern: '6.3.2',
          artifact_key: 'decision_process',
          transform: (text) => this.extractDecisionProcess(text),
        },
      ],
    });

    // Series 7 — Operational / Functional
    this.extractionPatterns.set(7, {
      series_id: 7,
      mappings: [
        {
          question_pattern: '7.1.1',
          artifact_key: 'deployment_strategy',
          transform: (text) => this.extractDeployment(text),
        },
        {
          question_pattern: '7.1.2',
          artifact_key: 'environment_management',
          transform: (text) => this.extractEnvironments(text),
        },
        {
          question_pattern: '7.2.1',
          artifact_key: 'monitoring_plan',
          transform: (text) => this.extractMonitoring(text),
        },
        {
          question_pattern: '7.2.2',
          artifact_key: 'configuration_management',
          transform: (text) => this.extractConfigManagement(text),
        },
        {
          question_pattern: '7.3.1',
          artifact_key: 'maintenance_policy',
          transform: (text) => this.extractMaintenance(text),
        },
        {
          question_pattern: '7.3.2',
          artifact_key: 'stewardship_plan',
          transform: (text) => this.extractStewardship(text),
        },
      ],
    });
  }

  /**
   * Extract all artifacts from a set of answers for a given series.
   */
  extractFromAnswers(seriesId: number, answers: Record<string, AnswerEntry>): ExtractionResult {
    const pattern = this.extractionPatterns.get(seriesId);
    if (!pattern) {
      return {
        artifacts: {},
        warnings: [{ question_id: '', artifact_key: '', message: `No extraction pattern for series ${seriesId}` }],
      };
    }

    const artifacts: ArtifactDictionary = {};
    const warnings: ExtractionWarning[] = [];

    for (const mapping of pattern.mappings) {
      // Find matching answers
      const matchingAnswers = Object.values(answers).filter(
        (a) => a.question_id.startsWith(mapping.question_pattern) || a.question_id === mapping.question_pattern,
      );

      if (matchingAnswers.length === 0) continue;

      // Combine text from all matching answers
      const combinedText = matchingAnswers.map((a) => a.open_ended_text).join('\n\n');

      // Validate artifact key
      const keyValidation = validateArtifactKey(mapping.artifact_key);
      if (!keyValidation.valid) {
        warnings.push({
          question_id: matchingAnswers[0].question_id,
          artifact_key: mapping.artifact_key,
          message: `Artifact key "${mapping.artifact_key}" is not in the known set.`,
          suggestion: keyValidation.suggestion,
        });
      }

      // Extract the artifact value
      const value = mapping.transform(combinedText);

      artifacts[mapping.artifact_key] = {
        value: value as unknown as ArtifactValueContent,
        source_question_id: matchingAnswers[0].question_id,
        source_series_id: seriesId,
        confidence: this.estimateConfidence(combinedText, matchingAnswers.length),
        last_updated: new Date().toISOString(),
        derived_from: matchingAnswers.map((a) => a.question_id),
      };
    }

    return { artifacts, warnings };
  }

  /**
   * Estimate extraction confidence based on text quality.
   */
  private estimateConfidence(text: string, answerCount: number): number {
    let confidence = 0.5; // Base confidence

    // Longer answers tend to be more informative
    if (text.length > 200) confidence += 0.15;
    if (text.length > 500) confidence += 0.1;
    if (text.length > 1000) confidence += 0.1;

    // More answers provide more context
    if (answerCount > 1) confidence += 0.1;

    // Check for structured content (lists, numbers, etc.)
    if (/\d+\.\s/.test(text)) confidence += 0.05; // Numbered lists
    if (/-\s/.test(text)) confidence += 0.05; // Bullet points

    return Math.min(1, confidence);
  }

  // ==========================================
  // Extraction transformers (Series 1)
  // ==========================================

  private extractDomain(text: string): string {
    // Extract the primary domain mentioned in the answer
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    return sentences[0]?.trim() || text.slice(0, 200);
  }

  private extractAudienceLevel(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('expert') || lower.includes('researcher') || lower.includes('senior')) return 'expert';
    if (lower.includes('practitioner') || lower.includes('professional') || lower.includes('experienced'))
      return 'practitioner';
    if (lower.includes('learner') || lower.includes('beginner') || lower.includes('general')) return 'learner';
    return 'mixed';
  }

  private extractTerminology(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('academic') || lower.includes('formal') || lower.includes('technical')) return 'formal';
    if (lower.includes('plain') || lower.includes('accessible') || lower.includes('simple')) return 'plain';
    return 'standard';
  }

  private extractScaffolding(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('progressive') || lower.includes('scaffold')) return 'progressive';
    if (lower.includes('flat') || lower.includes('consistent')) return 'flat';
    return 'mixed';
  }

  // ==========================================
  // Extraction transformers (Series 2-7)
  // ==========================================

  private extractEntities(text: string): string[] {
    const entities: string[] = [];
    // Look for entity-like patterns (capitalized phrases, quoted terms, bullet points)
    const patterns = [
      /(?:entity|component|module|service|class|type)[:\s]+["']?([A-Z][a-zA-Z\s]+)["']?/gi,
      /(?:called|named|known as)\s+["']?([A-Z][a-zA-Z\s]+)["']?/gi,
      /^[-•]\s*([A-Z][a-zA-Z\s]+)/gm,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (name.length > 2 && name.length < 50 && !entities.includes(name)) {
          entities.push(name);
        }
      }
    }
    return entities.length > 0 ? entities : [text.split(/[.!?]/)[0]?.trim() || 'unknown'];
  }

  private extractAttributes(text: string): string[] {
    const attrs: string[] = [];
    const patterns = [
      /(?:property|field|attribute|key|column)[:\s]+["']?([a-z_]+)["']?/gi,
      /([a-z_]+)\s*(?::|is|as)\s*/gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const attr = match[1].trim();
        if (attr.length > 2 && attr.length < 30 && !attrs.includes(attr)) {
          attrs.push(attr);
        }
      }
    }
    return attrs.length > 0 ? attrs : ['name', 'description'];
  }

  private extractCategories(text: string): string[] {
    const cats: string[] = [];
    const patterns = [
      /(?:category|type|group|class|kind)[:\s]+["']?([A-Z][a-zA-Z\s]+)["']?/gi,
      /^[-•]\s*([A-Z][a-zA-Z\s]+)/gm,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const cat = match[1].trim();
        if (cat.length > 2 && cat.length < 30 && !cats.includes(cat)) {
          cats.push(cat);
        }
      }
    }
    return cats.length > 0 ? cats : ['default'];
  }

  private extractHierarchy(text: string): Record<string, string[]> {
    // Simple hierarchy extraction
    return { root: this.extractEntities(text) };
  }

  private extractConstraints(text: string): string[] {
    const constraints: string[] = [];
    const patterns = [
      /(?:must|shall|required|constraint|invariant)[:\s]+([^.]+)/gi,
      /(?:cannot|must not|should not)[:\s]+([^.]+)/gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const constraint = match[1].trim();
        if (constraint.length > 5 && constraint.length < 200) {
          constraints.push(constraint);
        }
      }
    }
    return constraints;
  }

  private extractRelationships(text: string): Record<string, string> {
    const rels: Record<string, string> = {};
    const patterns = [
      /([A-Z][a-zA-Z]+)\s+(?:depends on|requires|uses|calls|imports)\s+([A-Z][a-zA-Z]+)/gi,
      /([A-Z][a-zA-Z]+)\s+(?:depends|requires|uses|calls|imports)\s+([A-Z][a-zA-Z]+)/gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        rels[match[1]] = match[2];
      }
    }
    return rels;
  }

  private extractHierarchyStructure(text: string): Record<string, unknown> {
    return { structure: text.split(/[.!?]/)[0]?.trim() || 'flat' };
  }

  private extractDependencies(text: string): string[] {
    const deps: string[] = [];
    const patterns = [
      /(?:depends on|requires|prerequisite|after)\s+([A-Z][a-zA-Z\s,]+)/gi,
      /(\d+\.\d+)\s*→\s*(\d+\.\d+)/g,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        deps.push(match[0]);
      }
    }
    return deps;
  }

  private extractCompositionRules(text: string): string[] {
    const rules: string[] = [];
    const patterns = [/(?:must contain|should contain|includes?|composed of)[:\s]+([^.]+)/gi];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        rules.push(match[1].trim());
      }
    }
    return rules;
  }

  private extractProcedures(text: string): string[] {
    const steps: string[] = [];
    const patterns = [/^[-•\d.]+\s+(.+)/gm, /step\s*\d+[:\s]+(.+)/gi, /phase\s*\d+[:\s]+(.+)/gi];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const step = match[1].trim();
        if (step.length > 5 && step.length < 200 && !steps.includes(step)) {
          steps.push(step);
        }
      }
    }
    return steps.length > 0 ? steps : [text.split(/[.!?]/)[0]?.trim() || 'complete'];
  }

  private extractDecisions(text: string): string[] {
    const decisions: string[] = [];
    const patterns = [
      /(?:if|when|decide|choose|select|option)\s+[:\s]+([^.]+)/gi,
      /(?:branch|fork|split|condition)\s+[:\s]+([^.]+)/gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        decisions.push(match[1].trim());
      }
    }
    return decisions;
  }

  private extractIOContracts(text: string): Record<string, string> {
    return { description: text.slice(0, 500) };
  }

  private extractBranching(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('linear') || lower.includes('no branch')) return 'linear';
    if (lower.includes('complex') || lower.includes('many branch')) return 'complex';
    return 'moderate';
  }

  private extractHardware(text: string): string {
    return text.slice(0, 300);
  }

  private extractSoftwareStack(text: string): string[] {
    const stack: string[] = [];
    const patterns = [
      /\b(Node\.?js|TypeScript|React|Vue|Angular|Python|Rust|Go|Java|C\+\+|PostgreSQL|MySQL|MongoDB|Redis|Docker|Kubernetes|AWS|GCP|Azure)\b/gi,
      /([a-z-]+)\s+(?:v\d|version)/gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const tech = match[1].trim();
        if (!stack.includes(tech)) stack.push(tech);
      }
    }
    return stack.length > 0 ? stack : [text.split(/[.!?]/)[0]?.trim() || 'unknown'];
  }

  private extractPerformance(text: string): string {
    return text.slice(0, 300);
  }

  private extractSecurity(text: string): string {
    return text.slice(0, 300);
  }

  private extractTestingStrategy(text: string): string {
    return text.slice(0, 300);
  }

  private extractIntegrations(text: string): string[] {
    const integrations: string[] = [];
    const patterns = [
      /(?:integrates? with|connects? to|calls?|uses?)\s+([A-Z][a-zA-Z\s]+)/gi,
      /\b(API|REST|GraphQL|gRPC|WebSocket|webhook)\b/gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const integration = match[1].trim();
        if (!integrations.includes(integration)) integrations.push(integration);
      }
    }
    return integrations;
  }

  private extractCadence(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('agile') || lower.includes('sprint')) return 'agile';
    if (lower.includes('kanban') || lower.includes('continuous')) return 'continuous';
    if (lower.includes('waterfall') || lower.includes('phase')) return 'waterfall';
    return 'flexible';
  }

  private extractTeamComposition(text: string): string {
    return text.slice(0, 200);
  }

  private extractQualityPractices(text: string): string[] {
    const practices: string[] = [];
    const patterns = [/\b(test|testing|review|lint|format|CI|CD|automat|manual)\w*\b/gi];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const practice = match[0].toLowerCase();
        if (!practices.includes(practice)) practices.push(practice);
      }
    }
    return practices.length > 0 ? practices : ['manual review'];
  }

  private extractDebtManagement(text: string): string {
    return text.slice(0, 300);
  }

  private extractCommunication(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('async') || lower.includes('written')) return 'async-first';
    if (lower.includes('sync') || lower.includes('meeting')) return 'sync-first';
    return 'hybrid';
  }

  private extractDecisionProcess(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('bdf') || lower.includes('lead') || lower.includes('single')) return 'centralized';
    if (lower.includes('consensus') || lower.includes('team')) return 'consensus';
    if (lower.includes('adr') || lower.includes('rfc') || lower.includes('document')) return 'documented';
    return 'flexible';
  }

  private extractDeployment(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('ci/cd') || lower.includes('automat')) return 'automated';
    if (lower.includes('manual')) return 'manual';
    return 'semi-automated';
  }

  private extractEnvironments(text: string): string {
    return text.slice(0, 200);
  }

  private extractMonitoring(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('full observ') || lower.includes('traces')) return 'comprehensive';
    if (lower.includes('basic') || lower.includes('logging')) return 'basic';
    return 'standard';
  }

  private extractConfigManagement(text: string): string {
    return text.slice(0, 200);
  }

  private extractMaintenance(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('automat') || lower.includes('proactive')) return 'proactive';
    if (lower.includes('reactive') || lower.includes('firefighting')) return 'reactive';
    return 'scheduled';
  }

  private extractStewardship(text: string): string {
    return text.slice(0, 300);
  }
}

interface ExtractionPattern {
  series_id: number;
  mappings: Array<{
    question_pattern: string;
    artifact_key: string;
    transform: (text: string) => unknown;
  }>;
}
