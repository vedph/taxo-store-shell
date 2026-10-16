import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { TaxoStoreNode, TaxoStoreService } from '@myrmidon/taxo-store-api';
import { FeatureOption, TaxoStorePicker } from '@myrmidon/taxo-store-picker';

const DEFAULT_TREE_ID = 'animals';

@Component({
  selector: 'app-taxo-store-picker-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatCard,
    MatCardHeader,
    MatCardTitle,
    MatCardContent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    TaxoStorePicker,
  ],
  templateUrl: './taxo-store-picker-page.html',
  styleUrl: './taxo-store-picker-page.scss',
})
export class TaxoStorePickerPage implements OnInit {
  private readonly _taxoStoreService = inject(TaxoStoreService);
  private readonly _snackBar = inject(MatSnackBar);

  public readonly treeForm = form(signal({ treeId: DEFAULT_TREE_ID }), (p) => {
    required(p.treeId);
  });

  public readonly availableTrees = signal<{ id: string; name: string }[]>([]);
  public readonly selectedTreeId = signal<string | null>(null);
  public readonly loading = signal(false);
  public readonly pickedNode = signal<TaxoStoreNode | null>(null);

  /**
   * Example feature options for demonstration purposes, matching the
   * features in the mock data of the TaxoStore API.
   * In a real application, these would come from configuration or API.
   */
  public readonly availableFeatures: FeatureOption[] = [
    { id: 'obsolete', name: 'obsolete', filter: { name: 'obsolete' } },
    { id: 'draft', name: 'draft', filter: { name: 'status', value: 'draft' } },
    { id: 'domestic', name: 'domestic', filter: { name: 'domestic' } },
    { id: 'sea', name: 'living in the sea', filter: { name: 'habitat', value: 'sea' } },
    { id: 'red', name: 'red', filter: { name: 'color', value: 'red' } },
    { id: 'green', name: 'green', filter: { name: 'color', value: 'green' } },
    { id: 'yellow', name: 'yellow', filter: { name: 'color', value: 'yellow' } },
    { id: 'stoic', name: 'Stoic school', filter: { name: 'school', value: 'stoic' } },
    {
      id: 'plato',
      name: 'taught by Plato',
      filter: { name: 'teacher', value: 'plato' },
    },
  ];

  public async ngOnInit(): Promise<void> {
    await this.loadTrees();
  }

  private async loadTrees(): Promise<void> {
    this.loading.set(true);
    try {
      const page = await firstValueFrom(
        this._taxoStoreService.getTrees({ pageNumber: 1, pageSize: 100 }),
      );
      this.availableTrees.set(page.items.map((t) => ({ id: t.id, name: t.name })));
    } catch (error) {
      console.error('Failed to load trees:', error);
      this._snackBar.open('Failed to load available trees', 'Dismiss', {
        duration: 3000,
      });
    } finally {
      this.loading.set(false);
    }
  }

  public selectTree(): void {
    const treeId = this.treeForm.treeId().value();
    if (this.treeForm().valid() && treeId) {
      this.selectedTreeId.set(treeId);
      this.pickedNode.set(null);
    }
  }

  public onNodePick(node: TaxoStoreNode | null): void {
    this.pickedNode.set(node);
    if (node) {
      this._snackBar.open(`Picked node: ${node.label} (${node.key})`, 'Dismiss', {
        duration: 3000,
      });
    }
  }

  public clearSelection(): void {
    this.selectedTreeId.set(null);
    this.pickedNode.set(null);
    this.treeForm().reset({ treeId: DEFAULT_TREE_ID });
  }
}
