import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';

import { EnvService, ErrorService, DataPage, PagingOptions } from '@myrmidon/ngx-tools';

import {
  formatTaxoFeatureFilter,
  TaxoStoreNodeFeatureFilter,
  TaxoStoreNodeFeatureMatchMode,
} from '../feature-filter';
import { filterTaxoFeatureValue, filterTaxoLabel } from '../label-filter';
import { TaxoStoreTree, TaxoStoreNode, TaxoNodePathStep } from '../models';

/**
 * Filter for querying TaxoStore trees.
 */
export interface TaxoStoreTreeFilter {
  pageNumber: number;
  pageSize: number;
  name?: string;
}

/**
 * Options for including additional data in the nodes got from the API.
 */
export interface TaxoStoreNodeIncludeOptions {
  /**
   * If true, include X (sibling position), Y (depth), and HasChildren.
   */
  includePosition?: boolean;
  /**
   * If true, include the mappings of each node.
   */
  includeMappings?: boolean;
  /**
   * If true, include the features of each node.
   */
  includeFeatures?: boolean;
}

/**
 * Filter for querying TaxoStore nodes.
 */
export interface TaxoStoreNodeFilter {
  pageNumber: number;
  pageSize: number;
  treeId?: string;
  parentId?: number;
  /**
   * Any part of the node's key.
   */
  key?: string;
  /**
   * Any part of the node's parent key.
   */
  parentKey?: string;
  /**
   * The exact key of an ancestor node: when set, only descendants (at any
   * depth) of the node(s) with this key are matched. This can be combined
   * with matchDescendants.
   */
  ancestorKey?: string;
  /**
   * Any part of the node's filtered label. When filteredMappingLabel is
   * also set, the two are combined with OR. This is filtered with
   * filterTaxoLabel before being sent, so it can be any text.
   */
  filteredLabel?: string;
  /**
   * Any part of the filtered label of any of the node's mappings. When
   * filteredLabel is also set, a node matches if either its own filtered
   * label or the filtered label of any of its mappings matches. This is
   * used to find nodes also via their aliases stored as mappings.
   * This is filtered with filterTaxoLabel before being sent, so it can be
   * any text.
   */
  filteredMappingLabel?: string;
  /**
   * The features to match. Each criterion is matched by any feature of the
   * node having its name and, when specified, its (exact or partial) value.
   * Values are filtered with filterTaxoFeatureValue before being sent, so
   * they can be any text; when nothing is left after filtering a non-empty
   * value, only the feature name is matched.
   */
  features?: TaxoStoreNodeFeatureFilter[];
  /**
   * The mode used to combine the criteria in features. The server default
   * is all.
   */
  featureMatchMode?: TaxoStoreNodeFeatureMatchMode;
  isLeaf?: boolean;
  /**
   * If true, include X (sibling position), Y (depth), and HasChildren in the response.
   * Default is false for better performance on bulk queries.
   */
  includePosition?: boolean;
  /**
   * When true, restricts results to root nodes (parent_id IS NULL).
   */
  isRoot?: boolean;
  /**
   * When true and filteredLabel, filteredMappingLabel and/or features are
   * set, a node is included if it directly matches these criteria OR if any
   * of its descendants matches all of them by itself. Uses a
   * reverse-recursive SQL CTE on the server side.
   */
  matchDescendants?: boolean;
  /**
   * The exact scope of a mapping of the node: when set, only nodes having
   * at least one mapping with this scope are matched.
   */
  mappingScope?: string;
  /**
   * The exact target of a mapping of the node: when set, only nodes having
   * at least one mapping with this target (and with mappingScope, when set)
   * are matched.
   */
  mappingTarget?: string;
  /**
   * If true, include the mappings of each node in the response.
   * Default is false for better performance.
   */
  includeMappings?: boolean;
  /**
   * If true, include the features of each node in the response.
   * Default is false for better performance.
   */
  includeFeatures?: boolean;
}

/**
 * Build the text sent to the API for the specified feature filter, filtering
 * its value like stored feature values.
 * @param filter The feature filter.
 * @returns The text, or null if the filter has no name.
 */
function buildFeatureParam(filter: TaxoStoreNodeFeatureFilter): string | null {
  const name = filter.name?.trim();
  if (!name) {
    return null;
  }
  if (filter.value === undefined || filter.value === null) {
    return name;
  }
  const value = filterTaxoFeatureValue(filter.value);
  // a value with no searchable characters is not applied, as for labels
  if (!value && filter.value.trim()) {
    return name;
  }
  return formatTaxoFeatureFilter({ name, value, partial: filter.partial });
}

