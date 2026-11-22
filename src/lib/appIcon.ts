/**
 * Native/web boundary for the device-local app icon preference.
 *
 * The official client uses a native-only module and throws on web. Balla keeps
 * the same source of truth (the OS-reported icon name) but returns a safe
 * default on web so the exported client and its settings routes still build.
 */
import { Platform } from 'react-native';
import {
  getAppIconName,
  setAlternateAppIcon,
  supportsAlternateIcons,
} from 'expo-alternate-app-icons';
import type { AppIconChoice } from './appIconModel';
import { choiceForNativeName, nativeNameForChoice } from './appIconModel';

export function isAppIconSupported(): boolean {
  return Platform.OS !== 'web' && supportsAlternateIcons;
}

export function readAppIconChoice(): AppIconChoice {
  if (!isAppIconSupported()) return 'default';
  try {
    return choiceForNativeName(getAppIconName());
  } catch {
    return 'default';
  }
}

export async function writeAppIconChoice(choice: AppIconChoice): Promise<AppIconChoice> {
  if (!isAppIconSupported()) return 'default';
  const applied = await setAlternateAppIcon(nativeNameForChoice(choice));
  return choiceForNativeName(applied);
}
