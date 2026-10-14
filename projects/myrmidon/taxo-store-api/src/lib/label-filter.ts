/**
 * The non-letter characters preserved by filterTaxoLabel.
 */
const KEPT_CHARS = new Set([' ', '-', '_', '/', '.', ',', ':', ';']);

/**
 * Filter a label for searching. This is the equivalent of the server-side
 * TaxoTreeImporter.FilterLabel, used to build the filtered labels of nodes
 * and mappings, so that searched text can be compared with them:
 * - remove diacritics from letters.
 * - convert to lowercase.
 * - keep letters, spaces (any whitespace becomes a space), dashes,
 * underscores, slashes, dots, commas, colons, semicolons; any other
 * character (e.g. digits) is dropped.
 * - trim the result.
 * @param label The label to filter.
 * @returns The filtered label, or an empty string if label is empty.
 */
export function filterTaxoLabel(label?: string | null): string {
  if (!label) {
    return '';
  }

  const text = label.normalize('NFD').replace(/[̀-ͯ]/g, '');
  let result = '';
  // iterate by UTF-16 unit like the server does with .NET chars
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) {
      result += ' ';
    } else if (/\p{L}/u.test(c)) {
      result += c.toLowerCase();
    } else if (KEPT_CHARS.has(c)) {
      result += c;
    }
  }
  return result.trim();
}
