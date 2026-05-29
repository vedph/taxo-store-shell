import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import {
  FormControl,
  FormBuilder,
  FormGroup,
  UntypedFormGroup,
  ReactiveFormsModule,
} from '@angular/forms';

import { MatButton } from '@angular/material/button';
import {
  MatCard,
  MatCardActions,
  MatCardContent,
  MatCardHeader,
  MatCardTitle,
} from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

import { DialogService } from '@myrmidon/ngx-mat-tools';
import { NgxToolsValidators } from '@myrmidon/ngx-tools';
import { AuthJwtService } from '@myrmidon/auth-jwt-login';

import { EditedObject } from '@myrmidon/cadmus-core';
import { CloseSaveButtonsComponent, ModelEditorComponentBase } from '@myrmidon/cadmus-ui';

import { TaxoStoreNode } from '@myrmidon/taxo-store-api';
import { TaxoStorePicker } from '@myrmidon/taxo-store-picker';

import {
  StringPair,
  TAXO_STORE_NODES_PART_TYPEID,
  TaxoStoreNodesPart,
} from '../taxo-store-nodes-part';

/**
 * TaxoStoreNodesPart editor component.
 * This is a Cadmus part editor for a set of node IDs picked from a taxonomy store tree.
 * The tree is defined at design time by the part's role ID, when the part is created.
 * Subsequently, the tree ID is got from the part but it is assumed that it is still
 * equal to the role ID.
 */
@Component({
  selector: 'cadmus-taxo-store-nodes-part',
  imports: [
    ReactiveFormsModule,
    MatIcon,
    MatButton,
    MatCard,
    MatCardActions,
    MatCardTitle,
    MatCardHeader,
    MatCardContent,
    MatTooltip,
    CloseSaveButtonsComponent,
    TaxoStorePicker,
    TitleCasePipe,
  ],
  templateUrl: './taxo-store-nodes-part.component.html',
  styleUrl: './taxo-store-nodes-part.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxoStoreNodesPartComponent
  extends ModelEditorComponentBase<TaxoStoreNodesPart>
  implements OnInit
{
  public readonly treeId = signal<string>('');
  public nodeIds: FormControl<StringPair[]>;

  constructor(
    authService: AuthJwtService,
    formBuilder: FormBuilder,
    private _dialogService: DialogService,
  ) {
    super(authService, formBuilder);
    // form
    this.nodeIds = formBuilder.control([], {
      // at least 1 entry
      validators: NgxToolsValidators.strictMinLengthValidator(1),
      nonNullable: true,
    });
  }

  public override ngOnInit(): void {
    super.ngOnInit();
  }

  protected buildForm(formBuilder: FormBuilder): FormGroup | UntypedFormGroup {
    return formBuilder.group({
      entries: this.nodeIds,
    });
  }

  private updateForm(part?: TaxoStoreNodesPart | null): void {
    if (!part) {
      this.form.reset();
      return;
    }
    // the treeId is either the treeId or the roleId, if the former is not set
    this.treeId.set(part.treeId || part.roleId || '');
    this.nodeIds.setValue(part.nodeIds || []);
    this.form.markAsPristine();
  }

  protected override onDataSet(data?: EditedObject<TaxoStoreNodesPart>): void {
    // (there are no thesauri)
    // form
    this.updateForm(data?.value);
  }

  protected getValue(): TaxoStoreNodesPart {
    let part = this.getEditedPart(TAXO_STORE_NODES_PART_TYPEID) as TaxoStoreNodesPart;
    part.treeId = this.treeId();
    part.nodeIds = this.nodeIds.value || [];
    return part;
  }

  public addNodeId(node: TaxoStoreNode | null): void {
    // convert to StringPair
    const nodePair: StringPair = {
      name: node?.label || node?.key || '',
      value: node?.key || '',
    };

    // do not add if null or already present with same name
    if (!nodePair.value || this.nodeIds.value.some((e) => e.name === nodePair.name)) {
      return;
    }

    const entries = [...this.nodeIds.value];
    entries.push(nodePair);
    this.nodeIds.setValue(entries);
    this.nodeIds.markAsDirty();
    this.nodeIds.updateValueAndValidity();
  }

  public deleteNodeId(index: number): void {
    this._dialogService
      .confirm('Confirmation', 'Delete node?')
      .subscribe((yes: boolean | undefined) => {
        if (yes) {
          const entries = [...this.nodeIds.value];
          entries.splice(index, 1);
          this.nodeIds.setValue(entries);
          this.nodeIds.markAsDirty();
          this.nodeIds.updateValueAndValidity();
        }
      });
  }

  public moveNodeIdUp(index: number): void {
    if (index < 1) {
      return;
    }
    const entry = this.nodeIds.value[index];
    const entries = [...this.nodeIds.value];
    entries.splice(index, 1);
    entries.splice(index - 1, 0, entry);
    this.nodeIds.setValue(entries);
    this.nodeIds.markAsDirty();
    this.nodeIds.updateValueAndValidity();
  }

  public moveNodeIdDown(index: number): void {
    if (index + 1 >= this.nodeIds.value.length) {
      return;
    }
    const entry = this.nodeIds.value[index];
    const entries = [...this.nodeIds.value];
    entries.splice(index, 1);
    entries.splice(index + 1, 0, entry);
    this.nodeIds.setValue(entries);
    this.nodeIds.markAsDirty();
    this.nodeIds.updateValueAndValidity();
  }
}
