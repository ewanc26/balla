import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  REPORT_RECEIPT_KEY,
  appendReceipt,
  normaliseReceipts,
  type ReportReceipt,
} from './reportModel';

// Receipts are a local convenience. Storage failures must never turn a report
// the moderation service accepted into a visible failure, so every read falls
// back to an empty list and every write is best-effort.
let cache: ReportReceipt[] | null = null;

export async function loadReportReceipts(): Promise<ReportReceipt[]> {
  if (cache) return cache;
  try {
    const stored = await AsyncStorage.getItem(REPORT_RECEIPT_KEY);
    cache = normaliseReceipts(stored ? JSON.parse(stored) : []);
  } catch {
    cache = [];
  }
  return cache;
}

export async function recordReportReceipt(receipt: ReportReceipt): Promise<void> {
  const next = appendReceipt(cache || (await loadReportReceipts()), receipt);
  cache = next;
  try {
    await AsyncStorage.setItem(REPORT_RECEIPT_KEY, JSON.stringify(next));
  } catch {
    // The report is still sent; only the local reminder is unavailable.
  }
}

export async function clearReportReceipts(): Promise<void> {
  cache = [];
  try {
    await AsyncStorage.removeItem(REPORT_RECEIPT_KEY);
  } catch {
    // Nothing else depends on this key.
  }
}
