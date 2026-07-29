export interface LLMProvider {
  name: string;
  complete(params: CompletionParams): Promise<CompletionResult>;
  isAvailable(): Promise<boolean>;
}

export interface CompletionParams {
  system_prompt: string;
  user_prompt: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: 'text' | 'json';
}

export interface CompletionResult {
  text: string;
  tokens_used: { prompt: number; completion: number };
  model: string;
  latency_ms: number;
}
