/**
 * Template variable patterns for MD spec interpolation.
 * Matches {artifact_key} placeholders in markdown context lines.
 */
export const TEMPLATE_VAR_PATTERN = /\{([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*)\}/g;

/**
 * Extract all template variable keys from a string.
 * Uses String.matchAll for better performance than manual RegExp creation.
 */
export function extractTemplateVars(text: string): string[] {
  const matches = text.matchAll(TEMPLATE_VAR_PATTERN);
  const keys: string[] = [];
  for (const match of matches) {
    keys.push(match[1]);
  }
  return [...new Set(keys)];
}

/**
 * Check if a string contains any template variables
 */
export function hasTemplateVars(text: string): boolean {
  TEMPLATE_VAR_PATTERN.lastIndex = 0;
  return TEMPLATE_VAR_PATTERN.test(text);
}
