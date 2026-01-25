import { ChangeDetectionStrategy, Component, effect, inject, model, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TaxoStoreNodeTreeFilter } from '../../services/taxo-store-paged-tree.service';

/**
 * Data passed to the filter dialog.
 */
export interface TaxoStoreNodeFilterDialogData {
  filter?: TaxoStoreNodeTreeFilter | null;
}

/**
 * Component for editing a tree store node filter.
 * Can be used standalone or inside a dialog.
 */
@Component({
  selector: 'ts-taxo-store-node-filter',
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
  templateUrl: './taxo-store-node-filter.html',
  styleUrls: ['./taxo-store-node-filter.scss'],
})
export class TaxoStoreNodeFilter implements OnInit {
  private readonly _fb = inject(FormBuilder);
  public readonly dialogRef = inject<MatDialogRef<TaxoStoreNodeFilter>>(MatDialogRef, {
    optional: true,
  });
  public readonly data = inject<TaxoStoreNodeFilterDialogData>(MAT_DIALOG_DATA, { optional: true });

  /**
   * The filter model (for standalone use).
   */
  public readonly filter = model<TaxoStoreNodeTreeFilter | null | undefined>();

  public wrapped = false;

  public label: FormControl<string>;
  public flags: FormControl<string>;
  public form: FormGroup;

  constructor() {
    this.label = this._fb.control<string>('', { nonNullable: true });
    this.flags = this._fb.control<string>('', { nonNullable: true });
    this.form = this._fb.group({
      label: this.label,
      flags: this.flags,
    });

    if (this.dialogRef) {
      this.wrapped = true;
      if (this.data?.filter) {
        this.filter.set(this.data.filter);
      }
    }

    effect(() => {
      this.updateForm(this.filter());
    });
  }

  public ngOnInit(): void {
    this.updateForm(this.filter());
  }

  private updateForm(filter?: TaxoStoreNodeTreeFilter | null): void {
    if (!filter) {
      this.form.reset();
      return;
    }
    this.label.setValue(filter.label ?? '');
    this.flags.setValue(filter.flags ?? '');
    this.form.markAsPristine();
  }

  private getFilter(): TaxoStoreNodeTreeFilter {
    return {
      label: this.label.value?.trim() || undefined,
      flags: this.flags.value?.trim() || undefined,
    };
  }

  public reset(): void {
    this.form.reset();
    this.filter.set(null);
    this.dialogRef?.close(null);
  }

  public apply(): void {
    const filter = this.getFilter();
    this.filter.set(filter);
    this.dialogRef?.close(filter);
  }
}
