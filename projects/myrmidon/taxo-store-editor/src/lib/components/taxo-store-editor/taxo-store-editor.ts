import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Observable, Subscription, firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  BrowserTreeNodeComponent,
  PageChangeRequest,
  PagedTreeStore,
} from '@myrmidon/paged-data-browsers';
import { TaxoStoreService } from '@myrmidon/taxo-store-api';

import {
  PagedTaxoStoreNode,
  TaxoStoreNodeTreeFilter,
  TaxoStorePagedTreeService,
  TaxoStoreTreeNode,
} from '../../services/taxo-store-paged-tree.service';
import { TaxoStoreNodeFilter } from '../taxo-store-node-filter/taxo-store-node-filter';
import {
  TaxoStoreNodeEditorDialog,
  TaxoStoreNodeEditorDialogData,
  TaxoStoreNodeEditorDialogResult,
} from '../taxo-store-node-editor-dialog/taxo-store-node-editor-dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog';

import { PagedTreeNode, TreeNode, TreeNodeFilter } from '@myrmidon/paged-data-browsers';

/**
 * Component for editing a tree store.
 * This editor uses a tree store view, which displays a readonly tree view and
 * adds to each displayed node a set of buttons for editing it. Whenever a node
 * is added, updated or deleted, the tree view gets refreshed. The purpose of the
 * component is letting users pick one or more nodes, while also adding or editing
 * nodes at will.
 * Editing is done via a TaxoStoreService instance, which sends requests to a backend
 * API and then fetches the updated tree back to refresh the readonly tree view.
 * This view already provides a customizable template for each node it displays.
 * This component customizes it by adding buttons for these commands:
 * - pick the node: pick the node and will trigger a nodePick event with the
 *   node picked.
 * - edit the node: edit the current node in a popup dialog. If the user saves
 *   his changes, the component uses the service to update the backend and to fetch
 *   the updated tree back, preserving the affected node in view.
 * - add child node, add sibling node: add a new node either as a child of the
 *   node where the button was pressed, or as a sibling of it (after it). The same node
 *   editor dialog opens, and on save the same update and refresh actions occur.
 * - delete node: delete the node where the button was pressed, after prompting for
 *   confirmation. This is available only when the node has no children.
 */
@Component({
  selector: 'ts-taxo-store-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    BrowserTreeNodeComponent,
    TaxoStoreNodeFilter,
  ],
  providers: [TaxoStorePagedTreeService],
  templateUrl: './taxo-store-editor.html',
  styleUrls: ['./taxo-store-editor.scss'],
})
export class TaxoStoreEditor implements OnInit, OnDestroy {
  private readonly _dialog = inject(MatDialog);
  private readonly _treeStoreService = inject(TaxoStoreService);
  private readonly _pagedTreeService = inject(TaxoStorePagedTreeService);

  private _store?: PagedTreeStore<PagedTaxoStoreNode, TaxoStoreNodeTreeFilter>;
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
  public nodes$?: Observable<Readonly<PagedTaxoStoreNode[]>>;
  public filter$?: Observable<Readonly<TaxoStoreNodeTreeFilter>>;

  public ngOnInit(): void {
    this.initStore();
  }

  public ngOnDestroy(): void {
    this._sub?.unsubscribe();
  }

  private initStore(): void {
    this._pagedTreeService.treeId = this.treeId();

    this._store = new PagedTreeStore<PagedTaxoStoreNode, TaxoStoreNodeTreeFilter>(
      this._pagedTreeService,
      {
        pageSize: this.pageSize(),
        cacheSize: 100,
        hasMockRoot: false,
      },
    );

    this.nodes$ = this._store.nodes$;
    this.filter$ = this._store.filter$;

    this.reset();
  }

  /**
   * Reset the tree view.
   */
  public reset(): void {
    if (!this._store) return;

    this.loading.set(true);
    this._store.reset().finally(() => {
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
   * Handle global filter change.
   */
  public onFilterChange(filter: TaxoStoreNodeTreeFilter | null | undefined): void {
    if (!this._store) return;

    this.loading.set(true);
    this._store.setFilter(filter || {}).finally(() => {
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
   * Edit the specified node.
   */
  public async editNode(node: TaxoStoreTreeNode): Promise<void> {
    const fullNode = await firstValueFrom(this._treeStoreService.getNode(node.id));
    if (!fullNode) return;

    const dialogRef = this._dialog.open(TaxoStoreNodeEditorDialog, {
      data: {
        node: fullNode,
        treeId: this.treeId(),
      } as TaxoStoreNodeEditorDialogData,
    });

    const result: TaxoStoreNodeEditorDialogResult | undefined = await firstValueFrom(
      dialogRef.afterClosed(),
    );
    if (!result) return;

    this.loading.set(true);
    try {
      await firstValueFrom(this._treeStoreService.addNode(result.node));
      // Refresh and ensure the edited node remains visible
      await this.refreshAndNavigateTo(node.id);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Add a child node to the specified parent.
   */
  public async addChildNode(parentNode: TaxoStoreTreeNode): Promise<void> {
    const dialogRef = this._dialog.open(TaxoStoreNodeEditorDialog, {
      data: {
        treeId: this.treeId(),
        parentId: parentNode.id,
      } as TaxoStoreNodeEditorDialogData,
    });

    const result: TaxoStoreNodeEditorDialogResult | undefined = await firstValueFrom(
      dialogRef.afterClosed(),
    );
    if (!result) return;

    this.loading.set(true);
    try {
      const newNodeId = await firstValueFrom(this._treeStoreService.addNode(result.node));
      // Refresh and ensure the new child node is visible (expand parent)
      await this.refreshAndNavigateTo(newNodeId);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Add a sibling node after the specified anchor node.
   */
  public async addSiblingNode(anchorNode: TaxoStoreTreeNode): Promise<void> {
    const dialogRef = this._dialog.open(TaxoStoreNodeEditorDialog, {
      data: {
        treeId: this.treeId(),
        parentId: anchorNode.parentId,
      } as TaxoStoreNodeEditorDialogData,
    });

    const result: TaxoStoreNodeEditorDialogResult | undefined = await firstValueFrom(
      dialogRef.afterClosed(),
    );
    if (!result) return;

    this.loading.set(true);
    try {
      const newNodeId = await firstValueFrom(this._treeStoreService.addNode(result.node));
      // Refresh and ensure the new sibling node is visible
      await this.refreshAndNavigateTo(newNodeId);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Delete the specified node after confirmation.
   */
  public async deleteNode(node: TaxoStoreTreeNode): Promise<void> {
    if (!this._store) return;

    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Node',
        message: `Are you sure you want to delete node "${node.label}"?`,
      } as ConfirmDialogData,
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

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
   * Refresh the tree data and navigate to the specified node.
   * Uses the getNodePath API to efficiently navigate directly to the correct
   * page at each level without needing to search across pages.
   */
  private async refreshAndNavigateTo(nodeId: number): Promise<void> {
    await this.navigateToNode(nodeId);
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
