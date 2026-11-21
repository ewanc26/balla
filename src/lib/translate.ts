// Balla has no on-device translation module, so translation uses Google's
// public translate endpoint, the same fallback the official web client links
// out to. It is user-initiated from the post menu and never runs in the
// background. The menu copy says the post text is sent to Google.

const TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

export type TranslationResult = {
  text: string;
  sourceLanguage?: string;
};

export function parseGoogleTranslation(payload: any): TranslationResult {
  const segments = payload && payload[0];
  if (!Array.isArray(segments)) {
    throw new Error('Unexpected translation response');
  }
  const text = segments
    .map((segment: any) => (Array.isArray(segment) ? segment[0] : ''))
    .filter((part: any) => typeof part === 'string' && part.length > 0)
    .join('');
  if (!text.trim()) throw new Error('Empty translation');
  return {
    text,
    sourceLanguage: typeof payload[2] === 'string' ? payload[2] : undefined,
  };
}

export async function translateText(
  text: string,
  targetLanguage = 'en'
): Promise<TranslationResult> {
  const url =
    `${TRANSLATE_ENDPOINT}?client=gtx&sl=auto&tl=${encodeURIComponent(targetLanguage)}` +
    `&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Translation request failed (${response.status})`);
  }
  return parseGoogleTranslation(await response.json());
}
