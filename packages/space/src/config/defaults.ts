import { homedir } from 'os';
import { join } from 'path';

export interface SpaceConfig {
  projects_dir: string;
  framework_dir: string;
  llm_provider: 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'ollama' | 'local' | 'none';
  llm_model: string;
  llm_api_key?: string;
  llm_base_url?: string;
  llm_temperature: number;
  llm_max_tokens: number;
  enable_adaptive_questions: boolean;
  enable_quality_scoring: boolean;
  auto_save_interval_ms: number;
  default_export_format: 'json' | 'markdown' | 'yaml' | 'prompt';
  export_include_metadata: boolean;
  locale: string;
  fallback_locale: string;
}

export const DEFAULT_CONFIG: SpaceConfig = {
  projects_dir: join(homedir(), '.space', 'projects'),
  framework_dir: join(homedir(), '.space', 'framework'),
  llm_provider: 'none',
  llm_model: 'gpt-4o',
  llm_temperature: 0.7,
  llm_max_tokens: 4096,
  enable_adaptive_questions: true,
  enable_quality_scoring: true,
  auto_save_interval_ms: 10000,
  default_export_format: 'markdown',
  export_include_metadata: true,
  locale: 'en',
  fallback_locale: 'en',
};
