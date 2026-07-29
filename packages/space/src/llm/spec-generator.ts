import type { LLMProvider } from './types.js';
import type { FrameworkDefinition, ArtifactDictionary } from '../types/index.js';

const SYSTEM_PROMPT = `You are a technical specification writer. Given artifacts from a structured elicitation process, generate a comprehensive development specification.

Format as Markdown with headers, lists, and code blocks where appropriate.`;

export class SpecificationGenerator {
  constructor(private provider: LLMProvider) {}

  async generate(params: {
    project_name: string;
    artifacts: ArtifactDictionary;
    answers: Record<string, any>;
    framework: FrameworkDefinition;
    format: 'full' | 'executive_summary';
  }): Promise<{ content: string; word_count: number; quality_score: number }> {
    const artifactSummary = Object.entries(params.artifacts)
      .map(([k, v]) => `- ${k}: ${typeof v.value === 'object' ? JSON.stringify(v.value) : v.value}`)
      .join('\n');

    const user_prompt = `Project: ${params.project_name}\nFormat: ${params.format}\n\nArtifacts:\n${artifactSummary || 'None yet.'}\n\nGenerate a ${params.format} specification.`;

    const result = await this.provider.complete({
      system_prompt: SYSTEM_PROMPT,
      user_prompt,
      temperature: 0.5,
      max_tokens: 8192,
    });

    const content = result.text;
    const word_count = content.split(/\s+/).length;
    const quality_score = Math.min(word_count / 1000, 1);
    return { content, word_count, quality_score };
  }
}
