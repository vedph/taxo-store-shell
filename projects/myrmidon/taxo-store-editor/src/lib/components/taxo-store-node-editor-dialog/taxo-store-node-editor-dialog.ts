import { ChangeDetectionStrategy, Component, effect, inject, OnInit } from '@angular/core';
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
import { MatTooltipModule } from '@angular/material/tooltip';

import { TaxoStoreNode } from '@myrmidon/taxo-store-api';

/**
 * Data passed to the node editor dialog.
 */
export interface TaxoStoreNodeEditorDialogData {
  /**
   * The node being edited, or undefined for a new node.
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
 * Dialog component for editing or creating a taxo store node.
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
    MatTooltipModule,
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
      this.form.markAsPristine();
    }
  }

  public cancel(): void {
    this._dialogRef.close();
  }

  public save(): void {
    if (this.form.invalid) {
      return;
    }

    const node: TaxoStoreNode = {
      id: this.data.node?.id ?? 0,
      treeId: this.data.treeId,
      parentId: this.data.node?.parentId ?? this.data.parentId,
      key: this.key.value.trim(),
      label: this.label.value.trim(),
      filteredLabel: this.filteredLabel.value.trim() || this.label.value.trim(),
      flags: this.flags.value.trim() || undefined,
      note: this.note.value.trim() || undefined,
    };

    this._dialogRef.close({ node } as TaxoStoreNodeEditorDialogResult);
  }
}
