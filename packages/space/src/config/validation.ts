// ==========================================
// Configuration Validation & Environment Wiring
// Fixes: config validation, env var mapping, startup checks
// ==========================================

import { DEFAULT_CONFIG, type SpaceConfig } from './defaults.js';

const VALID_PROVIDERS = ['openai', 'anthropic', 'gemini', 'mistral', 'ollama', 'local', 'none'] as const;
const VALID_EXPORT_FORMATS = ['json', 'markdown', 'yaml', 'prompt'] as const;

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigError[];
  warnings: ConfigWarning[];
}

export interface ConfigError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ConfigWarning {
  field: string;
  message: string;
  severity: 'warning';
}

/**
 * Validate a SpaceConfig object, returning all errors and warnings.
 * Catches issues at startup rather than at runtime.
 */
export function validateConfig(config: Partial<SpaceConfig>): ConfigValidationResult {
  const errors: ConfigError[] = [];
  const warnings: ConfigWarning[] = [];

  // Validate LLM provider
  if (config.llm_provider && !VALID_PROVIDERS.includes(config.llm_provider as any)) {
    errors.push({
      field: 'llm_provider',
      message: `Invalid provider "${config.llm_provider}". Must be one of: ${VALID_PROVIDERS.join(', ')}`,
      severity: 'error',
    });
  }

  // Validate LLM API key presence when provider requires it
  if (
    config.llm_provider &&
    config.llm_provider !== 'none' &&
    config.llm_provider !== 'local' &&
    config.llm_provider !== 'ollama'
  ) {
    if (!config.llm_api_key) {
      warnings.push({
        field: 'llm_api_key',
        message: `Provider "${config.llm_provider}" requires an API key. Set SPACE_LLM_API_KEY or pass llm_api_key in config.`,
        severity: 'warning',
      });
    }
  }

  // Validate export format
  if (config.default_export_format && !VALID_EXPORT_FORMATS.includes(config.default_export_format as any)) {
    errors.push({
      field: 'default_export_format',
      message: `Invalid format "${config.default_export_format}". Must be one of: ${VALID_EXPORT_FORMATS.join(', ')}`,
      severity: 'error',
    });
  }

  // Validate temperature range
  if (config.llm_temperature !== undefined) {
    if (config.llm_temperature < 0 || config.llm_temperature > 2) {
      errors.push({
        field: 'llm_temperature',
        message: `Temperature ${config.llm_temperature} out of range [0, 2]`,
        severity: 'error',
      });
    }
    if (config.llm_temperature > 1.5) {
      warnings.push({
        field: 'llm_temperature',
        message: `Temperature ${config.llm_temperature} is unusually high. Values above 1.5 produce very random outputs.`,
        severity: 'warning',
      });
    }
  }

  // Validate max tokens
  if (config.llm_max_tokens !== undefined && config.llm_max_tokens < 1) {
    errors.push({
      field: 'llm_max_tokens',
      message: `max_tokens must be positive, got ${config.llm_max_tokens}`,
      severity: 'error',
    });
  }

  // Validate auto_save interval
  if (config.auto_save_interval_ms !== undefined && config.auto_save_interval_ms < 1000) {
    warnings.push({
      field: 'auto_save_interval_ms',
      message: `Auto-save interval ${config.auto_save_interval_ms}ms is very frequent. Consider >= 5000ms.`,
      severity: 'warning',
    });
  }

  // Validate locale
  if (config.locale && !/^[a-z]{2}(-[A-Z]{2})?$/.test(config.locale)) {
    warnings.push({
      field: 'locale',
      message: `Locale "${config.locale}" doesn't match expected format (e.g., "en", "en-US")`,
      severity: 'warning',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Merge environment variables into a SpaceConfig.
 * Maps SPACE_* env vars to config fields.
 */
export function configFromEnv(overrides?: Partial<SpaceConfig>): SpaceConfig {
  const env = process.env;
  const config = { ...DEFAULT_CONFIG, ...overrides };

  // Wire environment variables
  if (env.SPACE_PROJECTS_DIR) config.projects_dir = env.SPACE_PROJECTS_DIR;
  if (env.SPACE_FRAMEWORK_DIR) config.framework_dir = env.SPACE_FRAMEWORK_DIR;
  if (env.SPACE_LLM_PROVIDER) config.llm_provider = env.SPACE_LLM_PROVIDER as SpaceConfig['llm_provider'];
  if (env.SPACE_LLM_MODEL) config.llm_model = env.SPACE_LLM_MODEL;
  if (env.SPACE_LLM_API_KEY) config.llm_api_key = env.SPACE_LLM_API_KEY;
  if (env.SPACE_LLM_BASE_URL) config.llm_base_url = env.SPACE_LLM_BASE_URL;
  if (env.SPACE_LLM_TEMPERATURE) config.llm_temperature = parseFloat(env.SPACE_LLM_TEMPERATURE);
  if (env.SPACE_LLM_MAX_TOKENS) config.llm_max_tokens = parseInt(env.SPACE_LLM_MAX_TOKENS, 10);
  if (env.SPACE_ENABLE_ADAPTIVE) config.enable_adaptive_questions = env.SPACE_ENABLE_ADAPTIVE === 'true';
  if (env.SPACE_ENABLE_QUALITY) config.enable_quality_scoring = env.SPACE_ENABLE_QUALITY === 'true';
  if (env.SPACE_AUTO_SAVE_MS) config.auto_save_interval_ms = parseInt(env.SPACE_AUTO_SAVE_MS, 10);
  if (env.SPACE_DEFAULT_EXPORT)
    config.default_export_format = env.SPACE_DEFAULT_EXPORT as SpaceConfig['default_export_format'];
  if (env.SPACE_LOCALE) config.locale = env.SPACE_LOCALE;

  return config;
}

/**
 * Validate config and throw on errors, warn on warnings.
 * Call at startup after loading config.
 */
export function assertValidConfig(config: Partial<SpaceConfig>): void {
  const result = validateConfig(config);

  for (const warn of result.warnings) {
    console.warn(`[config] WARNING: ${warn.field}: ${warn.message}`);
  }

  if (!result.valid) {
    const errMsg = result.errors.map((e) => `${e.field}: ${e.message}`).join('\n  ');
    throw new Error(`Configuration errors:\n  ${errMsg}`);
  }
}

/**
 * List all supported environment variables with descriptions.
 */
export function listEnvVars(): Record<string, { env: string; type: string; description: string }> {
  return {
    projects_dir: { env: 'SPACE_PROJECTS_DIR', type: 'string', description: 'Directory for project data' },
    framework_dir: { env: 'SPACE_FRAMEWORK_DIR', type: 'string', description: 'Directory for framework definitions' },
    llm_provider: {
      env: 'SPACE_LLM_PROVIDER',
      type: 'string',
      description: 'LLM provider (openai|anthropic|gemini|mistral|ollama|local|none)',
    },
    llm_model: { env: 'SPACE_LLM_MODEL', type: 'string', description: 'LLM model identifier' },
    llm_api_key: { env: 'SPACE_LLM_API_KEY', type: 'string', description: 'API key for LLM provider' },
    llm_base_url: { env: 'SPACE_LLM_BASE_URL', type: 'string', description: 'Custom LLM API base URL' },
    llm_temperature: { env: 'SPACE_LLM_TEMPERATURE', type: 'number', description: 'LLM temperature (0-2)' },
    llm_max_tokens: { env: 'SPACE_LLM_MAX_TOKENS', type: 'number', description: 'Max tokens per LLM response' },
    enable_adaptive: { env: 'SPACE_ENABLE_ADAPTIVE', type: 'boolean', description: 'Enable adaptive question routing' },
    enable_quality: { env: 'SPACE_ENABLE_QUALITY', type: 'boolean', description: 'Enable quality scoring' },
    auto_save_ms: { env: 'SPACE_AUTO_SAVE_MS', type: 'number', description: 'Auto-save interval in ms' },
    default_export: { env: 'SPACE_DEFAULT_EXPORT', type: 'string', description: 'Default export format' },
    locale: { env: 'SPACE_LOCALE', type: 'string', description: 'UI locale (e.g., en, en-US)' },
  };
}
