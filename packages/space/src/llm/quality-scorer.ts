import type { LLMProvider } from './types.js';

const SYSTEM_PROMPT = `You are a quality assessor for specification answers. Score the answer on:
1. Completeness (0-1): How thoroughly does it address the question?
2. Specificity (0-1): How concrete and specific is it?

Return JSON: { "score": 0-1, "completeness": 0-1, "specificity": 0-1, "suggestions": ["..."] }`;

export class QualityScorer {
  constructor(private provider: LLMProvider) {}

  async scoreAnswer(params: {
    question_text: string;
    answer_text: string;
    choice_text: string;
  }): Promise<{ score: number; dimensions: { completeness: number; specificity: number }; suggestions: string[] }> {
    const user_prompt = `Question: ${params.question_text}\nAnswer: ${params.answer_text}\nChoice: ${params.choice_text}\n\nScore this answer.`;

    const result = await this.provider.complete({
      system_prompt: SYSTEM_PROMPT,
      user_prompt,
      temperature: 0.1,
      response_format: 'json',
    });

    try {
      const parsed = JSON.parse(result.text);
      return {
        score: parsed.score ?? 0.5,
        dimensions: { completeness: parsed.completeness ?? 0.5, specificity: parsed.specificity ?? 0.5 },
        suggestions: parsed.suggestions ?? [],
      };
    } catch {
      const length = params.answer_text.length;
      const completeness = Math.min(length / 200, 1);
      const specificity = length > 50 ? 0.7 : 0.3;
      return {
        score: (completeness + specificity) / 2,
        dimensions: { completeness, specificity },
        suggestions: length < 50 ? ['Consider providing more detail'] : [],
      };
    }
  }

  async scoreSession(answers: Record<string, { open_ended_text: string; multi_choice_text?: string }>): Promise<{
    overall_score: number;
    per_answer: Record<string, number>;
    weak_areas: string[];
  }> {
    const per_answer: Record<string, number> = {};
    let total = 0,
      count = 0;
    const weak_areas: string[] = [];
    for (const [qid, answer] of Object.entries(answers)) {
      const length = answer.open_ended_text?.length || 0;
      const score = Math.min(length / 200, 1);
      per_answer[qid] = score;
      total += score;
      count++;
      if (score < 0.3) weak_areas.push(qid);
    }
    return { overall_score: count > 0 ? total / count : 0, per_answer, weak_areas };
  }
}
