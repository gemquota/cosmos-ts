import type { LocaleCode, LocaleDefinition, LocaleMessages } from './types.js';
import { enLocale } from './locales/en.js';
import { esLocale } from './locales/es.js';
import { frLocale } from './locales/fr.js';

const LOCALE_MAP: Record<string, LocaleDefinition> = {
  en: enLocale,
  es: esLocale,
  fr: frLocale,
};

let currentLocale: LocaleDefinition = enLocale;

/**
 * Set the active locale.
 * Falls back to 'en' if the requested locale is not available.
 */
export function setLocale(code: LocaleCode | string): void {
  currentLocale = LOCALE_MAP[code] || enLocale;
}

/**
 * Get the currently active locale code.
 */
export function getLocale(): LocaleCode {
  return currentLocale.code;
}

/**
 * Get the available locale codes.
 */
export function getAvailableLocales(): LocaleCode[] {
  return Object.keys(LOCALE_MAP) as LocaleCode[];
}

/**
 * Translate a key from the active locale.
 * Supports simple {placeholder} substitution.
 * Key format: 'category.key' e.g. 'cli.project_created'
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let msg: any = currentLocale.messages;
  for (const part of parts) {
    if (msg && typeof msg === 'object' && part in msg) {
      msg = msg[part];
    } else {
      // Fallback to English
      msg = enLocale.messages;
      for (const p of parts) {
        if (msg && typeof msg === 'object' && p in msg) {
          msg = msg[p];
        } else {
          return key; // Key not found
        }
      }
      break;
    }
  }

  if (typeof msg !== 'string') return key;

  // Substitute {placeholders}
  if (params) {
    return msg.replace(/{(w+)}/g, (_, name) => String(params[name] ?? '{' + name + '}'));
  }

  return msg;
}

/**
 * Get raw messages object for the current locale.
 */
export function getMessages(): LocaleMessages {
  return currentLocale.messages;
}

export { enLocale, esLocale, frLocale };
export type { LocaleCode, LocaleDefinition, LocaleMessages };
