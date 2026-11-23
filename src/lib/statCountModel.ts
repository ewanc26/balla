/**
 * The profile stats row keeps every count exact while the three of them fit
 * side by side, and fuzzes (1.2k, 12M) only once the row would overflow the
 * screen. Widths are estimated from the system font's rough metrics
 * (bold digits advance about 0.6em, group separators about 0.26em, the
 * lowercase labels about 0.52em), so the decision is the same on every
 * device and can be checked by the plain-node test suite.
 */

/** Font size of the stats row in ProfileScreen. */
export const STAT_FONT_SIZE = 15;

/**
 * The row sits inside the profile card: an 8pt margin plus 16pt of inner
 * padding on each side of the window.
 */
export const STAT_ROW_INSETS = 48;

/** The 18pt gap between neighbouring stats; two gaps eat into the row. */
export const STAT_ROW_GAP = 18;

export type StatCountRow = {
  posts: string;
  following: string;
  followers: string;
};

type StatKey = keyof StatCountRow;

const STAT_ORDER: StatKey[] = ['posts', 'following', 'followers'];

const BOLD_DIGIT = 0.6;
const SEPARATOR = 0.26;
const LABEL_LETTER = 0.52;
const SPACE = 0.28;

const FUZZ_UNITS = ['k', 'M', 'B'];

function safeCount(value: number): number {
  return Math.max(0, Math.floor(value));
}

/** The count written out in full: 1234 becomes "1,234". */
export function exactStatCount(value: number): string {
  const digits = String(safeCount(value));
  if (digits.length <= 3) {
    return digits;
  }
  const groups: string[] = [];
  const head = digits.length % 3;
  if (head > 0) {
    groups.push(digits.slice(0, head));
  }
  for (let i = head; i < digits.length; i += 3) {
    groups.push(digits.slice(i, i + 3));
  }
  return groups.join(',');
}

/** The count abbreviated once the row runs out of room: 1234 becomes "1.2k". */
export function fuzzedStatCount(value: number): string {
  const safe = safeCount(value);
  if (safe < 1000) {
    return String(safe);
  }
  let power = 1;
  while (power < FUZZ_UNITS.length && safe >= 1000 ** (power + 1)) {
    power += 1;
  }
  let scaled = safe / 1000 ** power;
  if (Math.round(scaled) >= 1000 && power < FUZZ_UNITS.length) {
    // Rounding carries into the next unit: 999,999 reads "1M", not "1000k".
    power += 1;
    scaled /= 1000;
  }
  const digits =
    scaled < 10
      ? scaled.toFixed(1).replace(/\.0$/, '')
      : String(Math.round(scaled));
  return `${digits}${FUZZ_UNITS[power - 1]}`;
}

/** Rough advance width of a count, in em units at the stats row's font size. */
function countEm(text: string): number {
  let em = 0;
  for (const ch of text) {
    em += ch === ',' || ch === '.' ? SEPARATOR : BOLD_DIGIT;
  }
  return em;
}

/** Rough width of one whole stat: its count, the space and its label, in em. */
function statEm(count: string, label: string): number {
  return countEm(count) + SPACE + label.length * LABEL_LETTER;
}

/**
 * The three counts the profile stats row should draw on this window. All
 * three stay exact while the row fits beside the window's two gaps; when it
 * does not, the widest stat fuzzes first, then the next widest, until the
 * row fits again or every count is already fuzzed.
 */
export function statCountsForRow(
  counts: { posts: number; following: number; followers: number },
  windowWidth: number
): StatCountRow {
  const values = {
    posts: safeCount(counts.posts),
    following: safeCount(counts.following),
    followers: safeCount(counts.followers),
  };
  const texts = {
    posts: exactStatCount(values.posts),
    following: exactStatCount(values.following),
    followers: exactStatCount(values.followers),
  };
  const fuzzed = { posts: false, following: false, followers: false };
  const budget = windowWidth - STAT_ROW_INSETS - 2 * STAT_ROW_GAP;
  const rowWidth = () =>
    STAT_ORDER.reduce((sum, key) => sum + statEm(texts[key], key), 0) *
    STAT_FONT_SIZE;
  while (rowWidth() > budget && STAT_ORDER.some((key) => !fuzzed[key])) {
    const remaining = STAT_ORDER.filter((key) => !fuzzed[key]);
    const widest = remaining.reduce((a, b) =>
      statEm(texts[b], b) > statEm(texts[a], a) ? b : a
    );
    texts[widest] = fuzzedStatCount(values[widest]);
    fuzzed[widest] = true;
  }
  return texts;
}
