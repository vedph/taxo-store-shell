import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TaxoStoreNode, TaxoStoreNodeMapping } from '@myrmidon/taxo-store-api';

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
  const mapping: TaxoStoreNodeMapping = { scope: 'viaf', target: '100', label: 'Dante' };

  async function setup(data: TaxoStoreNodeEditorDialogData): Promise<HTMLElement> {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [TaxoStoreNodeEditorDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
        // tabs attach their content on a transition event unless not animated
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
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

  function tabLabels(el: HTMLElement): (string | undefined)[] {
    return Array.from(el.querySelectorAll('[role=tab]')).map((t) => t.textContent?.trim());
  }

  async function selectTab(index: number): Promise<void> {
    component.selectedTab.set(index);
    await fixture.whenStable();
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
        mappings: [],
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

  it('should have general and mappings tabs', async () => {
    const el = await setup({ treeId: 't', node: { ...existing, mappings: [mapping] } });
    expect(tabLabels(el)).toEqual(['General', 'Mappings (1)']);
    expect(el.querySelector('form')).toBeTruthy();
    expect(el.querySelector('ts-taxo-store-node-mappings')).toBeNull();

    await selectTab(1);
    const rows = el.querySelectorAll('ts-taxo-store-node-mappings tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Dante');
  });

  it('should save the loaded mappings of an edited node', async () => {
    await setup({ treeId: 't', node: { ...existing, mappings: [mapping] } });
    expect(component.mappings()).toEqual([mapping]);
    component.save();
    expect(dialogRef.close.mock.calls[0][0].node.mappings).toEqual([mapping]);
  });

  it('should save the changed mappings', async () => {
    const el = await setup({ treeId: 't', node: { ...existing, mappings: [mapping] } });
    await selectTab(1);
    // delete the mapping
    el.querySelectorAll<HTMLButtonElement>('ts-taxo-store-node-mappings tbody button')[1].click();
    await fixture.whenStable();
    expect(tabLabels(el)[1]).toBe('Mappings (0)');
    component.save();
    // an empty array removes all the mappings of the node
    expect(dialogRef.close.mock.calls[0][0].node.mappings).toEqual([]);
  });

  it('should not save mappings which were not loaded', async () => {
    // null as returned by the API when mappings are not requested
    await setup({ treeId: 't', node: { ...existing, mappings: null } });
    expect(component.mappings()).toEqual([]);
    component.save();
    // undefined mappings leave the mappings of the node untouched
    expect(dialogRef.close.mock.calls[0][0].node.mappings).toBeUndefined();
  });

  it('should save mappings which were not loaded when changed', async () => {
    await setup({ treeId: 't', node: existing });
    component.onMappingsChange([mapping]);
    component.save();
    expect(dialogRef.close.mock.calls[0][0].node.mappings).toEqual([mapping]);
  });

  it('should not save while a mapping is being edited', async () => {
    const el = await setup({ treeId: 't', node: existing });
    expect(component.mappingEditing()).toBe(false);
    await selectTab(1);
    el.querySelector<HTMLButtonElement>('ts-taxo-store-node-mappings .toolbar button')!.click();
    await fixture.whenStable();
    expect(component.mappingEditing()).toBe(true);
    expect(saveButton(el).disabled).toBe(true);
    component.save();
    expect(dialogRef.close).not.toHaveBeenCalled();

    // the mappings tab tells that editing is in progress from the other tab
    await selectTab(0);
    expect(el.querySelector('[role=tab] mat-icon')?.getAttribute('aria-label')).toBe(
      'editing in progress',
    );
  });

  it('should mark the general tab when invalid from the mappings tab', async () => {
    const el = await setup({ treeId: 't' });
    expect(el.querySelector('[role=tab] .tab-error')).toBeNull();
    await selectTab(1);
    expect(el.querySelector('[role=tab] .tab-error')?.getAttribute('aria-label')).toBe(
      'has errors',
    );
  });
});
