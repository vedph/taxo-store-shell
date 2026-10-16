/**
 * The modes used to combine the criteria of a features filter: all (each
 * criterion must be matched by a feature of the node), any (at least one
 * criterion must be matched), or none (no criterion must be matched).
 */
export enum TaxoStoreNodeFeatureMatchMode {
  All = 'all',
  Any = 'any',
  None = 'none',
}

/**
 * A criterion for matching a feature of a node. The feature name is always
 * matched exactly (case-sensitive), while its value is matched against the
 * filtered value of the feature.
 */
export interface TaxoStoreNodeFeatureFilter {
  /**
   * The exact name of the feature.
   */
  name: string;
  /**
   * The value of the feature to match. When undefined or null, any feature
   * with name is matched, whatever its value; when empty, only features
   * with an empty value are matched. This is filtered like feature values
   * (see filterTaxoFeatureValue) before being sent, so it can be any text.
   */
  value?: string | null;
  /**
   * True to match any part of the feature value (case-insensitive), rather
   * than the whole value. Used only when value is not empty.
   */
  partial?: boolean;
}

/**
 * Format a feature filter as text, in the syntax used by the TaxoStore API:
 * `name` (any value), `name=value` (exact value), or `name~value` (partial
 * value).
 * @param filter The filter.
 * @returns The text.
 */
export function formatTaxoFeatureFilter(filter: TaxoStoreNodeFeatureFilter): string {
  if (filter.value === undefined || filter.value === null) {
    return filter.name;
  }
  return filter.name + (filter.partial && filter.value ? '~' : '=') + filter.value;
}

/**
 * Parse a feature filter from text, in the syntax used by the TaxoStore
 * API: `name` (any value), `name=value` (exact value), or `name~value`
 * (partial value). The first `=` or `~` separates the name from the value.
 * @param text The text to parse.
 * @returns The filter, or null if the text is empty or has no name.
 */
export function parseTaxoFeatureFilter(
  text: string | null | undefined,
): TaxoStoreNodeFeatureFilter | null {
  if (!text?.trim()) {
    return null;
  }

  const i = text.search(/[=~]/);
  if (i === -1) {
    return { name: text.trim() };
  }
  const name = text.substring(0, i).trim();
  if (!name) {
    return null;
  }
  const value = text.substring(i + 1);
  return text[i] === '~' && value ? { name, value, partial: true } : { name, value };
}