/**
 * Build the query parameters for the specified include options.
 * @param options The options.
 * @returns The parameters.
 */
function buildIncludeParams(options?: TaxoStoreNodeIncludeOptions): Record<string, string> {
  const params: Record<string, string> = {};
  if (options?.includePosition) {
    params['includePosition'] = 'true';
  }
  if (options?.includeMappings) {
    params['includeMappings'] = 'true';
  }
  if (options?.includeFeatures) {
    params['includeFeatures'] = 'true';
  }
  return params;
}

/**
 * Service for interacting with the TaxoStore API.
 */
@Injectable({
  providedIn: 'root',
})
export class TaxoStoreService {
  constructor(
    private _http: HttpClient,
    private _error: ErrorService,
    private _env: EnvService,
  ) {}
  private _urlPrefix = 'taxostore/';

  /**
   * The URL prefix for the TaxoStore API. The default is 'taxostore/'.
   * This is appended to the base API URL from the environment service.
   */
  public get urlPrefix(): string {
    return this._urlPrefix;
  }
  public set urlPrefix(value: string) {
    this._urlPrefix = value;
  }

  private getApiUrl(): string {
    return `${this._env.get('taxoUrl')}${this._urlPrefix || ''}`;
  }

  /**
   * Get a single resource which might not exist. A 404 response is mapped
   * to null (without retrying), while other errors are retried and then
   * handled as usual.
   * @param url The resource URL.
   * @returns Observable of the resource or null if not found.
   */
  private getOptional<T>(url: string, params?: Record<string, string>): Observable<T | null> {
    return this._http.get<T | null>(url, { params }).pipe(
      catchError((error: HttpErrorResponse) =>
        error.status === 404 ? of(null) : throwError(() => error),
      ),
      retry(3),
      catchError(this._error.handleError),
    );
  }

  /**
   * Get a single tree by ID.
   * @param id The tree ID.
   * @returns Observable of the tree or null if not found.
   */
  public getTree(id: string): Observable<TaxoStoreTree | null> {
    return this.getOptional<TaxoStoreTree>(`${this.getApiUrl()}trees/${id}`);
  }

