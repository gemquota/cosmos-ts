import type { LLMProvider, CompletionParams, CompletionResult } from '../types.js';

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llama3.1') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: params.system_prompt },
          { role: 'user', content: params.user_prompt },
        ],
        stream: false,
        options: {
          temperature: params.temperature,
          num_predict: params.max_tokens,
        },
      }),
    });

    const data = (await response.json()) as any;
    const latency_ms = Date.now() - start;

    return {
      text: data.message?.content || '',
      tokens_used: {
        prompt: data.prompt_eval_count || 0,
        completion: data.eval_count || 0,
      },
      model: this.model,
      latency_ms,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/tags`);
      return resp.ok;
    } catch {
      return false;
    }
  }
}
