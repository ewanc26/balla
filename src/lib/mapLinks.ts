/**
 * The one OpenStreetMap name-search link builder (#156). It is a link-out, not
 * an in-app map: Balla sends no device position and never infers an exact place
 * from a name alone. The label in the UI says the link searches by name.
 */

export function openStreetMapSearchUrl(value: unknown): string | null {
  const name = typeof value === 'string' ? value.trim() : '';
  return name
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(name)}`
    : null;
}
