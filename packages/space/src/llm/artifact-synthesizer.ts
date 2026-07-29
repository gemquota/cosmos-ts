import type { LLMProvider } from './types.js';

const SYSTEM_PROMPT = `You are a specification synthesizer. Given a user's answer to a scoping question, extract and structure the key information.

Extract:
1. Key decisions and facts
2. Implications for the specification
3. Confidence level (high/medium/low)

Return a structured summary.`;

export class ArtifactSynthesizer {
  constructor(private provider: LLMProvider) {}

  async synthesize(params: {
    question_text: string;
    open_ended_answer: string;
    selected_choice: string;
    prior_artifacts: Record<string, any>;
  }): Promise<{ summary: string; key_decisions: string[] }> {
    const user_prompt = `Question: ${params.question_text}
Answer: ${params.open_ended_answer}
Choice: ${params.selected_choice}

Prior context: ${JSON.stringify(params.prior_artifacts, null, 2)}

Extract key decisions and facts.`;

    const result = await this.provider.complete({
      system_prompt: SYSTEM_PROMPT,
      user_prompt,
      temperature: 0.3,
    });

    try {
      const parsed = JSON.parse(result.text);
      return { summary: parsed.summary || result.text, key_decisions: parsed.key_decisions || [] };
    } catch {
      return { summary: result.text, key_decisions: [] };
    }
  }
}
