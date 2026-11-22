/**
 * Native/web boundary for the device-local app icon preference.
 *
 * The official client uses a native-only module and throws on web. Balla keeps
 * the same source of truth (the OS-reported icon name) but loads the native
 * module lazily: web stays safe, and an old native dev build without the new
 * config plugin still starts instead of failing at import time.
 */
import { Platform } from 'react-native';
import type { AppIconChoice } from './appIconModel';
import { choiceForNativeName, nativeNameForChoice } from './appIconModel';

type NativeIconModule = {
  supportsAlternateIcons: boolean;
  getAppIconName: () => string | null;
  setAlternateAppIcon: (name: string | null) => Promise<string | null>;
};

let cachedModule: NativeIconModule | undefined;

function nativeModule(): NativeIconModule | undefined {
  if (Platform.OS === 'web') return undefined;
  if (cachedModule) return cachedModule;
  try {
    cachedModule = require('expo-alternate-app-icons') as NativeIconModule;
    return cachedModule;
  } catch {
    return undefined;
  }
}

export function isAppIconSupported(): boolean {
  return nativeModule()?.supportsAlternateIcons === true;
}

export function readAppIconChoice(): AppIconChoice {
  const native = nativeModule();
  if (!native?.supportsAlternateIcons) return 'default';
  try {
    return choiceForNativeName(native.getAppIconName());
  } catch {
    return 'default';
  }
}

export async function writeAppIconChoice(choice: AppIconChoice): Promise<AppIconChoice> {
  const native = nativeModule();
  if (!native?.supportsAlternateIcons) return 'default';
  const applied = await native.setAlternateAppIcon(nativeNameForChoice(choice));
  return choiceForNativeName(applied);
}
