import type { LLMProvider } from './types.js';
import { NullProvider } from './providers/null-provider.js';
import { TemplateProvider } from './providers/template-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { AnthropicProvider } from './providers/anthropic-provider.js';
import { GeminiProvider } from './providers/gemini-provider.js';
import { MistralProvider } from './providers/mistral-provider.js';
import { OllamaProvider } from './providers/ollama-provider.js';
import type { SpaceConfig } from '../config/defaults.js';

export function createProvider(config: SpaceConfig): LLMProvider {
  switch (config.llm_provider) {
    case 'openai':
      if (!config.llm_api_key) return new TemplateProvider();
      return new OpenAIProvider(config.llm_api_key, config.llm_model);
    case 'anthropic':
      if (!config.llm_api_key) return new TemplateProvider();
      return new AnthropicProvider(config.llm_api_key, config.llm_model);
    case 'gemini':
      if (!config.llm_api_key) return new TemplateProvider();
      return new GeminiProvider(config.llm_api_key, config.llm_model);
    case 'mistral':
      if (!config.llm_api_key) return new TemplateProvider();
      return new MistralProvider(config.llm_api_key, config.llm_model);
    case 'ollama':
      return new OllamaProvider(config.llm_base_url || 'http://localhost:11434', config.llm_model);
    case 'local':
      return new OllamaProvider(config.llm_base_url || 'http://localhost:11434', config.llm_model);
    case 'none':
    default:
      return new NullProvider();
  }
}

export function createTemplateProvider(): LLMProvider {
  return new TemplateProvider();
}
