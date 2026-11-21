/**
 * Per-post publishing options: self-applied content warnings and post
 * languages. Framework-free so the rules can be checked under Node without a
 * React Native runtime.
 *
 * Both fields are part of the `app.bsky.feed.post` lexicon (`labels` and
 * `langs`). The self-label values are the four the official client publishes,
 * not an invented vocabulary; language codes are BCP-47 tags.
 */

export const MAX_POST_LANGUAGES = 3;

export type SelfLabelOption = {
  value: string;
  label: string;
  detail: string;
  adult: boolean;
};

/** The four values the Bluesky composer can self-apply. */
export const SELF_LABEL_OPTIONS: readonly SelfLabelOption[] = [
  {
    value: 'sexual',
    label: 'Suggestive',
    detail: 'Sexually suggestive content.',
    adult: true,
  },
  {
    value: 'nudity',
    label: 'Nudity',
    detail: 'Depictions of nudity.',
    adult: true,
  },
  {
    value: 'porn',
    label: 'Adult',
    detail: 'Explicit adult content.',
    adult: true,
  },
  {
    value: 'graphic-media',
    label: 'Graphic media',
    detail: 'Graphic or violent imagery.',
    adult: false,
  },
];

export type LanguageOption = { code: string; label: string };

/** A short, real BCP-47 list; not an exhaustive registry. */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'gd', label: 'Gàidhlig' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
];

const SELF_LABEL_VALUES = new Set(SELF_LABEL_OPTIONS.map((option) => option.value));
const LANGUAGE_CODES = new Set(LANGUAGE_OPTIONS.map((option) => option.code));
const LANGUAGE_LABELS = new Map(
  LANGUAGE_OPTIONS.map((option) => [option.code, option.label])
);

export function isValidSelfLabel(value: string): boolean {
  return SELF_LABEL_VALUES.has(value);
}

export function isValidLanguage(code: string): boolean {
  return LANGUAGE_CODES.has(code);
}

/** Drop unknown and repeated labels, preserving the order the person chose. */
export function normaliseSelfLabels(values: readonly string[]): string[] {
  return [...new Set(values.filter(isValidSelfLabel))];
}

/** Drop unknown and repeated codes and enforce the client's three-language cap. */
export function normaliseLanguages(codes: readonly string[]): string[] {
  return [...new Set(codes.filter(isValidLanguage))].slice(0, MAX_POST_LANGUAGES);
}

/**
 * The `labels` field of an `app.bsky.feed.post` record. Omitted entirely when
 * nothing is selected so an empty selfLabels object is never published.
 */
export function buildSelfLabels(values: readonly string[]):
  | {
      $type: 'com.atproto.label.defs#selfLabels';
      values: {
        $type: 'com.atproto.label.defs#selfLabel';
        val: string;
      }[];
    }
  | undefined {
  const labels = normaliseSelfLabels(values);
  if (!labels.length) return undefined;
  return {
    $type: 'com.atproto.label.defs#selfLabels',
    values: labels.map((val) => ({
      $type: 'com.atproto.label.defs#selfLabel',
      val,
    })),
  };
}

/** A short label for the composer button, in the person's chosen order. */
export function languageSummary(codes: readonly string[]): string {
  const normalised = normaliseLanguages(codes);
  if (!normalised.length) return 'Language';
  return normalised.map((code) => LANGUAGE_LABELS.get(code) || code).join(' + ');
}
