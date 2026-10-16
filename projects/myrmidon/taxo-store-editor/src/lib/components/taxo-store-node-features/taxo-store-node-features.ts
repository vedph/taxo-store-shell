import { ChangeDetectionStrategy, Component, computed, model, signal } from '@angular/core';
import {
  form,
  FormField,
  maxLengthError,
  PathKind,
  required,
  SchemaPath,
  SchemaPathRules,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TaxoStoreNodeFeature, filterTaxoFeatureValue } from '@myrmidon/taxo-store-api';

/**
 * The editable values of the feature form.
 */
interface FeatureDraft {
  name: string;
  value: string;
  filteredValue: string;
}

function toDraft(feature?: TaxoStoreNodeFeature): FeatureDraft {
  return {
    name: feature?.name ?? '',
    value: feature?.value ?? '',
    filteredValue: feature?.filteredValue ?? '',
  };
}

function toFeature(draft: FeatureDraft): TaxoStoreNodeFeature {
  // as for labels, when not set the filtered value is built from value
  const value = draft.value.trim();
  return {
    name: draft.name.trim(),
    value,
    filteredValue: draft.filteredValue.trim() || filterTaxoFeatureValue(value) || undefined,
  };
}

/**
 * Limit the length of a text. Unlike the maxLength rule, this does not set
 * the native maxlength of the bound input, which would make the browser
 * silently truncate a longer pasted text instead of reporting an error.
 */
function maxChars<TPathKind extends PathKind>(
  path: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  max: number,
): void {
  validate(path, ({ value }) => (value().length > max ? maxLengthError(max) : null));
}

/**
 * Editor for the features of a taxo store node, i.e. its generic name=value
 * attributes. Features are listed in a table, in their order, which can be
 * changed; each feature can be added or edited by typing its name, value and
 * filtered value (which is built from the value when empty). A node can have
 * more features with the same name (e.g. son=Mark and son=Jane), and a
 * feature with an empty value works as a boolean marker (e.g. obsolete).
 */
@Component({
  selector: 'ts-taxo-store-node-features',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './taxo-store-node-features.html',
  styleUrls: ['./taxo-store-node-features.scss'],
})
export class TaxoStoreNodeFeatures {
  /**
   * The features to edit.
   */
  public readonly features = model<TaxoStoreNodeFeature[]>([]);

  /**
   * The index of the feature being edited, -1 for a new feature, or null
   * when no feature is being edited.
   */
  public readonly editedIndex = signal<number | null>(null);

  /**
   * True while a feature is being added or edited.
   */
  public readonly editing = computed(() => this.editedIndex() !== null);

  public readonly editorTitle = computed(() => {
    const index = this.editedIndex();
    return index === null ? 'Feature' : index === -1 ? 'New feature' : 'Edit feature';
  });

  // the feature being edited, loaded when editing starts
  private readonly _draft = signal(toDraft());

  public readonly form = form(this._draft, (p) => {
    required(p.name);
    maxChars(p.name, 50);
    // reserved for the syntax of feature filters
    validate(p.name, ({ value }) => (/[=~]/.test(value()) ? { kind: 'reserved' } : null));
    maxChars(p.value, 500);
    maxChars(p.filteredValue, 500);
  });

  /**
   * Start adding a new feature.
   */
  public addFeature(): void {
    this.form().reset(toDraft());
    this.editedIndex.set(-1);
  }

  /**
   * Start editing the feature at the specified index.
   */
  public editFeature(index: number): void {
    const feature = this.features()[index];
    if (!feature) return;

    this.editedIndex.set(index);
    this.form().reset(toDraft(feature));
  }

  /**
   * Delete the feature at the specified index.
   */
  public deleteFeature(index: number): void {
    this.features.update((features) => features.filter((_, i) => i !== index));
  }

  /**
   * Move the feature at the specified index by the specified offset
   * (-1=up, 1=down), when possible.
   */
  public moveFeature(index: number, offset: number): void {
    const target = index + offset;
    const features = [...this.features()];
    if (target < 0 || target >= features.length || index < 0 || index >= features.length) {
      return;
    }
    [features[index], features[target]] = [features[target], features[index]];
    this.features.set(features);
  }

  /**
   * Stop editing the current feature, discarding its changes.
   */
  public cancelFeature(): void {
    this.editedIndex.set(null);
  }

  /**
   * Save the feature being edited.
   */
  public saveFeature(): void {
    const index = this.editedIndex();
    if (index === null || this.form().invalid()) return;

    const feature = toFeature(this._draft());
    this.features.update((features) =>
      index === -1 ? [...features, feature] : features.map((f, i) => (i === index ? feature : f)),
    );
    this.editedIndex.set(null);
  }
}
