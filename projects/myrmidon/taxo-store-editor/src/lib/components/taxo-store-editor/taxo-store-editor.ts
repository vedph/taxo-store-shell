import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
} from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { Observable, Subscription, firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DataPage } from '@myrmidon/ngx-tools';
import {
  BrowserTreeNodeComponent,
  CompactPagerComponent,
  PageChangeRequest,
  PagedListStore,
  PagedTreeStore,
} from '@myrmidon/paged-data-browsers';
import { TaxoStoreNode, TaxoStoreService } from '@myrmidon/taxo-store-api';

import {
  PagedTaxoStoreNode,
  TaxoStoreNodeTreeFilter,
  TaxoStorePagedTreeService,
  TaxoStoreTreeNode,
} from '../../services/taxo-store-paged-tree.service';
import { TaxoStorePagedListService } from '../../services/taxo-store-paged-list.service';
import { TaxoStoreNodeFilter } from '../taxo-store-node-filter/taxo-store-node-filter';
import {
  TaxoStoreNodeEditorDialog,
  TaxoStoreNodeEditorDialogData,
  TaxoStoreNodeEditorDialogResult,
} from '../taxo-store-node-editor-dialog/taxo-store-node-editor-dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog';

/**
 * Component for editing a tree store.
 * This editor displays the nodes of a tree, adding to each displayed node a set
 * of buttons for editing it. Whenever a node is added, updated or deleted, the
 * view gets refreshed. The purpose of the component is letting users pick one
 * or more nodes, while also adding or editing nodes at will.
 * The view depends on the tree: a flat tree (whose nodes are all root nodes) is
 * displayed as a paged list, while any other tree is displayed as a paged tree.
 * Editing is done via a TaxoStoreService instance, which sends requests to a backend
 * API and then fetches the updated nodes back to refresh the view.
 * A button at the top adds a new node at the root level; as nodes are sorted by
 * key, the position of the new node among its siblings only depends on its key.
 * Each node has buttons for these commands:
 * - pick the node: pick the node and will trigger a nodePick event with the
 *   node picked.
 * - edit the node: edit the current node (including its mappings) in a popup
 *   dialog. If the user saves his changes, the component uses the service to
 *   update the backend and to fetch the updated nodes back, preserving the
 *   affected node in view.
 * - add child node (not in flat trees): add a new node as a child of the node
 *   where the button was pressed. The same node editor dialog opens, and on save
 *   the same update and refresh actions occur.
 * - delete node: delete the node where the button was pressed, after prompting for
 *   confirmation. This is available only when the node has no children.
 */
@Component({
  selector: 'ts-taxo-store-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    BrowserTreeNodeComponent,
    CompactPagerComponent,
    TaxoStoreNodeFilter,
  ],
  providers: [TaxoStorePagedTreeService, TaxoStorePagedListService],
  templateUrl: './taxo-store-editor.html',
  styleUrls: ['./taxo-store-editor.scss'],
})
export class TaxoStoreEditor implements OnDestroy {
  private readonly _dialog = inject(MatDialog);
  private readonly _treeStoreService = inject(TaxoStoreService);
  private readonly _pagedTreeService = inject(TaxoStorePagedTreeService);
  private readonly _pagedListService = inject(TaxoStorePagedListService);

  // the store used for trees
  private _store?: PagedTreeStore<PagedTaxoStoreNode, TaxoStoreNodeTreeFilter>;
  // the store used for flat trees
  private _listStore?: PagedListStore<TaxoStoreNodeTreeFilter, TaxoStoreTreeNode>;
  private _initId = 0;
  private _sub?: Subscription;

  /**
   * The ID of the tree to display and edit.
   */
  public readonly treeId = input.required<string>();

  /**
   * Whether users can pick nodes. Default is true.
   */
  public readonly canPick = input(true);

  /**
   * Whether users can edit nodes. Default is true.
   */
  public readonly canEdit = input(true);

