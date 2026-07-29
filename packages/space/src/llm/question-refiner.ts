import type { LLMProvider } from './types.js';

const SYSTEM_PROMPT = `You are a specification elicitation assistant. Your job is to refine questions to be more context-aware based on the user's accumulated answers.

Given a question and prior context (artifacts), produce a refined version of the question that:
1. References the user's specific domain and choices
2. Asks for more targeted information
3. Maintains the original question's intent
4. Is clear and actionable

Return ONLY the refined question text, nothing else.`;

export class QuestionRefiner {
  constructor(private provider: LLMProvider) {}

  async refine(
    question_text: string,
    artifacts: Record<string, any>,
    series_context: { series_name: string; round_focus: string },
  ): Promise<{ refined_text: string; original_text: string; artifacts_used: string[] }> {
    const artifacts_used = Object.keys(artifacts);

    const user_prompt = `Question: ${question_text}
Series: ${series_context.series_name}
Focus: ${series_context.round_focus}

Prior context:
${
  Object.entries(artifacts)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n') || 'None yet'
}

Refine this question based on the context above.`;

    const result = await this.provider.complete({
      system_prompt: SYSTEM_PROMPT,
      user_prompt,
      temperature: 0.3,
    });

    return {
      refined_text: result.text || question_text,
      original_text: question_text,
      artifacts_used,
    };
  }
}
