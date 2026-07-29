import type { LLMProvider, CompletionParams, CompletionResult } from '../types.js';

export class NullProvider implements LLMProvider {
  name = 'null';

  async complete(params: CompletionParams): Promise<CompletionResult> {
    return {
      text: '[LLM unavailable — template mode]',
      tokens_used: { prompt: 0, completion: 0 },
      model: 'none',
      latency_ms: 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}
