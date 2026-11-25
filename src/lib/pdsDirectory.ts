/**
 * Read the public OpenPDS index with the one bounded public fetch core.
 *
 * The compliance matrix already describes the PDS directory and migration
 * pre-flight as deadline-bounded; this module now matches that claim. A host
 * that accepts a connection but never finishes its body is cancelled and
 * reported as unavailable instead of leaving either screen loading forever.
 *
 * Only HTTP status and structured fields are classified; a provider's free-form
 * error text is never read or displayed. A response with no usable entries is
 * rejected rather than shown as empty success, so a broken API cannot look like
 * "no independent hosts exist". The in-memory snapshot is updated only by a
 * complete, usable response.
 */

import { readBoundedPublic } from './boundedPublicFetch.ts';
import type { TimeoutDeps } from './requestTimeout.ts';
import {
  PDS_DIRECTORY_API,
  normalisePdsDirectory,
  type DirectoryState,
  type PdsDirectory,
} from './pdsDirectoryModel.ts';

let cached: PdsDirectory | null = null;

export type DirectoryLoad = {
  state: DirectoryState;
  directory: PdsDirectory | null;
};

export async function loadPdsDirectory(
  fetchImpl: typeof fetch = fetch,
  fresh = false,
  deps: TimeoutDeps = {},
): Promise<DirectoryLoad> {
  if (cached && !fresh) return { state: 'ok', directory: cached };

  const outcome = await readBoundedPublic<unknown>(PDS_DIRECTORY_API, {
    fetchImpl,
    parse: (response) => response.json(),
    ...deps,
  });

  if (outcome.state !== 'value') {
    // A timeout, transport failure and HTTP error are all "unavailable"; a
    // malformed body is "invalid", exactly as before this reader was bounded.
    const state: DirectoryState = outcome.state === 'invalid' ? 'invalid' : 'unavailable';
    return { state, directory: null };
  }

  const directory = normalisePdsDirectory(outcome.value);
  if (!directory || directory.entries.length === 0) {
    return { state: 'invalid', directory: null };
  }
  cached = directory;
  return { state: 'ok', directory };
}
