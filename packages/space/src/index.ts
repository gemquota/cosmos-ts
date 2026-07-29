// SPACE — Superb Prompt Automatic Creation Engine
// Public API

export { createSpace } from './engine/core.js';
export type { SpaceConfig } from './config/defaults.js';
export { validateConfig, configFromEnv, assertValidConfig, listEnvVars } from './config/validation.js';
export type { ConfigValidationResult, ConfigError, ConfigWarning } from './config/validation.js';
export { KNOWN_ARTIFACT_KEYS, validateArtifactKey, validateArtifactDictionary } from './data/artifact-keys.js';
export { ArtifactTracker, artifactHash } from './data/artifact-tracker.js';
export { ArtifactExtractor } from './data/artifact-extractor.js';
export type { ExtractionResult, ExtractionWarning } from './data/artifact-extractor.js';
export { t, setLocale, getLocale, getAvailableLocales, getMessages } from './i18n/index.js';
export type { LocaleCode, LocaleDefinition, LocaleMessages } from './i18n/types.js';
export type {
  FrameworkDefinition,
  SessionState,
  AnswerEntry,
  ArtifactDictionary,
  Project,
  SessionSummary,
  ExportFormat,
  ExportResult,
} from './types/index.js';
