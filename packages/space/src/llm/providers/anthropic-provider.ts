import type { LLMProvider, CompletionParams, CompletionResult } from '../types.js';

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private api_key: string;
  private model: string;

  constructor(api_key: string, model: string = 'claude-3-5-sonnet-20241022') {
    this.api_key = api_key;
    this.model = model;
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const start = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.api_key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: params.max_tokens ?? 4096,
        system: params.system_prompt,
        messages: [{ role: 'user', content: params.user_prompt }],
        temperature: params.temperature ?? 0.7,
      }),
    });

    const data = (await response.json()) as any;
    const latency_ms = Date.now() - start;

    return {
      text: data.content?.[0]?.text || '',
      tokens_used: {
        prompt: data.usage?.input_tokens || 0,
        completion: data.usage?.output_tokens || 0,
      },
      model: this.model,
      latency_ms,
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.api_key;
  }
}
