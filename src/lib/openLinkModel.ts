/**
 * Framework-free decision logic for opening external links.
 *
 * The official client stores `useInAppBrowser` as boolean | undefined:
 * undefined means "ask on the first link", true means the in-app browser,
 * false means the system browser. mailto:/tel: always use the system handler.
 */

export type BrowserChoice = boolean | undefined;

/**
 * Link schemes the in-app browser must never handle; they need a registered
 * system app (mail client, dialler) rather than an HTTP web view.
 */
export function isSystemOnlyUrl(url: string): boolean {
  return /^(mailto:|tel:|sms:)/i.test((url || '').trim());
}

export function needsBrowserConsent(url: string, choice: BrowserChoice): boolean {
  if (!isHttpUrl(url)) return false;
  return choice === undefined;
}

export function shouldUseInAppBrowser(url: string, choice: BrowserChoice): boolean {
  if (choice !== true) return false;
  return isHttpUrl(url);
}

/** Only http(s) links belong in a consent prompt or an in-app browser. */
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test((url || '').trim());
}
