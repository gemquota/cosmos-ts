import type { LLMProvider, CompletionParams, CompletionResult } from '../types.js';

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const start = Date.now();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: params.user_prompt }] }],
        systemInstruction: { parts: [{ text: params.system_prompt }] },
        generationConfig: {
          temperature: params.temperature,
          maxOutputTokens: params.max_tokens,
          ...(params.response_format === 'json' ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    });

    const data = (await response.json()) as any;
    const latency_ms = Date.now() - start;

    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      tokens_used: {
        prompt: data.usageMetadata?.promptTokenCount || 0,
        completion: data.usageMetadata?.candidatesTokenCount || 0,
      },
      model: this.model,
      latency_ms,
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
