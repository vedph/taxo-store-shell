import { inject, Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';

import { DataPage } from '@myrmidon/ngx-tools';
import {
  PagedTreeNode,
  PagedTreeStoreService,
  TreeNode,
  TreeNodeFilter,
} from '@myrmidon/paged-data-browsers';
import {
  TaxoStoreService,
  TaxoStoreNodeFeature,
  TaxoStoreNodeFeatureFilter,
  TaxoStoreNodeFeatureMatchMode,
  TaxoStoreNodeFilter,
  TaxoStoreNode,
} from '@myrmidon/taxo-store-api';

/**
 * Filter for tree store nodes, extending the base TreeNodeFilter.
 * This is used for both global and per-node filtering of children.
 */
export interface TaxoStoreNodeTreeFilter extends TreeNodeFilter {
  /**
   * Optional label filter (case-insensitive partial match).
   */
  label?: string;

  /**
   * Optional feature criteria.
   */
  features?: TaxoStoreNodeFeatureFilter[];

  /**
   * The mode used to combine the feature criteria (default all).
   */
  featureMatchMode?: TaxoStoreNodeFeatureMatchMode;
}

/**
 * Check whether the specified filter has any feature criteria.
 * @param filter The filter.
 * @returns True if it has feature criteria.
 */
export function hasTaxoFeatureFilter(filter: TaxoStoreNodeTreeFilter): boolean {
  return (filter.features?.length ?? 0) > 0;
}

/**
 * Get a short text summarizing the specified features, e.g. for a tooltip.
 * @param features The features.
 * @returns The summary, or undefined if there are no features.
 */
export function summarizeTaxoFeatures(
  features: TaxoStoreNodeFeature[] | null | undefined,
): string | undefined {
  if (!features?.length) return undefined;
  // markers (features with an empty value) are shown by their name only
  return features.map((f) => (f.value ? `${f.name}=${f.value}` : f.name)).join('; ');
}

/**
 * A taxo-store node adapted for use in the paged tree browser.
 * Extends TreeNode with taxo-store-specific properties.
 */
export interface TaxoStoreTreeNode extends TreeNode {
  /**
   * The tree ID this node belongs to.
   */
  treeId: string;

  /**
   * The unique key for this node within its tree.
   */
  key: string;

  /**
   * The filtered label (for search highlighting).
   */
  filteredLabel: string;

  /**
   * The features of this node, when loaded.
   */
  features?: TaxoStoreNodeFeature[];

  /**
   * A short text summarizing the features of this node, when any.
   */
  featuresSummary?: string;

  /**
   * Optional note attached to this node.
   */
  note?: string;
}

/**
 * A paged tree store node, combining TaxoStoreTreeNode with paging info.
 */
export interface PagedTaxoStoreNode
  extends PagedTreeNode<TaxoStoreNodeTreeFilter>, TaxoStoreTreeNode {}

/**
 * Map a TaxoStoreNode to a TaxoStoreTreeNode (compatible with TreeNode).
 * @param node The node to map.
 * @returns The mapped node.
 */
export function toTaxoStoreTreeNode(node: TaxoStoreNode): TaxoStoreTreeNode {
  return {
    id: node.id,
    // the API returns null for root nodes, while TreeNode expects undefined
    parentId: node.parentId ?? undefined,
    y: node.y ?? 1,
    x: node.x ?? 1,
    label: node.label,
    hasChildren: node.hasChildren,
    treeId: node.treeId,
    key: node.key,
    filteredLabel: node.filteredLabel,
    features: node.features ?? undefined,
    featuresSummary: summarizeTaxoFeatures(node.features),
    note: node.note,
  };
}

/**
 * Apply the features of the specified tree filter to an API filter.
 */
function applyFeatures(source: TaxoStoreNodeTreeFilter, target: TaxoStoreNodeFilter): void {
  if (hasTaxoFeatureFilter(source)) {
    target.features = source.features;
    target.featureMatchMode = source.featureMatchMode ?? TaxoStoreNodeFeatureMatchMode.All;
  }
}

/**
 * Service that adapts TreeStoreService to PagedTreeStoreService interface.
 * This service wraps the TreeStoreService to provide nodes in the format
 * expected by the paged tree browser component.
 */
@Injectable()
export class TaxoStorePagedTreeService implements PagedTreeStoreService<TaxoStoreNodeTreeFilter> {
  private readonly _treeStoreService = inject(TaxoStoreService);
  private _treeId?: string;

  /**
   * Gets or sets the current tree ID.
   */
  get treeId(): string | undefined {
    return this._treeId;
  }

  set treeId(value: string | undefined) {
    this._treeId = value;
  }

  /**
   * Get a page of nodes matching the filter.
   * When filter.parentId is undefined, returns root nodes.
   * When filter.parentId is set, returns children of that parent.
   *
   * @param filter The filter to apply. The parentId property determines
   *   which nodes to fetch: undefined = root nodes, number = children of that node.
   * @param pageNumber The page number (1-based).
   * @param pageSize The page size.
   * @param hasMockRoot Whether the tree has a mock root node (Y=0).
   * @returns Observable of a page of TreeNode items.
   */
  public getNodes(
    filter: TaxoStoreNodeTreeFilter,
    pageNumber: number,
    pageSize: number,
    hasMockRoot?: boolean,
  ): Observable<DataPage<TreeNode>> {
    if (!this._treeId) {
      return of({
        pageNumber: 1,
        pageSize,
        pageCount: 0,
        total: 0,
        items: [],
      });
    }

    const hasFeatures = hasTaxoFeatureFilter(filter);

    // Without a label or features filter, root nodes are got with
    // getRootNodes (simpler, no CTE overhead).
    if (filter.parentId === undefined && !filter.label && !hasFeatures) {
      return this._treeStoreService
        .getRootNodes(this._treeId, { pageNumber, pageSize }, true, false, true)
        .pipe(
          map((page) => ({
            pageNumber: page.pageNumber,
            pageSize: page.pageSize,
            pageCount: page.pageCount,
            total: page.total,
            items: page.items.map((node) => toTaxoStoreTreeNode(node)),
          })),
        );
    }

    // Else, use getNodes for the roots (when parentId is undefined) or for
    // the children of the parent node. When a label and/or features filter
    // is active, matchDescendants ensures that a node is included also when
    // only a deeper descendant matches, so that matching nodes are never
    // hidden by their non-matching ancestors.
    const apiFilter: TaxoStoreNodeFilter = {
      pageNumber,
      pageSize,
      treeId: this._treeId,
      includePosition: true,
      includeFeatures: true,
    };
    if (filter.parentId === undefined) {
      apiFilter.isRoot = true;
    } else {
      apiFilter.parentId = filter.parentId;
    }

    if (filter.label) {
      apiFilter.filteredLabel = filter.label;
      apiFilter.filteredMappingLabel = filter.label;
    }
    applyFeatures(filter, apiFilter);
    if (filter.label || hasFeatures) {
      apiFilter.matchDescendants = true;
    }

    return this._treeStoreService.getNodes(apiFilter).pipe(
      map((page) => ({
        pageNumber: page.pageNumber,
        pageSize: page.pageSize,
        pageCount: page.pageCount,
        total: page.total,
        items: page.items.map((node) => toTaxoStoreTreeNode(node)),
      })),
    );
  }
}