  // #region Trees
  /**
   * Get a page of trees matching the specified filter.
   * @param filter The filter to apply.
   * @returns Observable of a page of trees.
   */
  public getTrees(filter: TaxoStoreTreeFilter): Observable<DataPage<TaxoStoreTree>> {
    const params: any = {
      pageNumber: filter.pageNumber.toString(),
      pageSize: filter.pageSize.toString(),
    };
    if (filter.name) {
      params.name = filter.name;
    }

    return this._http
      .get<DataPage<TaxoStoreTree>>(`${this.getApiUrl()}trees`, { params })
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Add or update a tree.
   * @param tree The tree to add.
   * @returns Observable of the tree ID.
   */
  public addTree(tree: TaxoStoreTree): Observable<string> {
    return this._http
      .post<string>(`${this.getApiUrl()}trees`, tree)
      .pipe(catchError(this._error.handleError));
  }

  /**
   * Delete a tree by ID.
   * @param id The tree ID to delete.
   * @returns Observable of the deleted tree ID.
   */
  public deleteTree(id: string): Observable<string> {
    return this._http
      .delete<string>(`${this.getApiUrl()}trees/${id}`)
      .pipe(catchError(this._error.handleError));
  }
  // #endregion

  // #region Nodes
  /**
   * Get a single node by tree ID and key.
   * @param treeId The tree ID.
   * @param key The node key.
   * @param includeMappings If true, include the node's mappings.
   * @param includeFeatures If true, include the node's features.
   * @returns Observable of the node or null if not found.
   */
  public getNodeFromKey(
    treeId: string,
    key: string,
    includeMappings = false,
    includeFeatures = false,
  ): Observable<TaxoStoreNode | null> {
    return this.getOptional<TaxoStoreNode>(
      `${this.getApiUrl()}nodes/tree/${encodeURIComponent(treeId)}/key/${encodeURIComponent(key)}`,
      buildIncludeParams({ includeMappings, includeFeatures }),
    );
  }

  /**
   * Get a single node by ID.
   * @param id The node ID.
   * @param includeMappings If true, include the node's mappings.
   * @param includeFeatures If true, include the node's features.
   * @returns Observable of the node or null if not found.
   */
  public getNode(
    id: number,
    includeMappings = false,
    includeFeatures = false,
  ): Observable<TaxoStoreNode | null> {
    return this.getOptional<TaxoStoreNode>(
      `${this.getApiUrl()}nodes/${id}`,
      buildIncludeParams({ includeMappings, includeFeatures }),
    );
  }

  /**
   * Get a page of nodes matching the specified filter.
   * @param filter The filter to apply.
   * @returns Observable of a page of nodes.
   */
  public getNodes(filter: TaxoStoreNodeFilter): Observable<DataPage<TaxoStoreNode>> {
    const params: any = {
      pageNumber: filter.pageNumber.toString(),
      pageSize: filter.pageSize.toString(),
    };
    if (filter.treeId !== undefined) {
      params.treeId = filter.treeId;
    }
    if (filter.parentId !== undefined) {
      params.parentId = filter.parentId.toString();
    }
    if (filter.key) {
      params.key = filter.key;
    }
    if (filter.parentKey) {
      params.parentKey = filter.parentKey;
    }
    if (filter.ancestorKey) {
      params.ancestorKey = filter.ancestorKey;
    }
    // labels are filtered like the server does when storing them; when
    // nothing is left after filtering, the label filter is not applied
    const filteredLabel = filterTaxoLabel(filter.filteredLabel);
    if (filteredLabel) {
      params.filteredLabel = filteredLabel;
    }
    const filteredMappingLabel = filterTaxoLabel(filter.filteredMappingLabel);
    if (filteredMappingLabel) {
      params.filteredMappingLabel = filteredMappingLabel;
    }
    // each feature criterion is a repeated parameter
    const features = (filter.features ?? [])
      .map((f) => buildFeatureParam(f))
      .filter((f): f is string => f !== null);
    if (features.length) {
      params.features = features;
      if (filter.featureMatchMode) {
        params.featureMatchMode = filter.featureMatchMode;
      }
    }
    if (filter.isLeaf !== undefined) {
      params.isLeaf = filter.isLeaf.toString();
    }
    if (filter.includePosition) {
      params.includePosition = 'true';
    }
    if (filter.isRoot) {
      params.isRoot = 'true';
    }
    if (filter.matchDescendants) {
      params.matchDescendants = 'true';
    }
    if (filter.mappingScope) {
      params.mappingScope = filter.mappingScope;
    }
    if (filter.mappingTarget) {
      params.mappingTarget = filter.mappingTarget;
    }
    if (filter.includeMappings) {
      params.includeMappings = 'true';
    }
    if (filter.includeFeatures) {
      params.includeFeatures = 'true';
    }

    return this._http
      .get<DataPage<TaxoStoreNode>>(`${this.getApiUrl()}nodes`, { params })
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Get root nodes for a specific tree.
   * @param treeId The tree ID.
   * @param options Paging options.
   * @param includePosition If true, include X (sibling position), Y (depth),
   * and HasChildren in the response. Default is false for better performance.
   * @param includeMappings If true, include the mappings of each node.
   * @param includeFeatures If true, include the features of each node.
   * @returns Observable of a page of root nodes.
   */
  public getRootNodes(
    treeId: string,
    options: PagingOptions,
    includePosition = false,
    includeMappings = false,
    includeFeatures = false,
  ): Observable<DataPage<TaxoStoreNode>> {
    const params: any = {
      pageNumber: options.pageNumber.toString(),
      pageSize: options.pageSize.toString(),
      ...buildIncludeParams({ includePosition, includeMappings, includeFeatures }),
    };

    return this._http
      .get<DataPage<TaxoStoreNode>>(`${this.getApiUrl()}nodes/roots/${treeId}`, { params })
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Add a new node (when its ID is 0) or update an existing one.
   * The API rejects invalid nodes (e.g. with a parent in another tree,
   * creating a cycle, having a parent in a flat tree, with duplicate
   * mappings, or with invalid features) with 400, and duplicate keys with 409.
   * When the node's mappings are an array, they replace all the mappings
   * of that node (an empty array removes them all); when they are null or
   * undefined, the mappings of the node are left untouched. The same holds
   * for the node's features.
   * @param node The node to add or update.
   * @returns Observable of the node ID (the new one when adding).
   */
  public addNode(node: TaxoStoreNode): Observable<number> {
    return this._http
      .post<number>(`${this.getApiUrl()}nodes`, node)
      .pipe(catchError(this._error.handleError));
  }

  /**
   * Add multiple nodes in a batch operation.
   * @param nodes The nodes to add.
   * @returns Observable of an array of new node IDs.
   */
  public addNodes(nodes: TaxoStoreNode[]): Observable<number[]> {
    return this._http
      .post<number[]>(`${this.getApiUrl()}nodes/batch`, nodes)
      .pipe(catchError(this._error.handleError));
  }

  /**
   * Delete a node by ID.
   * @param id The node ID to delete.
   * @returns Observable of the deleted node ID.
   */
  public deleteNode(id: number): Observable<number> {
    return this._http
      .delete<number>(`${this.getApiUrl()}nodes/${id}`)
      .pipe(catchError(this._error.handleError));
  }

  /**
   * Check if a node has children.
   * @param id The node ID.
   * @returns Observable of boolean indicating if the node has children.
   */
  public nodeHasChildren(id: number): Observable<boolean> {
    return this._http
      .get<boolean>(`${this.getApiUrl()}nodes/${id}/haschildren`)
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Get immediate child nodes of a node.
   * @param id The parent node ID.
   * @param includePosition If true, include X (sibling position), Y (depth),
   * and HasChildren in the response. Default is false for better performance.
   * @param includeMappings If true, include the mappings of each node.
   * @param includeFeatures If true, include the features of each node.
   * @returns Observable of an array of child nodes.
   */
  public getChildNodes(
    id: number,
    includePosition = false,
    includeMappings = false,
    includeFeatures = false,
  ): Observable<TaxoStoreNode[]> {
    const params = buildIncludeParams({ includePosition, includeMappings, includeFeatures });
    return this._http
      .get<TaxoStoreNode[]>(`${this.getApiUrl()}nodes/${id}/children`, { params })
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Get all descendant nodes of a node.
   * @param id The ancestor node ID.
   * @param includePosition If true, include X (sibling position), Y (depth),
   * and HasChildren in the response. Default is false for better performance.
   * @param includeMappings If true, include the mappings of each node.
   * @param includeFeatures If true, include the features of each node.
   * @returns Observable of an array of descendant nodes.
   */
  public getDescendantNodes(
    id: number,
    includePosition = false,
    includeMappings = false,
    includeFeatures = false,
  ): Observable<TaxoStoreNode[]> {
    const params = buildIncludeParams({ includePosition, includeMappings, includeFeatures });
    return this._http
      .get<TaxoStoreNode[]>(`${this.getApiUrl()}nodes/${id}/descendants`, { params })
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Get all ancestor nodes of a node.
   * @param id The descendant node ID.
   * @param includePosition If true, include X (sibling position), Y (depth),
   * and HasChildren in the response. Default is false for better performance.
   * @param includeMappings If true, include the mappings of each node.
   * @param includeFeatures If true, include the features of each node.
   * @returns Observable of an array of ancestor nodes.
   */
  public getAncestorNodes(
    id: number,
    includePosition = false,
    includeMappings = false,
    includeFeatures = false,
  ): Observable<TaxoStoreNode[]> {
    const params = buildIncludeParams({ includePosition, includeMappings, includeFeatures });
    return this._http
      .get<TaxoStoreNode[]>(`${this.getApiUrl()}nodes/${id}/ancestors`, { params })
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Get the path from the root node to the specified target node,
   * including the page number for each step.
   * @param id The target node ID.
   * @param pageSize The page size used to calculate page numbers.
   * @returns Observable of an array of path steps from root to target.
   * Each step contains the node ID and the page number where it appears
   * among its siblings (ordered by key). Returns empty array if node not found.
   */
  public getNodePath(id: number, pageSize: number): Observable<TaxoNodePathStep[]> {
    const params: any = {
      pageSize: pageSize.toString(),
    };
    return this._http
      .get<TaxoNodePathStep[]>(`${this.getApiUrl()}nodes/${id}/path`, { params })
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Clear all nodes from the store.
   * @returns Observable that completes when the operation is done.
   */
  public clear(): Observable<void> {
    return this._http
      .delete<void>(`${this.getApiUrl()}nodes`)
      .pipe(catchError(this._error.handleError));
  }
  // #endregion
}
