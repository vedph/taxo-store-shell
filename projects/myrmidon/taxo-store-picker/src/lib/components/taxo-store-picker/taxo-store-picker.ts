import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
} from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RefLookupComponent } from '@myrmidon/cadmus-refs-lookup';
import {
  TaxoStoreNode,
  TaxoStoreNodeFlagMatchMode,
  TaxoStoreService,
} from '@myrmidon/taxo-store-api';
import { TaxoStoreEditor, TaxoStoreTreeNode } from '@myrmidon/taxo-store-editor';

import {
  TaxoStoreLookupFilter,
  TaxoStoreLookupOptions,
  TaxoStoreLookupService,
} from '../../services/taxo-store-lookup.service';

/**
 * A flag option for the flags filter.
 */
export interface FlagOption {
  /**
   * The flag character (single character).
   */
  id: string;
  /**
   * The display name for the flag.
   */
  name: string;
}

/**
 * Component for picking nodes from a tree store.
 * Combines a RefLookupComponent for quick search with an expandable
 * TreeStoreEditor for browsing and editing nodes.
 */
@Component({
  selector: 'ts-taxo-store-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
    RefLookupComponent,
    TaxoStoreEditor,
  ],
  templateUrl: './taxo-store-picker.html',
  styleUrl: './taxo-store-picker.css',
})
export class TaxoStorePicker {
  private readonly _treeStoreService = inject(TaxoStoreService);
  public readonly lookupService = inject(TaxoStoreLookupService);

  /**
   * The ID of the tree to pick nodes from.
   */
  public readonly treeId = input.required<string | null>();

  /**
   * True if this component should show a top-level nodes filter
   * in a select control, showing a list of top-level nodes to filter by.
   * This is an additional filter for lookup (node's parentKey).
   */
  public readonly hasTopNodeFilter = input<boolean>(true);

  /**
   * True if this component should show a flags filter
   * in a select control, showing a list of node flags to filter by.
   * This is an additional filter for lookup (node's flags).
   */
  public readonly hasFlagsFilter = input<boolean>(true);

  /**
   * The available flags to filter by. For each flag, an object with
   * 'id' and 'name' is expected. This is used only if hasFlagsFilter is true.
   */
  public readonly availableFlags = input<FlagOption[]>([]);

  /**
   * Whether users can edit nodes. Default is true.
   * This is passed to the TreeStoreEditor component.
   */
  public readonly canEdit = input(true);

  /**
   * Whether users can add nodes. Default is true.
   * This is passed to the TreeStoreEditor component.
   */
  public readonly canAdd = input(true);

  /**
   * Whether users can delete nodes. Default is true.
   * This is passed to the TreeStoreEditor component.
   */
  public readonly canDelete = input(true);

  /**
   * Whether to hide the location (x,y) from node display. Default is false.
   * This is passed to the TreeStoreEditor component.
   */
  public readonly hideLoc = input(false);

  /**
   * Whether to hide the per-node filter button. Default is false.
   * This is passed to the TreeStoreEditor component.
   */
  public readonly hideFilter = input(false);

  /**
   * The label for the lookup component.
   */
  public readonly label = input<string>('node');

  /**
   * Emitted when a node is picked.
   */
  public readonly nodePick = output<TaxoStoreNode | null>();

  // Internal state
  /**
   * True if the tree store editor is expanded.
   */
  public readonly expanded = signal<boolean>(false);
  public readonly topNodes = signal<TaxoStoreNode[]>([]);
  public readonly selectedTopNodeKey = signal<string | null>(null);
  public readonly selectedFlagMatchMode = signal<TaxoStoreNodeFlagMatchMode>(
    TaxoStoreNodeFlagMatchMode.Any,
  );
  public readonly selectedFlags = signal<string[]>([]);
  public readonly pickedItem = signal<TaxoStoreNode | null>(null);
  public readonly loading = signal<boolean>(false);

  /**
   * Flag match mode options for the select.
   */
  public readonly flagMatchModes: { value: TaxoStoreNodeFlagMatchMode; label: string }[] = [
    { value: TaxoStoreNodeFlagMatchMode.Any, label: 'any' },
    { value: TaxoStoreNodeFlagMatchMode.All, label: 'all' },
    { value: TaxoStoreNodeFlagMatchMode.None, label: 'none' },
  ];

  /**
   * Whether the flags filter should be shown.
   */
  public readonly showFlagsFilter = computed(() => {
    return this.hasFlagsFilter() && this.availableFlags().length > 0;
  });

  /**
   * The base filter for the lookup component.
   * Only contains the treeId; text and limit are provided by RefLookupComponent.
   */
  public readonly lookupFilter = computed<Partial<TaxoStoreLookupFilter>>(() => {
    return {
      treeId: this.treeId() ?? undefined,
    };
  });

  /**
   * The options for the lookup service, derived from filter selections.
   */
  public readonly lookupOptions = computed<TaxoStoreLookupOptions>(() => {
    const options: TaxoStoreLookupOptions = {};

    const topNodeKey = this.selectedTopNodeKey();
    if (topNodeKey) {
      options.parentKey = topNodeKey;
    }

    const flags = this.selectedFlags();
    if (flags.length > 0) {
      options.flags = flags.join('');
      options.flagMatchMode = this.selectedFlagMatchMode();
    }

    return options;
  });

  constructor() {
    // Load top nodes when tree ID changes
    effect(() => {
      const treeId = this.treeId();
      if (treeId && this.hasTopNodeFilter()) {
        this.loadTopNodes(treeId);
      } else {
        this.topNodes.set([]);
        this.selectedTopNodeKey.set(null);
      }
    });
  }

  /**
   * Load top-level nodes for the current tree.
   */
  private async loadTopNodes(treeId: string): Promise<void> {
    this.loading.set(true);
    try {
      const page = await firstValueFrom(
        this._treeStoreService.getRootNodes(treeId, { pageNumber: 1, pageSize: 0 }),
      );
      this.topNodes.set(page.items);
    } catch (error) {
      console.error('Failed to load top nodes:', error);
      this.topNodes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle item picked from the lookup component.
   */
  public onLookupItemChange(item: TaxoStoreNode | null): void {
    this.pickedItem.set(item);
    this.nodePick.emit(item);
  }

  /**
   * Handle node picked from the tree store editor.
   */
  public onEditorNodePick(node: TaxoStoreTreeNode): void {
    // Convert TaxoStoreTreeNode to TaxoStoreNode
    const taxoStoreNode: TaxoStoreNode = {
      id: node.id,
      parentId: node.parentId,
      treeId: node.treeId,
      key: node.key,
      label: node.label,
      filteredLabel: node.filteredLabel,
      flags: node.flags,
      note: node.note,
      x: node.x,
      y: node.y,
      hasChildren: node.hasChildren,
    };
    this.pickedItem.set(taxoStoreNode);
    this.nodePick.emit(taxoStoreNode);
    // Collapse the editor after picking
    this.expanded.set(false);
  }

  /**
   * Clear all selected flags.
   */
  public clearFlags(): void {
    this.selectedFlags.set([]);
  }

  /**
   * Handle top node selection change.
   */
  public onTopNodeChange(key: string | null): void {
    this.selectedTopNodeKey.set(key);
  }

  /**
   * Handle flag match mode change.
   */
  public onFlagMatchModeChange(mode: TaxoStoreNodeFlagMatchMode): void {
    this.selectedFlagMatchMode.set(mode);
  }

  /**
   * Handle flags selection change.
   */
  public onFlagsChange(flags: string[]): void {
    this.selectedFlags.set(flags);
  }
}
