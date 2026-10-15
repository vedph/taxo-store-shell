import { InjectionToken } from '@angular/core';

/**
 * Configuration for the taxo store editor.
 */
export interface TaxoStoreEditorConfig {
  /**
   * The function used to generate the key of a new node from its label.
   * When not set, generateTaxoKey is used.
   */
  keyGenerator?: (label: string) => string;
}

/**
 * The injection token for the optional taxo store editor configuration.
 */
export const TAXO_STORE_EDITOR_CONFIG = new InjectionToken<TaxoStoreEditorConfig>(
  'TAXO_STORE_EDITOR_CONFIG',
);

/**
 * The default key generator: generate a node key from its label.
 * - trim the label and remove diacritics from its letters (like filterTaxoLabel).
 * - convert to lowercase.
 * - replace each sequence of whitespaces with a single underscore, and each
 * colon with a dot.
 * - keep only letters a-z, digits, underscores, dashes and dots; any other
 * character is dropped.
 * @param label The label.
 * @returns The key, or an empty string if label is empty.
 */
export function generateTaxoKey(label: string): string {
  return label
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/:/g, '.')
    .replace(/[^a-z0-9_.-]/g, '');
}
