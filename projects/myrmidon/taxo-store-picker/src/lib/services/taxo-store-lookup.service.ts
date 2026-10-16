import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { RefLookupFilter, RefLookupService } from '@myrmidon/cadmus-refs-lookup';
import {
  TaxoStoreNode,
  TaxoStoreNodeFeatureFilter,
  TaxoStoreNodeFeatureMatchMode,
  TaxoStoreNodeFilter,
  TaxoStoreService,
  filterTaxoLabel,
} from '@myrmidon/taxo-store-api';

/**
 * Filter for looking up tree store nodes.
 * Extends RefLookupFilter with tree-specific properties.
 */
export interface TaxoStoreLookupFilter extends RefLookupFilter {
  /**
   * The ID of the tree to search in. Required for lookup to work.
   */
  treeId?: string;
}

/**
 * Options for tree store lookup.
 */
export interface TaxoStoreLookupOptions {
  /**
   * Any part of the key of the parent node. When specified, only children
   * of the matching parent(s) are searched.
   */
  parentKey?: string;
  /**
   * The exact key of an ancestor node. When specified, only descendants
   * (at any depth) of this node are searched.
   */
  ancestorKey?: string;
  /**
   * The features to filter by. When specified, only nodes with matching
   * features are returned.
   */
  features?: TaxoStoreNodeFeatureFilter[];
  /**
   * The mode used to combine the features criteria. Defaults to 'all'.
   */
  featureMatchMode?: TaxoStoreNodeFeatureMatchMode;
}

/**
 * Service for looking up tree store nodes by their filtered label, or by
 * the filtered label of any of their mappings (e.g. aliases).
 * Implements RefLookupService for use with RefLookupComponent.
 */
@Injectable({
  providedIn: 'root',
})
export class TaxoStoreLookupService implements RefLookupService {
  private readonly _taxoStoreService = inject(TaxoStoreService);

  /**
   * A unique identifier for this lookup service, used to match
   * against lookupProviderOptions. Examples: 'viaf', 'whg', 'biblissima'.
   */
  public readonly id = 'taxostore';

  /**
   * Lookup nodes by their filtered label, or by the filtered label of any of
   * their mappings: a node matches when either of them matches.
   * @param filter The lookup filter containing the search text and tree ID.
   * @param options Optional filtering options (parentKey, ancestorKey,
   * features, featureMatchMode).
   * @returns Observable of matching TaxoStoreNode items.
   */
  public lookup(
    filter: TaxoStoreLookupFilter,
    options?: TaxoStoreLookupOptions,
  ): Observable<TaxoStoreNode[]> {
    // If no tree ID or search text, return empty; the text is filtered by
    // the API client like node and mapping labels, so it is empty also
    // when it has no searchable characters (e.g. just digits)
    if (!filter.treeId || !filterTaxoLabel(filter.text)) {
      return of([]);
    }

    // Build the node filter
    const nodeFilter: TaxoStoreNodeFilter = {
      pageNumber: 1,
      pageSize: filter.limit || 10,
      treeId: filter.treeId,
      filteredLabel: filter.text,
      filteredMappingLabel: filter.text,
    };

    // Add optional filters from options
    if (options?.parentKey) {
      nodeFilter.parentKey = options.parentKey;
    }
    if (options?.ancestorKey) {
      nodeFilter.ancestorKey = options.ancestorKey;
    }
    if (options?.features?.length) {
      nodeFilter.features = options.features;
      nodeFilter.featureMatchMode = options.featureMatchMode ?? TaxoStoreNodeFeatureMatchMode.All;
    }

    return this._taxoStoreService.getNodes(nodeFilter).pipe(map((page) => page.items));
  }

  /**
   * Get the display name for a node item.
   * @param item The TaxoStoreNode item.
   * @returns The node's label, or empty string if item is falsy.
   */
  public getName(item: TaxoStoreNode | undefined | null): string {
    return item?.label ?? '';
  }

  /**
   * Get a single item by its native ID.
   * @param id The item's numeric ID (as string) or string key in the format "treeId.key".
   * As keys can contain dots, the tree ID is everything before the first dot.
   * @returns Observable of the item, or undefined if not found.
   * The returned item must have the same shape as items from lookup().
   */
  public getById(id: string): Observable<any | undefined> {
    // if id is number, use getNode; otherwise, assume it's a key and use getNodeFromKey
    if (/^\d+$/.test(id)) {
      const nodeId = parseInt(id, 10);
      return this._taxoStoreService.getNode(nodeId).pipe(map((node) => node ?? undefined));
    }

    // the string ID is expected to be in the format "treeId.key",
    // where key can include dots (e.g. "animals.animal.bird")
    const i = id.indexOf('.');
    const treeId = i > -1 ? id.substring(0, i) : '';
    const key = i > -1 ? id.substring(i + 1) : '';
    if (!treeId || !key) {
      return of(undefined);
    }
    return this._taxoStoreService
      .getNodeFromKey(treeId, key)
      .pipe(map((node) => node ?? undefined));
  }
}
