import type { ArtifactDictionary } from '../types/index.js';
import { TEMPLATE_VAR_PATTERN, extractTemplateVars } from './patterns.js';

const MAX_RECURSION_DEPTH = 5;

/**
 * Resolve template variables in a string against an artifact dictionary.
 *
 * Unresolved keys become `[Not yet determined: {key}]`.
 * Supports nested resolution up to MAX_RECURSION_DEPTH.
 */
export function resolveTemplate(text: string, artifacts: ArtifactDictionary, depth: number = 0): string {
  if (depth >= MAX_RECURSION_DEPTH) {
    return text.replace(TEMPLATE_VAR_PATTERN, (_match, key: string) => {
      return `[Circular ref: ${key}]`;
    });
  }

  return text.replace(TEMPLATE_VAR_PATTERN, (_match, key: string) => {
    const artifact = artifacts[key];
    if (!artifact || artifact.value === null || artifact.value === undefined) {
      return `[Not yet determined: ${key}]`;
    }
    const value = typeof artifact.value === 'object' ? JSON.stringify(artifact.value) : String(artifact.value);

    // If the resolved value itself contains template vars, resolve them too
    if (TEMPLATE_VAR_PATTERN.test(value)) {
      return resolveTemplate(value, artifacts, depth + 1);
    }
    return value;
  });
}

/**
 * Resolve template variables in an entire document (multi-line).
 */
export function resolveDocument(text: string, artifacts: ArtifactDictionary): string {
  return resolveTemplate(text, artifacts, 0);
}

/**
 * Resolve template variables in MD context lines.
 * Context lines are lines 3-7 of the MD series files that contain artifact refs.
 */
export function resolveContextLines(lines: string[], artifacts: ArtifactDictionary): string[] {
  return lines.map((line) => resolveTemplate(line, artifacts, 0));
}

/**
 * Check if a template variable is resolved (not placeholder)
 */
export function isResolved(key: string, artifacts: ArtifactDictionary): boolean {
  const artifact = artifacts[key];
  return !!(artifact && artifact.value !== null && artifact.value !== undefined);
}

/**
 * Get all unresolved keys in a text
 */
export function getUnresolvedKeys(text: string, artifacts: ArtifactDictionary): string[] {
  const keys = extractTemplateVars(text);
  return keys.filter((key) => !isResolved(key, artifacts));
}
