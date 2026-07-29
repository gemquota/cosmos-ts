import type { LLMProvider, CompletionParams, CompletionResult } from '../types.js';

export class MistralProvider implements LLMProvider {
  name = 'mistral';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'mistral-large-latest') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const start = Date.now();

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: params.system_prompt },
          { role: 'user', content: params.user_prompt },
        ],
        temperature: params.temperature,
        max_tokens: params.max_tokens,
      }),
    });

    const data = (await response.json()) as any;
    const latency_ms = Date.now() - start;

    return {
      text: data.choices?.[0]?.message?.content || '',
      tokens_used: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
      },
      model: this.model,
      latency_ms,
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