  /**
   * Whether users can add nodes. Default is true.
   */
  public readonly canAdd = input(true);

  /**
   * Whether users can delete nodes. Default is true.
   */
  public readonly canDelete = input(true);

  /**
   * Whether to hide the location (x,y) from node display. Default is false.
   */
  public readonly hideLoc = input(false);

  /**
   * Whether to hide the per-node filter button. Default is false.
   */
  public readonly hideFilter = input(false);

  /**
   * The page size for loading nodes. Default is 20.
   */
  public readonly pageSize = input(20);

  /**
   * Emitted when a node is picked by the user.
   */
  public readonly nodePick = output<TaxoStoreTreeNode>();

  public readonly loading = signal(false);
  /**
   * True if the tree being edited is flat, so that it is displayed as a list.
   */
  public readonly flat = signal(false);
  /**
   * The ID of the last node added or edited in the list of a flat tree.
   */
  public readonly hiliteId = signal<number | null>(null);
  /**
   * The nodes of the tree (when not flat).
   */
  public nodes$?: Observable<Readonly<PagedTaxoStoreNode[]>>;
  /**
   * The current page of nodes of the list (when flat).
   */
  public page$?: Observable<Readonly<DataPage<TaxoStoreTreeNode>>>;
  public filter$?: Observable<Readonly<TaxoStoreNodeTreeFilter>>;

  constructor() {
    // (re)initialize the store whenever the tree ID or page size change
    effect(() => {
      const treeId = this.treeId();
      const pageSize = this.pageSize();
      untracked(() => this.init(treeId, pageSize));
    });
  }

  public ngOnDestroy(): void {
    this._sub?.unsubscribe();
  }

  private async init(treeId: string, pageSize: number): Promise<void> {
    const initId = ++this._initId;

    // the tree tells whether it is flat
    this.loading.set(true);
    let flat = false;
    try {
      const tree = await firstValueFrom(this._treeStoreService.getTree(treeId));
      flat = tree?.flat === true;
    } catch {
      // the tree view works for any tree
    }
    // ignore stale responses when the inputs changed meanwhile
    if (initId !== this._initId) return;

    this._store = undefined;
    this._listStore = undefined;
    this.nodes$ = undefined;
    this.page$ = undefined;
    this.hiliteId.set(null);

    if (flat) {
      this._pagedListService.treeId = treeId;
      this._listStore = new PagedListStore<TaxoStoreNodeTreeFilter, TaxoStoreTreeNode>(
        this._pagedListService,
        { pageSize, cacheSize: 50 },
      );
      this.page$ = this._listStore.page$;
      this.filter$ = this._listStore.filter$;
    } else {
      this._pagedTreeService.treeId = treeId;
      this._store = new PagedTreeStore<PagedTaxoStoreNode, TaxoStoreNodeTreeFilter>(
        this._pagedTreeService,
        {
          pageSize,
          cacheSize: 100,
          hasMockRoot: false,
        },
      );
      this.nodes$ = this._store.nodes$;
      this.filter$ = this._store.filter$;
    }
    this.flat.set(flat);

    this.reset();
  }

  /**
   * Reset the view.
   */
  public reset(): void {
    const store = this._listStore ?? this._store;
    if (!store) return;

    this.loading.set(true);
    store.reset().finally(() => {
      this.loading.set(false);
    });
  }

  /**
   * Handle node expansion toggle.
   */
  public onToggleExpanded(node: PagedTaxoStoreNode): void {
    if (!this._store) return;

    this.loading.set(true);
    const action = node.expanded ? this._store.collapse(node.id) : this._store.expand(node.id);
    action.finally(() => {
      this.loading.set(false);
    });
  }

  /**
   * Handle page change request for a node's children.
   */
  public onPageChangeRequest(request: PageChangeRequest): void {
    if (!this._store) return;

    this.loading.set(true);
    this._store.changePage(request.node.id, request.paging.pageNumber).finally(() => {
      this.loading.set(false);
    });
  }

