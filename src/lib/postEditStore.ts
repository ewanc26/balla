/**
 * Session-local record of edits made in this app run. It lets the card that
 * opened the edit show the new text and the Edited badge immediately, without
 * polling the AppView or granting another read scope. The store is replaced by
 * the server's record on the next normal fetch and never leaves this device.
 */

const records = new Map<string, Record<string, any>>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function notePostEdit(uri: string, record: Record<string, any>) {
  if (!uri || !record) return;
  records.set(uri, record);
  emit();
}

export function postEditRecord(uri: string): Record<string, any> | undefined {
  return records.get(uri);
}

export function subscribePostEdits(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
