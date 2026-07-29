import type { LLMProvider, CompletionParams, CompletionResult } from '../types.js';

/**
 * Template-based provider that uses deterministic string interpolation
 * instead of actual LLM calls. Useful for offline mode.
 */
export class TemplateProvider implements LLMProvider {
  name = 'template';

  async complete(params: CompletionParams): Promise<CompletionResult> {
    // Simple template-based response generation
    let response = '';

    if (params.system_prompt.includes('question refinement')) {
      response = this.refineQuestion(params.user_prompt);
    } else if (params.system_prompt.includes('artifact synthesis')) {
      response = this.synthesizeArtifact(params.user_prompt);
    } else if (params.system_prompt.includes('quality scoring')) {
      response = this.scoreQuality(params.user_prompt);
    } else {
      response = params.user_prompt;
    }

    return {
      text: response,
      tokens_used: { prompt: params.user_prompt.length, completion: response.length },
      model: 'template',
      latency_ms: 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private refineQuestion(prompt: string): string {
    // Extract artifacts from prompt and enhance the question
    const artifacts = this.parseArtifacts(prompt);
    const question = this.extractQuestion(prompt);

    if (Object.keys(artifacts).length === 0) return question;

    const contextParts = [];
    if (artifacts.domain) contextParts.push(`For your ${artifacts.domain} domain`);
    if (artifacts.audience_level) contextParts.push(`at the ${artifacts.audience_level} level`);

    return contextParts.length > 0 ? `${contextParts.join(', ')}, ${question.toLowerCase()}` : question;
  }

  private synthesizeArtifact(prompt: string): string {
    const artifacts = this.parseArtifacts(prompt);
    return JSON.stringify({ summary: artifacts, key_decisions: [] });
  }

  private scoreQuality(prompt: string): string {
    return JSON.stringify({ score: 0.7, dimensions: { completeness: 0.7, specificity: 0.7 }, suggestions: [] });
  }

  private parseArtifacts(prompt: string): Record<string, string> {
    const artifacts: Record<string, string> = {};
    const lines = prompt.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) artifacts[match[1]] = match[2].trim();
    }
    return artifacts;
  }

  private extractQuestion(prompt: string): string {
    const match = prompt.match(/Question:\s*(.+?)(?:\n|$)/);
    return match ? match[1] : prompt;
  }
}
