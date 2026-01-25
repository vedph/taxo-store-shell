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
  TaxoStoreNodeFilter,
  TaxoStoreNodeFlagMatchMode,
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
   * Optional flags filter.
   */
  flags?: string;
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
   * Optional flags attached to this node.
   */
  flags?: string;

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
   * Map a TaxoStoreNode to a TaxoStoreTreeNode (compatible with TreeNode).
   */
  private mapNode(node: TaxoStoreNode): TaxoStoreTreeNode {
    return {
      id: node.id,
      parentId: node.parentId,
      y: node.y ?? 1,
      x: node.x ?? 1,
      label: node.label,
      hasChildren: node.hasChildren,
      treeId: node.treeId,
      key: node.key,
      filteredLabel: node.filteredLabel,
      flags: node.flags,
      note: node.note,
    };
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

    // If parentId is undefined, we need to fetch root nodes
    if (filter.parentId === undefined) {
      return this._treeStoreService.getRootNodes(this._treeId, { pageNumber, pageSize }, true).pipe(
        map((page) => ({
          pageNumber: page.pageNumber,
          pageSize: page.pageSize,
          pageCount: page.pageCount,
          total: page.total,
          items: page.items.map((node) => this.mapNode(node)),
        })),
      );
    }

    // For child nodes, use getNodes with parentId filter
    const apiFilter: TaxoStoreNodeFilter = {
      pageNumber,
      pageSize,
      treeId: this._treeId,
      parentId: filter.parentId,
      flagMatchMode: TaxoStoreNodeFlagMatchMode.Any,
      includePosition: true,
    };

    if (filter.label) {
      apiFilter.filteredLabel = filter.label;
    }

    if (filter.flags) {
      apiFilter.flags = filter.flags;
    }

    return this._treeStoreService.getNodes(apiFilter).pipe(
      map((page) => ({
        pageNumber: page.pageNumber,
        pageSize: page.pageSize,
        pageCount: page.pageCount,
        total: page.total,
        items: page.items.map((node) => this.mapNode(node)),
      })),
    );
  }
}
