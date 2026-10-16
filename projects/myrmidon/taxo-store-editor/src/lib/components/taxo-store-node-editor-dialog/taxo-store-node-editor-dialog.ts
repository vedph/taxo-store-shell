import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, readonly, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  TaxoStoreNode,
  TaxoStoreNodeFeature,
  TaxoStoreNodeMapping,
  filterTaxoLabel,
} from '@myrmidon/taxo-store-api';

import { generateTaxoKey, TAXO_STORE_EDITOR_CONFIG } from '../../taxo-store-editor-config';
import { TaxoStoreNodeFeatures } from '../taxo-store-node-features/taxo-store-node-features';
import { TaxoStoreNodeMappings } from '../taxo-store-node-mappings/taxo-store-node-mappings';

/**
 * Data passed to the node editor dialog.
 */
export interface TaxoStoreNodeEditorDialogData {
  /**
   * The node being edited, or undefined for a new node. To edit its
   * mappings and features, the node must have been got with them: when its
   * mappings or features are null or undefined, they are saved only if the
   * user changes them.
   */
  node?: TaxoStoreNode;

  /**
   * The tree ID for new nodes.
   */
  treeId: string;

  /**
   * The parent ID for new child nodes.
   */
  parentId?: number;
}

/**
 * Result returned from the node editor dialog.
 */
export interface TaxoStoreNodeEditorDialogResult {
  /**
   * The edited or new node.
   */
  node: TaxoStoreNode;
}

/**
 * The editable values of the node form.
 */
interface NodeDraft {
  key: string;
  label: string;
  filteredLabel: string;
  note: string;
}

function toDraft(node: TaxoStoreNode | undefined): NodeDraft {
  return {
    key: node?.key ?? '',
    label: node?.label ?? '',
    filteredLabel: node?.filteredLabel ?? '',
    note: node?.note ?? '',
  };
}

/**
 * Dialog component for editing or creating a taxo store node. The dialog
 * has three tabs: general, with the node's own data; features, with the
 * generic name=value attributes of the node; and mappings, with the
 * mappings of the node to external resources.
 * The key of an existing node cannot be changed, as it is used to refer to
 * the node from external data. For a new node, the key can be generated from
 * its label, using the keyGenerator of the TAXO_STORE_EDITOR_CONFIG
 * configuration when provided, else generateTaxoKey.
 */
@Component({
  selector: 'ts-taxo-store-node-editor-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    MatTooltipModule,
    TaxoStoreNodeFeatures,
    TaxoStoreNodeMappings,
  ],
  templateUrl: './taxo-store-node-editor-dialog.html',
  styleUrls: ['./taxo-store-node-editor-dialog.scss'],
})
export class TaxoStoreNodeEditorDialog {
  private readonly _dialogRef = inject(MatDialogRef<TaxoStoreNodeEditorDialog>);
  private readonly _config = inject(TAXO_STORE_EDITOR_CONFIG, { optional: true });
  private readonly _keyGenerator = this._config?.keyGenerator ?? generateTaxoKey;

  public readonly data: TaxoStoreNodeEditorDialogData = inject(MAT_DIALOG_DATA);

  public readonly isNew = !this.data.node;

  // the dialog data never change, so the draft is just loaded from them
  private readonly _draft = signal(toDraft(this.data.node));

  public readonly form = form(this._draft, (p) => {
    required(p.key);
    // the key of an existing node is immutable
    readonly(p.key, () => !this.isNew);
    required(p.label);
  });

  /**
   * True when the key can be generated from the label.
   */
  public readonly canGenerateKey = computed(
    () => this.isNew && this.form.label().value().trim().length > 0,
  );

  private readonly _featuresEditor = viewChild(TaxoStoreNodeFeatures);
  private readonly _mappingsEditor = viewChild(TaxoStoreNodeMappings);
  private _featuresChanged = false;
  private _mappingsChanged = false;

  public readonly selectedTab = signal(0);
  public readonly features = signal<TaxoStoreNodeFeature[]>(this.data.node?.features ?? []);
  public readonly mappings = signal<TaxoStoreNodeMapping[]>(this.data.node?.mappings ?? []);

  /**
   * True while a feature is being added or edited in the features tab.
   * The node can't be saved until that feature is saved or cancelled.
   */
  public readonly featureEditing = computed(() => this._featuresEditor()?.editing() ?? false);

  /**
   * True while a mapping is being added or edited in the mappings tab.
   * The node can't be saved until that mapping is saved or cancelled.
   */
  public readonly mappingEditing = computed(() => this._mappingsEditor()?.editing() ?? false);

  /**
   * True while a feature or a mapping is being edited.
   */
  public readonly childEditing = computed(() => this.featureEditing() || this.mappingEditing());

  /**
   * Generate the key of a new node from its label.
   */
  public generateKey(): void {
    if (!this.canGenerateKey()) return;
    this.form.key().value.set(this._keyGenerator(this._draft().label.trim()));
    this.form.key().markAsDirty();
  }

  public onFeaturesChange(features: TaxoStoreNodeFeature[]): void {
    this.features.set(features);
    this._featuresChanged = true;
  }

  public onMappingsChange(mappings: TaxoStoreNodeMapping[]): void {
    this.mappings.set(mappings);
    this._mappingsChanged = true;
  }

  public cancel(): void {
    this._dialogRef.close();
  }

  public save(): void {
    if (this.form().invalid() || this.childEditing()) {
      return;
    }

    // saving an array of mappings replaces all the mappings of the node,
    // so do not save them when they were not loaded, unless changed;
    // the same holds for features
    const saveMappings =
      this.isNew || this._mappingsChanged || Array.isArray(this.data.node?.mappings);
    const saveFeatures =
      this.isNew || this._featuresChanged || Array.isArray(this.data.node?.features);

    const draft = this._draft();
    const node: TaxoStoreNode = {
      id: this.data.node?.id ?? 0,
      treeId: this.data.treeId,
      parentId: this.data.node?.parentId ?? this.data.parentId,
      // the key of an existing node never changes
      key: this.data.node?.key ?? draft.key.trim(),
      label: draft.label.trim(),
      // when not set, the filtered label is built from label like the server does
      filteredLabel: draft.filteredLabel.trim() || filterTaxoLabel(draft.label),
      note: draft.note.trim() || undefined,
      mappings: saveMappings ? this.mappings() : undefined,
      features: saveFeatures ? this.features() : undefined,
    };

    this._dialogRef.close({ node } as TaxoStoreNodeEditorDialogResult);
  }
}
