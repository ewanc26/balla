/**
 * AsyncStorage-backed persistence for the composer's unfinished post.
 * The pure model lives in `draftModel.ts`; this module only reads and writes
 * one key so the recovery flow has a single source of truth.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseStoredDraft,
  serialiseDraft,
  type StoredDraft,
} from './draftModel';

const DRAFT_KEY = 'balla.compose.draft.v1';

export async function loadStoredDraft(): Promise<StoredDraft | null> {
  try {
    return parseStoredDraft(await AsyncStorage.getItem(DRAFT_KEY));
  } catch {
    // Storage can be unavailable (private mode, a full disk); recovery is optional.
    return null;
  }
}

export async function saveStoredDraft(draft: StoredDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, serialiseDraft(draft));
  } catch {
    // Losing recovery is preferable to blocking the composer.
  }
}

export async function clearStoredDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing else we can do; the next save will overwrite the stale value.
  }
}
