import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/**
 * Hand a user-initiated JSON export to the device. The web build downloads a
 * real file; native builds copy the same JSON to the clipboard, which the user
 * can paste into a notes app or migration tool. Nothing is uploaded or logged.
 */
export async function exportPreferencesJson(
  filename: string,
  json: string
): Promise<string> {
  if (Platform.OS === 'web') {
    const doc = (globalThis as any).document;
    if (!doc?.body) throw new Error('Download is unavailable in this browser.');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = doc.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      doc.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
    return `Downloaded ${filename}. Keep it somewhere private.`;
  }

  await Clipboard.setStringAsync(json);
  return 'Preferences JSON copied to the clipboard. Keep it somewhere private.';
}

export function preferenceExportAction(): string {
  return Platform.OS === 'web' ? 'Download preferences JSON' : 'Copy preferences JSON';
}
