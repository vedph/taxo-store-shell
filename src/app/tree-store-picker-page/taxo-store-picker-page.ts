import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCard, MatCardContent, MatCardHeader, MatCardTitle } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { TaxoStoreNode, TaxoStoreService } from '@myrmidon/taxo-store-api';
import { FlagOption, TaxoStorePicker } from '@myrmidon/taxo-store-picker';

@Component({
  selector: 'app-taxo-store-picker-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
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

  public readonly treeIdControl = new FormControl<string>('animals', {
    nonNullable: true,
    validators: Validators.required,
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
    if (this.treeIdControl.valid && this.treeIdControl.value) {
      this.selectedTreeId.set(this.treeIdControl.value);
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
    this.treeIdControl.reset();
  }
}