  /**
   * Handle page change request for the list of a flat tree.
   */
  public onListPageChange(paging: { pageNumber: number }): void {
    if (!this._listStore) return;

    this.loading.set(true);
    this._listStore.setPage(paging.pageNumber).finally(() => {
      this.loading.set(false);
    });
  }

  /**
   * Handle global filter change.
   */
  public onFilterChange(filter: TaxoStoreNodeTreeFilter | null | undefined): void {
    const store = this._listStore ?? this._store;
    if (!store) return;

    this.loading.set(true);
    store.setFilter(filter || {}).finally(() => {
      this.loading.set(false);
    });
  }

  /**
   * Handle per-node filter edit request.
   */
  public onEditFilterRequest(node: PagedTaxoStoreNode): void {
    const dialogRef = this._dialog.open(TaxoStoreNodeFilter, {
      data: { filter: node.filter },
    });

    dialogRef.afterClosed().subscribe((filter) => {
      if (filter === undefined) return;
      this._store?.setNodeFilter(node.id, filter);
    });
  }

  /**
   * Pick the specified node.
   */
  public pickNode(node: TaxoStoreTreeNode): void {
    this.nodePick.emit(node);
  }

  /**
   * Open the node editor dialog.
   * @returns The dialog result, undefined when the dialog was dismissed.
   */
  private openNodeEditor(
    data: TaxoStoreNodeEditorDialogData,
  ): Promise<TaxoStoreNodeEditorDialogResult | undefined> {
    const dialogRef = this._dialog.open(TaxoStoreNodeEditorDialog, {
      data,
      width: '720px',
      maxWidth: '95vw',
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  /**
   * Save the specified node, then refresh the view ensuring that the node
   * is visible.
   */
  private async saveNode(node: TaxoStoreNode): Promise<void> {
    this.loading.set(true);
    try {
      const nodeId = await firstValueFrom(this._treeStoreService.addNode(node));
      await this.refreshAndNavigateTo(nodeId);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Edit the specified node.
   */
  public async editNode(node: TaxoStoreTreeNode): Promise<void> {
    // nodes in the view have no mappings, so get them with the full node
    const fullNode = await firstValueFrom(this._treeStoreService.getNode(node.id, true));
    if (!fullNode) return;

    const result = await this.openNodeEditor({
      // when mappings are requested they are always an array
      node: { ...fullNode, mappings: fullNode.mappings ?? [] },
      treeId: this.treeId(),
    });
    if (!result) return;

    await this.saveNode(result.node);
  }

  /**
   * Add a new node at the root level. The position of the new node among
   * the other root nodes only depends on its key.
   */
  public async addRootNode(): Promise<void> {
    const result = await this.openNodeEditor({ treeId: this.treeId() });
    if (!result) return;

    await this.saveNode(result.node);
  }

  /**
   * Add a child node to the specified parent. The position of the new node
   * among the other children only depends on its key.
   */
  public async addChildNode(parentNode: TaxoStoreTreeNode): Promise<void> {
    const result = await this.openNodeEditor({
      treeId: this.treeId(),
      parentId: parentNode.id,
    });
    if (!result) return;

    await this.saveNode(result.node);
  }

  /**
   * Delete the specified node after confirmation.
   */
  public async deleteNode(node: TaxoStoreTreeNode): Promise<void> {
    if (!this._store && !this._listStore) return;

    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Node',
        message: `Are you sure you want to delete node "${node.label}"?`,
      } as ConfirmDialogData,
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    if (this._listStore) {
      this.loading.set(true);
      try {
        await firstValueFrom(this._treeStoreService.deleteNode(node.id));
        await this.reloadListPage();
      } finally {
        this.loading.set(false);
      }
      return;
    }
    if (!this._store) return;

    // Get the anchor node BEFORE deleting (next sibling, prev sibling, or parent)
    const anchorId = this._store.getAnchorForDeletedNode(node.id);

    this.loading.set(true);
    try {
      await firstValueFrom(this._treeStoreService.deleteNode(node.id));

      // Navigate to anchor or reset
      if (anchorId !== null) {
        await this.navigateToNode(anchorId);
      } else {
        this._store.clearCache();
        await this._store.reset();
      }
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Refresh the data and navigate to the specified node.
   * Uses the getNodePath API to efficiently navigate directly to the correct
   * page at each level without needing to search across pages.
   */
  private async refreshAndNavigateTo(nodeId: number): Promise<void> {
    if (this._listStore) {
      await this.navigateToListNode(nodeId);
    } else {
      await this.navigateToNode(nodeId);
    }
  }

  /**
   * Reload the current page of the list, moving to the previous page when
   * the current one no longer has any nodes.
   */
  private async reloadListPage(): Promise<void> {
    if (!this._listStore) return;

    const pageNumber = this._listStore.getPage().pageNumber || 1;
    this._listStore.clearCache();
    await this._listStore.setPage(pageNumber);
    if (pageNumber > 1 && this._listStore.isEmpty()) {
      await this._listStore.setPage(pageNumber - 1);
    }
  }

  /**
   * Refresh the list and move to the page including the specified node.
   * When the list is filtered, the page of the node is unknown (and the
   * node might not even match the filter), so the current page is reloaded.
   */
  private async navigateToListNode(nodeId: number): Promise<void> {
    if (!this._listStore) return;

    const filter = this._listStore.getFilter();
    if (filter.label || filter.flags) {
      await this.reloadListPage();
    } else {
      // in a flat tree the path is the node only, with its page among roots
      const path = await firstValueFrom(
        this._treeStoreService.getNodePath(nodeId, this.pageSize()),
      );
      this._listStore.clearCache();
      await this._listStore.setPage(
        path.length ? path[0].pageNumber : this._listStore.getPage().pageNumber || 1,
      );
    }
    this.hiliteId.set(nodeId);
  }

  /**
   * Navigate to a specific node by fetching the path from the API with
   * pre-calculated page numbers, then expanding ancestors and navigating
   * directly to the correct page at each level.
   * This is more efficient than the library's internal search which uses
   * large page sizes to find nodes.
   */
  private async navigateToNode(nodeId: number): Promise<void> {
    if (!this._store) return;

    // Get the path from root to target with pre-calculated page numbers
    const path = await firstValueFrom(this._treeStoreService.getNodePath(nodeId, this.pageSize()));

    // Clear cache and reset to get fresh root nodes
    this._store.clearCache();
    await this._store.reset();

    // If path is empty, node doesn't exist - just show roots
    if (path.length === 0) {
      return;
    }

    // Handle root node pagination if needed
    // Note: Without mock root, we can't easily paginate roots directly.
    // Fall back to ensureNodeVisible for the rare case where root is not on page 1.
    if (path[0].pageNumber > 1) {
      await this._store.ensureNodeVisible(nodeId, undefined, false);
      return;
    }

    // Expand each ancestor and navigate to the correct page for the next node
    for (let i = 0; i < path.length - 1; i++) {
      // Expand this node (loads page 1 of its children)
      await this._store.expand(path[i].nodeId);

      // If the next node (child) is on a different page, navigate to that page
      const nextStep = path[i + 1];
      if (nextStep.pageNumber > 1) {
        await this._store.changePage(path[i].nodeId, nextStep.pageNumber);
      }
    }

    // The target node should now be visible - no need for ensureNodeVisible
  }

  /**
   * Get paging info for node at given index.
   */
  public getPagingForNode(
    nodes: readonly PagedTaxoStoreNode[],
    index: number,
  ): { pageNumber: number; pageCount: number; total: number } | undefined {
    const node = nodes[index];
    if (!node.expanded || index + 1 >= nodes.length) {
      return undefined;
    }
    const nextNode = nodes[index + 1];
    if (nextNode.paging.pageCount > 1) {
      return nextNode.paging;
    }
    return undefined;
  }
}
