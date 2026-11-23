import {
  PDS_DIRECTORY_API,
  normalisePdsDirectory,
  type DirectoryState,
  type PdsDirectory,
} from './pdsDirectoryModel.ts';

/** In-memory snapshot only: a flawed directory response is never persisted. */
let cached: PdsDirectory | null = null;

export type DirectoryLoad = {
  state: DirectoryState;
  directory: PdsDirectory | null;
};

/**
 * Read the public OpenPDS index. Only HTTP status and structured fields are
 * classified; a provider's free-form error text is never read or displayed.
 * A response with no usable entries is rejected rather than shown as empty
 * success, so a broken API cannot look like "no independent hosts exist".
 */
export async function loadPdsDirectory(
  fetchImpl: typeof fetch = fetch,
  fresh = false,
): Promise<DirectoryLoad> {
  if (cached && !fresh) return { state: 'ok', directory: cached };
  try {
    const response = await fetchImpl(PDS_DIRECTORY_API, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return { state: 'unavailable', directory: null };
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { state: 'invalid', directory: null };
    }
    const directory = normalisePdsDirectory(payload);
    if (!directory || directory.entries.length === 0) {
      return { state: 'invalid', directory: null };
    }
    cached = directory;
    return { state: 'ok', directory };
  } catch {
    return { state: 'unavailable', directory: null };
  }
}
