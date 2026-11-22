/**
 * Framework-free model for the device-local app icon preference.
 *
 * The official client offers a Light (default) and Dark icon. Its Bluesky+
 * "core" icon set is gated behind an internal flag, so it is an experiment and
 * is deliberately not part of Balla. `null` is the OS "reset to default icon"
 * value; the alternate icon is named `Dark` by app.json's config plugin.
 */

export type AppIconChoice = 'default' | 'dark';

export const APP_ICON_CHOICES: readonly {
  value: AppIconChoice;
  label: string;
  detail: string;
}[] = [
  { value: 'default', label: 'Light', detail: 'The Balla blue wall mark.' },
  { value: 'dark', label: 'Dark', detail: 'The wall mark on a dark background.' },
];

/** The native alternate-icon name for a choice; null resets to the default. */
export function nativeNameForChoice(choice: AppIconChoice): string | null {
  return choice === 'dark' ? 'Dark' : null;
}

/** Map an OS-reported icon name back to a choice, defaulting to Default. */
export function choiceForNativeName(name: string | null | undefined): AppIconChoice {
  if (typeof name === 'string' && name.toLowerCase() === 'dark') return 'dark';
  return 'default';
}

export function isAppIconChoice(value: unknown): value is AppIconChoice {
  return value === 'default' || value === 'dark';
}
