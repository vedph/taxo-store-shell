import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TaxoStoreNode, TaxoStoreNodeMapping, filterTaxoLabel } from '@myrmidon/taxo-store-api';

import { TaxoStoreNodeMappings } from '../taxo-store-node-mappings/taxo-store-node-mappings';

/**
 * Data passed to the node editor dialog.
 */
export interface TaxoStoreNodeEditorDialogData {
  /**
   * The node being edited, or undefined for a new node. To edit its
   * mappings, the node must have been got with them: when its mappings
   * are null or undefined, they are saved only if the user changes them.
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
 * Dialog component for editing or creating a taxo store node. The dialog
 * has two tabs: general, with the node's own data, and mappings, with the
 * mappings of the node to external resources.
 */
@Component({
  selector: 'ts-taxo-store-node-editor-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    MatTooltipModule,
    TaxoStoreNodeMappings,
  ],
  templateUrl: './taxo-store-node-editor-dialog.html',
  styleUrls: ['./taxo-store-node-editor-dialog.scss'],
})
export class TaxoStoreNodeEditorDialog implements OnInit {
  private readonly _fb = inject(FormBuilder);
  private readonly _dialogRef = inject(MatDialogRef<TaxoStoreNodeEditorDialog>);

  public readonly data: TaxoStoreNodeEditorDialogData = inject(MAT_DIALOG_DATA);

  public key: FormControl<string>;
  public label: FormControl<string>;
  public filteredLabel: FormControl<string>;
  public flags: FormControl<string>;
  public note: FormControl<string>;
  public form: FormGroup;

  public isNew = false;

  private readonly _mappingsEditor = viewChild(TaxoStoreNodeMappings);
  private _mappingsChanged = false;

  public readonly selectedTab = signal(0);
  public readonly mappings = signal<TaxoStoreNodeMapping[]>([]);

  /**
   * True while a mapping is being added or edited in the mappings tab.
   * The node can't be saved until that mapping is saved or cancelled.
   */
  public readonly mappingEditing = computed(() => this._mappingsEditor()?.editing() ?? false);

  constructor() {
    this.key = this._fb.control<string>('', { nonNullable: true, validators: Validators.required });
    this.label = this._fb.control<string>('', {
      nonNullable: true,
      validators: Validators.required,
    });
    this.filteredLabel = this._fb.control<string>('', { nonNullable: true });
    this.flags = this._fb.control<string>('', { nonNullable: true });
    this.note = this._fb.control<string>('', { nonNullable: true });
    this.form = this._fb.group({
      key: this.key,
      label: this.label,
      filteredLabel: this.filteredLabel,
      flags: this.flags,
      note: this.note,
    });
  }

  public ngOnInit(): void {
    this.isNew = !this.data.node;

    if (this.data.node) {
      this.key.setValue(this.data.node.key);
      this.label.setValue(this.data.node.label);
      this.filteredLabel.setValue(this.data.node.filteredLabel);
      this.flags.setValue(this.data.node.flags ?? '');
      this.note.setValue(this.data.node.note ?? '');
      this.mappings.set(this.data.node.mappings ?? []);
      this.form.markAsPristine();
    }
  }

  public onMappingsChange(mappings: TaxoStoreNodeMapping[]): void {
    this.mappings.set(mappings);
    this._mappingsChanged = true;
  }

  public cancel(): void {
    this._dialogRef.close();
  }

  public save(): void {
    if (this.form.invalid || this.mappingEditing()) {
      return;
    }

    // saving an array of mappings replaces all the mappings of the node,
    // so do not save them when they were not loaded, unless changed
    const saveMappings =
      this.isNew || this._mappingsChanged || Array.isArray(this.data.node?.mappings);

    const node: TaxoStoreNode = {
      id: this.data.node?.id ?? 0,
      treeId: this.data.treeId,
      parentId: this.data.node?.parentId ?? this.data.parentId,
      key: this.key.value.trim(),
      label: this.label.value.trim(),
      // when not set, the filtered label is built from label like the server does
      filteredLabel: this.filteredLabel.value.trim() || filterTaxoLabel(this.label.value),
      flags: this.flags.value.trim() || undefined,
      note: this.note.value.trim() || undefined,
      mappings: saveMappings ? this.mappings() : undefined,
    };

    this._dialogRef.close({ node } as TaxoStoreNodeEditorDialogResult);
  }
}
