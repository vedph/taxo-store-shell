import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TaxoStoreNode } from '@myrmidon/taxo-store-api';

import {
  TaxoStoreNodeEditorDialog,
  TaxoStoreNodeEditorDialogData,
} from './taxo-store-node-editor-dialog';

describe('TaxoStoreNodeEditorDialog', () => {
  let fixture: ComponentFixture<TaxoStoreNodeEditorDialog>;
  let component: TaxoStoreNodeEditorDialog;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const existing: TaxoStoreNode = {
    id: 5,
    parentId: 1,
    treeId: 't',
    key: 'k',
    label: 'Label',
    filteredLabel: 'label',
    flags: 'ab',
    note: 'a note',
  };

  async function setup(data: TaxoStoreNodeEditorDialogData): Promise<HTMLElement> {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [TaxoStoreNodeEditorDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TaxoStoreNodeEditorDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function saveButton(el: HTMLElement): HTMLButtonElement {
    return el.querySelectorAll('mat-dialog-actions button')[1] as HTMLButtonElement;
  }

  it('should start empty and invalid for a new node', async () => {
    const el = await setup({ treeId: 't', parentId: 3 });
    expect(component.isNew).toBe(true);
    expect(el.querySelector('h2')?.textContent).toContain('New Node');
    expect(saveButton(el).textContent?.trim()).toBe('Create');
    expect(component.form.invalid).toBe(true);
    expect(saveButton(el).disabled).toBe(true);
  });

  it('should load an existing node', async () => {
    const el = await setup({ treeId: 't', node: existing });
    expect(component.isNew).toBe(false);
    expect(el.querySelector('h2')?.textContent).toContain('Edit Node');
    expect(saveButton(el).textContent?.trim()).toBe('Save');
    expect(component.key.value).toBe('k');
    expect(component.label.value).toBe('Label');
    expect(component.filteredLabel.value).toBe('label');
    expect(component.flags.value).toBe('ab');
    expect(component.note.value).toBe('a note');
    expect(component.form.pristine).toBe(true);
    expect(component.form.valid).toBe(true);
  });

  it('should load an existing node without flags and note', async () => {
    await setup({ treeId: 't', node: { ...existing, flags: undefined, note: undefined } });
    expect(component.flags.value).toBe('');
    expect(component.note.value).toBe('');
  });

  it('should show required errors when touched', async () => {
    const el = await setup({ treeId: 't' });
    component.key.markAsTouched();
    component.label.markAsTouched();
    fixture.detectChanges();
    const errors = Array.from(el.querySelectorAll('mat-error')).map((e) => e.textContent?.trim());
    expect(errors).toEqual(['Key is required', 'Label is required']);
  });

  it('should close without result on cancel', async () => {
    const el = await setup({ treeId: 't' });
    (el.querySelectorAll('mat-dialog-actions button')[0] as HTMLButtonElement).click();
    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  it('should not save when invalid', async () => {
    await setup({ treeId: 't' });
    component.save();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('should save a new child node with trimmed values and defaults', async () => {
    const el = await setup({ treeId: 't', parentId: 3 });
    component.key.setValue(' new ');
    component.label.setValue(' New Label ');
    component.filteredLabel.setValue('  ');
    component.flags.setValue(' ');
    component.note.setValue('');
    fixture.detectChanges();
    expect(saveButton(el).disabled).toBe(false);
    saveButton(el).click();
    expect(dialogRef.close).toHaveBeenCalledWith({
      node: {
        id: 0,
        treeId: 't',
        parentId: 3,
        key: 'new',
        label: 'New Label',
        filteredLabel: 'New Label',
        flags: undefined,
        note: undefined,
      },
    });
  });

  it('should save an edited node keeping its ID and parent', async () => {
    await setup({ treeId: 't', node: existing, parentId: 99 });
    component.label.setValue('Changed');
    component.flags.setValue(' c ');
    component.note.setValue(' note ');
    component.save();
    expect(dialogRef.close).toHaveBeenCalledWith({
      node: {
        id: 5,
        treeId: 't',
        parentId: 1,
        key: 'k',
        label: 'Changed',
        filteredLabel: 'label',
        flags: 'c',
        note: 'note',
      },
    });
  });

  it('should save a new root node without parent', async () => {
    await setup({ treeId: 't' });
    component.key.setValue('r');
    component.label.setValue('R');
    component.filteredLabel.setValue('r!');
    component.save();
    const node = dialogRef.close.mock.calls[0][0].node as TaxoStoreNode;
    expect(node.parentId).toBeUndefined();
    expect(node.filteredLabel).toBe('r!');
  });
});
