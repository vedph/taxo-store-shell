import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
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

import { RamStorageService } from '@myrmidon/ngx-tools';
import {
  LOOKUP_CONFIGS_KEY,
  RefLookupConfig,
  RefLookupSetComponent,
  RefLookupSetEvent,
} from '@myrmidon/cadmus-refs-lookup';
import { TaxoStoreNodeMapping, filterTaxoLabel } from '@myrmidon/taxo-store-api';

/**
 * A mapping as displayed in the mappings table.
 */
interface MappingRow extends TaxoStoreNodeMapping {
  /**
   * The target as a web link, when it is one.
   */
  url?: string;
}

/**
 * The editable values of the mapping form.
 */
interface MappingDraft {
  scope: string;
  target: string;
  label: string;
  filteredLabel: string;
}

function toDraft(mapping?: TaxoStoreNodeMapping): MappingDraft {
  return {
    scope: mapping?.scope ?? '',
    target: mapping?.target ?? '',
    label: mapping?.label ?? '',
    filteredLabel: mapping?.filteredLabel ?? '',
  };
}

function toMapping(draft: MappingDraft): TaxoStoreNodeMapping {
  // as for nodes, when not set the filtered label is built from label
  const label = draft.label.trim();
  return {
    scope: draft.scope.trim(),
    target: draft.target.trim(),
    label: label || undefined,
    filteredLabel: draft.filteredLabel.trim() || filterTaxoLabel(label) || undefined,
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
 * Get a text from a value picked from a lookup, which can be anything.
 */
function toText(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

/**
 * Editor for the mappings of a taxo store node to external resources.
 * Mappings are listed in a table; each mapping can be added or edited
 * manually, by typing its scope, target, label and filtered label (which
 * is built from the label when empty), or via lookup, when any
 * lookup providers are configured. Picking an item from a lookup sets the
 * scope to the ID of the lookup provider, the target to the ID of the item,
 * and the label to the name of the item.
 * Lookup providers are got from the lookupConfigs input or, when this is
 * not set, from the configurations stored in RamStorageService under the
 * LOOKUP_CONFIGS_KEY key.
 */
@Component({
  selector: 'ts-taxo-store-node-mappings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    RefLookupSetComponent,
  ],
  templateUrl: './taxo-store-node-mappings.html',
  styleUrls: ['./taxo-store-node-mappings.scss'],
})
export class TaxoStoreNodeMappings {
  private readonly _storage = inject(RamStorageService);

  /**
   * The mappings to edit.
   */
  public readonly mappings = model<TaxoStoreNodeMapping[]>([]);

  /**
   * The configurations of the lookup providers used to pick targets.
   * When not set, these are got from RamStorageService (LOOKUP_CONFIGS_KEY).
   * When there are no configurations, mappings can only be typed manually.
   */
  public readonly lookupConfigs = input<RefLookupConfig[]>();

  /**
   * The index of the mapping being edited, -1 for a new mapping, or null
   * when no mapping is being edited.
   */
  public readonly editedIndex = signal<number | null>(null);

  /**
   * True while a mapping is being added or edited.
   */
  public readonly editing = computed(() => this.editedIndex() !== null);

  public readonly editorTitle = computed(() => {
    const index = this.editedIndex();
    return index === null ? 'Mapping' : index === -1 ? 'New mapping' : 'Edit mapping';
  });

  public readonly rows = computed<MappingRow[]>(() =>
    this.mappings().map((m) => ({
      ...m,
      url: /^https?:\/\//i.test(m.target) ? m.target : undefined,
    })),
  );

  public readonly configs = computed<RefLookupConfig[]>(
    () =>
      this.lookupConfigs() ?? this._storage.retrieve<RefLookupConfig[]>(LOOKUP_CONFIGS_KEY) ?? [],
  );

  // the mapping being edited, loaded when editing starts
  private readonly _draft = signal(toDraft());

  public readonly form = form(this._draft, (p) => {
    required(p.scope);
    maxChars(p.scope, 100);
    required(p.target);
    maxChars(p.target, 500);
    maxChars(p.label, 500);
    maxChars(p.filteredLabel, 500);
    validate(p, ({ value }) => (this.isDuplicate(value()) ? { kind: 'duplicate' } : null));
  });

  /**
   * The pair scope + target must be unique among the mappings of a node.
   */
  private isDuplicate(draft: MappingDraft): boolean {
    const scope = draft.scope.trim();
    const target = draft.target.trim();
    if (!scope || !target) return false;

    const index = this.editedIndex();
    return this.mappings().some((m, i) => i !== index && m.scope === scope && m.target === target);
  }

  /**
   * Start adding a new mapping.
   */
  public addMapping(): void {
    this.form().reset(toDraft());
    this.editedIndex.set(-1);
  }

  /**
   * Start editing the mapping at the specified index.
   */
  public editMapping(index: number): void {
    const mapping = this.mappings()[index];
    if (!mapping) return;

    this.editedIndex.set(index);
    this.form().reset(toDraft(mapping));
  }

  /**
   * Delete the mapping at the specified index.
   */
  public deleteMapping(index: number): void {
    this.mappings.update((mappings) => mappings.filter((_, i) => i !== index));
  }

  /**
   * Stop editing the current mapping, discarding its changes.
   */
  public cancelMapping(): void {
    this.editedIndex.set(null);
  }

  /**
   * Save the mapping being edited.
   */
  public saveMapping(): void {
    const index = this.editedIndex();
    if (index === null || this.form().invalid()) return;

    const mapping = toMapping(this._draft());
    this.mappings.update((mappings) =>
      index === -1 ? [...mappings, mapping] : mappings.map((m, i) => (i === index ? mapping : m)),
    );
    this.editedIndex.set(null);
  }

  /**
   * Fill the mapping being edited from an item picked from a lookup.
   */
  public onLookupItemChange(event: RefLookupSetEvent): void {
    if (event.item === null || event.item === undefined) return;

    const target = toText(event.itemId);
    if (!target) return;

    const service = event.config.service;
    this._draft.set({
      scope: service?.id || event.config.name,
      target,
      label: toText(event.itemLabel) || toText(service?.getName(event.item)),
      // the filtered label of the previous label no longer applies
      filteredLabel: '',
    });
    this.form().markAsDirty();
  }
}
