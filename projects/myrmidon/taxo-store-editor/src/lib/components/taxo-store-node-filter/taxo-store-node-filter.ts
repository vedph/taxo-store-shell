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
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  formatTaxoFeatureFilter,
  parseTaxoFeatureFilter,
  TaxoStoreNodeFeatureFilter,
  TaxoStoreNodeFeatureMatchMode,
} from '@myrmidon/taxo-store-api';

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
  /**
   * The feature criteria, each in the API syntax (name, name=value or
   * name~value).
   */
  features: string[];
  featureMatchMode: TaxoStoreNodeFeatureMatchMode;
}

function toDraft(filter: TaxoStoreNodeTreeFilter | null | undefined): FilterDraft {
  return {
    label: filter?.label ?? '',
    features: (filter?.features ?? []).map((f) => formatTaxoFeatureFilter(f)),
    featureMatchMode: filter?.featureMatchMode ?? TaxoStoreNodeFeatureMatchMode.All,
  };
}

function toModel(draft: FilterDraft): TaxoStoreNodeTreeFilter {
  const features = draft.features
    .map((f) => parseTaxoFeatureFilter(f))
    .filter((f): f is TaxoStoreNodeFeatureFilter => f !== null);
  return {
    label: draft.label.trim() || undefined,
    features: features.length ? features : undefined,
    featureMatchMode: features.length ? draft.featureMatchMode : undefined,
  };
}

/**
 * Component for editing a tree store node filter, by label and/or features.
 * Feature criteria are entered as chips, each with syntax `name` (the node
 * has a feature with that name), `name=value` (with that value) or
 * `name~value` (with a value including that text), and combined according
 * to the selected match mode.
 * Can be used standalone or inside a dialog.
 */
@Component({
  selector: 'ts-taxo-store-node-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
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

  /**
   * Feature match mode options.
   */
  public readonly featureMatchModes: { value: TaxoStoreNodeFeatureMatchMode; label: string }[] = [
    { value: TaxoStoreNodeFeatureMatchMode.All, label: 'all' },
    { value: TaxoStoreNodeFeatureMatchMode.Any, label: 'any' },
    { value: TaxoStoreNodeFeatureMatchMode.None, label: 'none' },
  ];

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

  /**
   * Add the feature criterion typed in the features input, when valid.
   * When the input is empty, apply the filter, as Enter does in the other
   * fields.
   */
  public addFeature(event: MatChipInputEvent): void {
    const text = event.value.trim();
    if (!text) {
      this.apply();
      return;
    }
    const feature = parseTaxoFeatureFilter(text);
    if (!feature) return;

    const formatted = formatTaxoFeatureFilter(feature);
    if (!this._draft().features.includes(formatted)) {
      this.form.features().value.update((features) => [...features, formatted]);
      this.form.features().markAsDirty();
    }
    event.chipInput.clear();
  }

  /**
   * Remove the feature criterion at the specified index.
   */
  public removeFeature(index: number): void {
    this.form.features().value.update((features) => features.filter((_, i) => i !== index));
    this.form.features().markAsDirty();
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
