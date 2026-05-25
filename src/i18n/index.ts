import en from './locales/en.json' with { type: 'json' };
import af from './locales/af.json' with { type: 'json' };
import zu from './locales/zu.json' with { type: 'json' };

export type Locale = 'en' | 'af' | 'zu';
export type TranslationKey = string;

const LOCALES: Record<Locale, Record<string, unknown>> = { en, af, zu };

const DEFAULT_LOCALE: Locale = 'en';

/**
 * Get a translated string with variable interpolation.
 * Keys use dot notation: "bot.greeting", "bot.menu", etc.
 * Variables are interpolated via {{variable}} syntax.
 */
export function t(locale: string | undefined, key: string, vars?: Record<string, string | number>): string {
  const lang = (locale && locale in LOCALES ? locale : DEFAULT_LOCALE) as Locale;
  const translations = LOCALES[lang];

  const value = getNestedValue(translations, key);
  if (typeof value !== 'string') {
    // Fallback to English if key not found in target locale
    const fallback = getNestedValue(LOCALES[DEFAULT_LOCALE], key);
    if (typeof fallback !== 'string') return key;
    return interpolate(fallback, vars);
  }

  return interpolate(value, vars);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? `{{${key}}}`));
}

export function getSupportedLocales(): Locale[] {
  return Object.keys(LOCALES) as Locale[];
}

export function isValidLocale(locale: string): locale is Locale {
  return locale in LOCALES;
}
