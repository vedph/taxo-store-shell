import { inject, Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';

import { DataPage } from '@myrmidon/ngx-tools';
import { PagedListStoreService } from '@myrmidon/paged-data-browsers';
import {
  TaxoStoreService,
  TaxoStoreNode,
  TaxoStoreNodeFeatureMatchMode,
} from '@myrmidon/taxo-store-api';

import {
  hasTaxoFeatureFilter,
  TaxoStoreNodeTreeFilter,
  TaxoStoreTreeNode,
  toTaxoStoreTreeNode,
} from './taxo-store-paged-tree.service';

/**
 * Service that adapts TaxoStoreService to the PagedListStoreService interface.
 * This is used for flat trees, whose nodes are all root nodes, so that they
 * can be browsed as a paged list rather than as a tree.
 */
@Injectable()
export class TaxoStorePagedListService implements PagedListStoreService<
  TaxoStoreNodeTreeFilter,
  TaxoStoreTreeNode
> {
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

  private mapPage(page: DataPage<TaxoStoreNode>): DataPage<TaxoStoreTreeNode> {
    return {
      pageNumber: page.pageNumber,
      pageSize: page.pageSize,
      pageCount: page.pageCount,
      total: page.total,
      // nodes in a flat tree never have children
      items: page.items.map((node) => ({ ...toTaxoStoreTreeNode(node), hasChildren: false })),
    };
  }

  /**
   * Load a page of the nodes of the current tree, ordered by key.
   *
   * @param pageNumber The page number (1-based).
   * @param pageSize The page size.
   * @param filter The filter to apply (label and/or features).
   * @returns Observable of a page of nodes.
   */
  public loadPage(
    pageNumber: number,
    pageSize: number,
    filter: TaxoStoreNodeTreeFilter,
  ): Observable<DataPage<TaxoStoreTreeNode>> {
    if (!this._treeId) {
      return of({
        pageNumber: 1,
        pageSize,
        pageCount: 0,
        total: 0,
        items: [],
      });
    }

    // without filters, just get the root nodes
    const hasFeatures = hasTaxoFeatureFilter(filter);
    if (!filter.label && !hasFeatures) {
      return this._treeStoreService
        .getRootNodes(this._treeId, { pageNumber, pageSize }, false, false, true)
        .pipe(map((page) => this.mapPage(page)));
    }

    return this._treeStoreService
      .getNodes({
        pageNumber,
        pageSize,
        treeId: this._treeId,
        isRoot: true,
        filteredLabel: filter.label || undefined,
        filteredMappingLabel: filter.label || undefined,
        features: hasFeatures ? filter.features : undefined,
        featureMatchMode: hasFeatures
          ? (filter.featureMatchMode ?? TaxoStoreNodeFeatureMatchMode.All)
          : undefined,
        includeFeatures: true,
      })
      .pipe(map((page) => this.mapPage(page)));
  }
}
