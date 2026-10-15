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
import { FlagOption, TaxoStorePicker } from '@myrmidon/taxo-store-picker';

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
   * Example flags for demonstration purposes.
   * In a real application, these would come from configuration or API.
   */
  public readonly availableFlags: FlagOption[] = [
    { id: 'o', name: 'obsolete' },
    { id: 'd', name: 'draft' },
    { id: 'v', name: 'verified' },
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
