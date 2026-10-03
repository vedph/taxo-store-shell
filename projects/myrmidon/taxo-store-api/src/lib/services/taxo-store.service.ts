import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { retry, catchError, map, switchMap } from 'rxjs/operators';

import { EnvService, ErrorService, DataPage, PagingOptions } from '@myrmidon/ngx-tools';

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
 * Specifies the modes used to determine how node flags are matched.
 */
export enum TaxoStoreNodeFlagMatchMode {
  Any = 'any',
  None = 'none',
  All = 'all',
}

/**
 * Filter for querying TaxoStore nodes.
 */
export interface TaxoStoreNodeFilter {
  pageNumber: number;
  pageSize: number;
  treeId?: string;
  parentId?: number;
  key?: string;
  parentKey?: string;
  ancestorKey?: string[];
  filteredLabel?: string;
  flags?: string;
  flagMatchMode: TaxoStoreNodeFlagMatchMode;
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
   * When true and filteredLabel is set, a node is included if it directly
   * matches the label OR if any of its descendants match. Uses a
   * reverse-recursive SQL CTE on the server side.
   */
  matchDescendants?: boolean;
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
  private getOptional<T>(url: string): Observable<T | null> {
    return this._http.get<T | null>(url).pipe(
      catchError((error: HttpErrorResponse) =>
        error.status === 404 ? of(null) : throwError(() => error),
      ),
      retry(3),
      catchError(this._error.handleError),
    );
  }

  /**
   * Extract the ID of a newly created node from the Location header
   * of a 201 response, e.g. `.../nodes/123`.
   * @param response The response.
   * @returns The ID, or null if not available (the header is not exposed
   * to cross-origin clients unless the server allows it).
   */
  private getIdFromLocation(response: HttpResponse<unknown>): number | null {
    const location = response.headers?.get('Location');
    const m = location ? /\/(\d+)\/?$/.exec(location) : null;
    return m ? parseInt(m[1], 10) : null;
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
    // the API returns 201 with an empty body
    return this._http.post<unknown>(`${this.getApiUrl()}trees`, tree).pipe(
      map(() => tree.id),
      catchError(this._error.handleError),
    );
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
   * @returns Observable of the node or null if not found.
   */
  public getNodeFromKey(treeId: string, key: string): Observable<TaxoStoreNode | null> {
    return this.getOptional<TaxoStoreNode>(
      `${this.getApiUrl()}nodes/tree/${encodeURIComponent(treeId)}/key/${encodeURIComponent(key)}`,
    );
  }

  /**
   * Get a single node by ID.
   * @param id The node ID.
   * @returns Observable of the node or null if not found.
   */
  public getNode(id: number): Observable<TaxoStoreNode | null> {
    return this.getOptional<TaxoStoreNode>(`${this.getApiUrl()}nodes/${id}`);
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
      flagMatchMode: filter.flagMatchMode,
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
    if (filter.filteredLabel) {
      params.filteredLabel = filter.filteredLabel;
    }
    if (filter.flags) {
      params.flags = filter.flags;
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
   * @returns Observable of a page of root nodes.
   */
  public getRootNodes(
    treeId: string,
    options: PagingOptions,
    includePosition = false,
  ): Observable<DataPage<TaxoStoreNode>> {
    const params: any = {
      pageNumber: options.pageNumber.toString(),
      pageSize: options.pageSize.toString(),
    };
    if (includePosition) {
      params.includePosition = 'true';
    }

    return this._http
      .get<DataPage<TaxoStoreNode>>(`${this.getApiUrl()}nodes/roots/${treeId}`, { params })
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Add a new node (when its ID is 0) or update an existing one.
   * @param node The node to add or update.
   * @returns Observable of the node ID (the new one when adding).
   */
  public addNode(node: TaxoStoreNode): Observable<number> {
    // the API returns 201 with an empty body and the new node's URL
    // in the Location header, which might not be readable cross-origin;
    // in this case, the new node is got by its tree and key
    return this._http
      .post<unknown>(`${this.getApiUrl()}nodes`, node, { observe: 'response' })
      .pipe(
        catchError(this._error.handleError),
        switchMap((response) => {
          if (node.id > 0) {
            return of(node.id);
          }
          const id = this.getIdFromLocation(response);
          if (id !== null) {
            return of(id);
          }
          return this.getNodeFromKey(node.treeId, node.key).pipe(
            map((saved) => {
              if (!saved) {
                throw new Error(`Added node not found: ${node.treeId}/${node.key}`);
              }
              return saved.id;
            }),
          );
        }),
      );
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
   * @returns Observable of an array of child nodes.
   */
  public getChildNodes(id: number, includePosition = false): Observable<TaxoStoreNode[]> {
    const params: any = {};
    if (includePosition) {
      params.includePosition = 'true';
    }
    return this._http
      .get<TaxoStoreNode[]>(`${this.getApiUrl()}nodes/${id}/children`, { params })
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Get all descendant nodes of a node.
   * @param id The ancestor node ID.
   * @param includePosition If true, include X (sibling position), Y (depth),
   * and HasChildren in the response. Default is false for better performance.
   * @returns Observable of an array of descendant nodes.
   */
  public getDescendantNodes(id: number, includePosition = false): Observable<TaxoStoreNode[]> {
    const params: any = {};
    if (includePosition) {
      params.includePosition = 'true';
    }
    return this._http
      .get<TaxoStoreNode[]>(`${this.getApiUrl()}nodes/${id}/descendants`, { params })
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Get all ancestor nodes of a node.
   * @param id The descendant node ID.
   * @param includePosition If true, include X (sibling position), Y (depth),
   * and HasChildren in the response. Default is false for better performance.
   * @returns Observable of an array of ancestor nodes.
   */
  public getAncestorNodes(id: number, includePosition = false): Observable<TaxoStoreNode[]> {
    const params: any = {};
    if (includePosition) {
      params.includePosition = 'true';
    }
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
