import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  linkedSignal,
  model,
  untracked,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
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
 * The editable values of the filter form.
 */
interface FilterDraft {
  label: string;
  flags: string;
}

function toDraft(filter: TaxoStoreNodeTreeFilter | null | undefined): FilterDraft {
  return { label: filter?.label ?? '', flags: filter?.flags ?? '' };
}

function toModel(draft: FilterDraft): TaxoStoreNodeTreeFilter {
  return {
    label: draft.label.trim() || undefined,
    flags: draft.flags.trim() || undefined,
  };
}

/**
 * Component for editing a tree store node filter.
 * Can be used standalone or inside a dialog.
 */
@Component({
  selector: 'ts-taxo-store-node-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
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
export class TaxoStoreNodeFilter {
  public readonly dialogRef = inject<MatDialogRef<TaxoStoreNodeFilter>>(MatDialogRef, {
    optional: true,
  });
  public readonly data = inject<TaxoStoreNodeFilterDialogData>(MAT_DIALOG_DATA, { optional: true });

  /**
   * The filter model (for standalone use).
   */
  public readonly filter = model<TaxoStoreNodeTreeFilter | null | undefined>();

  public readonly wrapped = this.dialogRef !== null;

  // the filter is written only by an explicit apply, so any new filter,
  // including the echo of an apply, rebuilds the draft: this shows the
  // applied values as normalized (trimmed)
  private readonly _draft = linkedSignal(() => toDraft(this.filter()));

  public readonly form = form(this._draft);

  constructor() {
    if (this.dialogRef && this.data?.filter) {
      this.filter.set(this.data.filter);
    }

    // whenever the draft is back in sync with the filter, it has no
    // pending changes
    effect(() => {
      const draft = this._draft();
      untracked(() => {
        if (JSON.stringify(draft) === JSON.stringify(toDraft(this.filter()))) {
          this.form().reset();
        }
      });
    });
  }

  public reset(): void {
    // the filter might already be null, which would not rebuild the draft
    this._draft.set(toDraft(null));
    this.filter.set(null);
    this.dialogRef?.close(null);
  }

  public apply(): void {
    const filter = toModel(this._draft());
    this.filter.set(filter);
    this.dialogRef?.close(filter);
  }
}
