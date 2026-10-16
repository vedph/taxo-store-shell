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
  TaxoStoreNodeFeatureFilter,
  TaxoStoreNodeFeatureMatchMode,
  TaxoStoreService,
} from '@myrmidon/taxo-store-api';
import { TaxoStoreEditor, TaxoStoreTreeNode } from '@myrmidon/taxo-store-editor';

import {
  TaxoStoreLookupFilter,
  TaxoStoreLookupOptions,
  TaxoStoreLookupService,
} from '../../services/taxo-store-lookup.service';

/**
 * A feature option for the features filter, i.e. a predefined feature
 * criterion which users can select to filter nodes by their features.
 */
export interface FeatureOption {
  /**
   * The unique ID of the option.
   */
  id: string;
  /**
   * The display name for the option.
   */
  name: string;
  /**
   * The feature criterion matched by this option, e.g. `{ name: 'obsolete' }`
   * for nodes having an obsolete feature, or `{ name: 'status', value:
   * 'draft' }` for nodes having a status feature equal to draft.
   */
  filter: TaxoStoreNodeFeatureFilter;
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
   * This is an additional filter for lookup, restricting it to the
   * descendants of the selected top-level node (node's ancestorKey).
   */
  public readonly hasTopNodeFilter = input<boolean>(true);

  /**
   * True if this component should show a features filter
   * in a select control, showing a list of feature options to filter by.
   * This is an additional filter for lookup (node's features).
   */
  public readonly hasFeaturesFilter = input<boolean>(true);

  /**
   * The available feature options to filter by. This is used only if
   * hasFeaturesFilter is true.
   */
  public readonly availableFeatures = input<FeatureOption[]>([]);

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
  public readonly selectedFeatureMatchMode = signal<TaxoStoreNodeFeatureMatchMode>(
    TaxoStoreNodeFeatureMatchMode.All,
  );
  /**
   * The IDs of the selected feature options.
   */
  public readonly selectedFeatures = signal<string[]>([]);
  public readonly pickedItem = signal<TaxoStoreNode | null>(null);
  public readonly loading = signal<boolean>(false);

  /**
   * Feature match mode options for the select.
   */
  public readonly featureMatchModes: { value: TaxoStoreNodeFeatureMatchMode; label: string }[] = [
    { value: TaxoStoreNodeFeatureMatchMode.All, label: 'all' },
    { value: TaxoStoreNodeFeatureMatchMode.Any, label: 'any' },
    { value: TaxoStoreNodeFeatureMatchMode.None, label: 'none' },
  ];

  /**
   * Whether the features filter should be shown.
   */
  public readonly showFeaturesFilter = computed(() => {
    return this.hasFeaturesFilter() && this.availableFeatures().length > 0;
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
      options.ancestorKey = topNodeKey;
    }

    const selected = new Set(this.selectedFeatures());
    const features = this.availableFeatures()
      .filter((f) => selected.has(f.id))
      .map((f) => f.filter);
    if (features.length > 0) {
      options.features = features;
      options.featureMatchMode = this.selectedFeatureMatchMode();
    }

    return options;
  });

  constructor() {
    // Load top nodes when tree ID changes
    effect(() => {
      const treeId = this.treeId();
      // any selected top node belongs to the previous tree
      this.selectedTopNodeKey.set(null);
      if (treeId && this.hasTopNodeFilter()) {
        this.loadTopNodes(treeId);
      } else {
        this.topNodes.set([]);
      }
    });
  }

  /**
   * Load top-level nodes for the current tree.
   */
  private async loadTopNodes(treeId: string): Promise<void> {
    this.loading.set(true);
    try {
      // page size 0 = all the root nodes
      const page = await firstValueFrom(
        this._treeStoreService.getRootNodes(treeId, { pageNumber: 1, pageSize: 0 }),
      );
      // ignore stale responses when the tree ID changed meanwhile
      if (treeId !== this.treeId()) {
        return;
      }
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
      features: node.features,
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
   * Clear all selected features.
   */
  public clearFeatures(): void {
    this.selectedFeatures.set([]);
  }

  /**
   * Handle top node selection change.
   */
  public onTopNodeChange(key: string | null): void {
    this.selectedTopNodeKey.set(key);
  }

  /**
   * Handle feature match mode change.
   */
  public onFeatureMatchModeChange(mode: TaxoStoreNodeFeatureMatchMode): void {
    this.selectedFeatureMatchMode.set(mode);
  }

  /**
   * Handle features selection change.
   * @param ids The IDs of the selected feature options.
   */
  public onFeaturesChange(ids: string[]): void {
    this.selectedFeatures.set(ids);
  }
}
