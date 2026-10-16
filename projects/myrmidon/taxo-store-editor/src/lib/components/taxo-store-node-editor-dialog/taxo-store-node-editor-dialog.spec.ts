import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import {
  TaxoStoreNode,
  TaxoStoreNodeFeature,
  TaxoStoreNodeMapping,
} from '@myrmidon/taxo-store-api';

import { TAXO_STORE_EDITOR_CONFIG, TaxoStoreEditorConfig } from '../../taxo-store-editor-config';
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
    note: 'a note',
  };
  const mapping: TaxoStoreNodeMapping = { scope: 'viaf', target: '100', label: 'Dante' };
  const feature: TaxoStoreNodeFeature = { name: 'son', value: 'Iacopo', filteredValue: 'iacopo' };

  async function setup(
    data: TaxoStoreNodeEditorDialogData,
    config?: TaxoStoreEditorConfig,
  ): Promise<HTMLElement> {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [TaxoStoreNodeEditorDialog],
      providers: [
        ...(config ? [{ provide: TAXO_STORE_EDITOR_CONFIG, useValue: config }] : []),
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

  function generateButton(el: HTMLElement): HTMLButtonElement | null {
    return el.querySelector('button[aria-label="Generate key from label"]');
  }

  function keyInput(el: HTMLElement): HTMLInputElement {
    return el.querySelector('.node-form input')!;
  }

  it('should label every field with mat-label', async () => {
    const el = await setup({ treeId: 't', node: existing });
    const fields = Array.from(el.querySelectorAll('.node-form mat-form-field'));
    expect(fields.length).toBe(4);
    expect(fields.map((f) => f.querySelector('mat-label')?.textContent?.trim())).toEqual([
      'key',
      'label',
      'filtered label (optional)',
      'note (optional)',
    ]);
    expect(el.querySelectorAll('.node-form [placeholder]').length).toBe(0);
  });

  it('should generate the key of a new node with the default generator', async () => {
    const el = await setup({ treeId: 't' });
    expect(generateButton(el)!.disabled).toBe(true);
    component.form.label().value.set(' Città: Old Town ');
    await fixture.whenStable();
    expect(generateButton(el)!.disabled).toBe(false);
    generateButton(el)!.click();
    await fixture.whenStable();
    expect(component.form.key().value()).toBe('citta._old_town');
    expect(keyInput(el).value).toBe('citta._old_town');
    expect(component.form.key().dirty()).toBe(true);
  });

  it('should not generate a key from a blank label', async () => {
    const el = await setup({ treeId: 't' });
    component.form.label().value.set('   ');
    await fixture.whenStable();
    expect(generateButton(el)!.disabled).toBe(true);
    component.form.key().value.set('k');
    component.generateKey();
    expect(component.form.key().value()).toBe('k');
  });

  it('should generate the key with the configured generator', async () => {
    const keyGenerator = vi.fn((label: string) => `x-${label}`);
    const el = await setup({ treeId: 't' }, { keyGenerator });
    component.form.label().value.set(' Fox ');
    await fixture.whenStable();
    generateButton(el)!.click();
    expect(keyGenerator).toHaveBeenCalledWith('Fox');
    expect(component.form.key().value()).toBe('x-Fox');
  });

  it('should use the default generator when the configuration has none', async () => {
    const el = await setup({ treeId: 't' }, {});
    component.form.label().value.set('Red Fox');
    await fixture.whenStable();
    generateButton(el)!.click();
    expect(component.form.key().value()).toBe('red_fox');
  });

  it('should not allow changing the key of an existing node', async () => {
    const el = await setup({ treeId: 't', node: existing });
    expect(generateButton(el)).toBeNull();
    expect(keyInput(el).readOnly).toBe(true);
    expect(component.form.key().readonly()).toBe(true);
    const keyField = el.querySelector('.node-form mat-form-field')!;
    expect(keyField.classList).toContain('readonly-key');
    expect(keyField.querySelector('mat-icon.key-lock')?.getAttribute('aria-hidden')).toBe('true');
    // projected into the suffix and hint slots, not into the input area
    expect(keyField.querySelector('.mat-mdc-form-field-icon-suffix .key-lock')).toBeTruthy();
    expect(keyField.querySelector('.mat-mdc-form-field-hint-wrapper mat-hint')).toBeTruthy();
    expect(keyField.querySelector('.mat-mdc-form-field-infix mat-hint')).toBeNull();
    expect(el.querySelector('.node-form mat-hint')?.textContent).toContain('cannot be changed');
    // even when changed programmatically, the original key is saved
    component.form.key().value.set('other');
    component.save();
    expect(dialogRef.close.mock.calls[0][0].node.key).toBe('k');
  });

  it('should allow editing the key of a new node', async () => {
    const el = await setup({ treeId: 't' });
    expect(keyInput(el).readOnly).toBe(false);
    const keyField = el.querySelector('.node-form mat-form-field')!;
    expect(keyField.classList).not.toContain('readonly-key');
    expect(keyField.querySelector('.key-lock')).toBeNull();
  });

  it('should start empty and invalid for a new node', async () => {
    const el = await setup({ treeId: 't', parentId: 3 });
    expect(component.isNew).toBe(true);
    expect(el.querySelector('h2')?.textContent).toContain('New Node');
    expect(saveButton(el).textContent?.trim()).toBe('Create');
    expect(component.form().invalid()).toBe(true);
    expect(saveButton(el).disabled).toBe(true);
  });

  it('should load an existing node', async () => {
    const el = await setup({ treeId: 't', node: existing });
    expect(component.isNew).toBe(false);
    expect(el.querySelector('h2')?.textContent).toContain('Edit Node');
    expect(saveButton(el).textContent?.trim()).toBe('Save');
    expect(component.form.key().value()).toBe('k');
    expect(component.form.label().value()).toBe('Label');
    expect(component.form.filteredLabel().value()).toBe('label');
    expect(component.form.note().value()).toBe('a note');
    expect(component.form().dirty()).toBe(false);
    expect(component.form().valid()).toBe(true);
  });

  it('should load an existing node without note', async () => {
    await setup({ treeId: 't', node: { ...existing, note: undefined } });
    expect(component.form.note().value()).toBe('');
  });

  it('should show required errors when touched', async () => {
    const el = await setup({ treeId: 't' });
    // mat-form-field shows errors only for touched controls
    expect(el.querySelectorAll('mat-error').length).toBe(0);
    component.form.key().markAsTouched();
    component.form.label().markAsTouched();
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
    component.form.key().value.set(' new ');
    component.form.label().value.set(' New Label ');
    component.form.filteredLabel().value.set('  ');
    component.form.note().value.set('');
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
        filteredLabel: 'new label',
        note: undefined,
        mappings: [],
        features: [],
      },
    });
  });

  it('should save an edited node keeping its ID and parent', async () => {
    await setup({ treeId: 't', node: existing, parentId: 99 });
    component.form.label().value.set('Changed');
    component.form.note().value.set(' note ');
    component.save();
    expect(dialogRef.close).toHaveBeenCalledWith({
      node: {
        id: 5,
        treeId: 't',
        parentId: 1,
        key: 'k',
        label: 'Changed',
        filteredLabel: 'label',
        note: 'note',
      },
    });
  });

  it('should save a new root node without parent', async () => {
    await setup({ treeId: 't' });
    component.form.key().value.set('r');
    component.form.label().value.set('R');
    component.form.filteredLabel().value.set('r!');
    component.save();
    const node = dialogRef.close.mock.calls[0][0].node as TaxoStoreNode;
    expect(node.parentId).toBeUndefined();
    expect(node.filteredLabel).toBe('r!');
  });

  it('should have general, features and mappings tabs', async () => {
    const el = await setup({
      treeId: 't',
      node: { ...existing, mappings: [mapping], features: [feature, { name: 'obsolete' }] },
    });
    expect(tabLabels(el)).toEqual(['General', 'Features (2)', 'Mappings (1)']);
    expect(el.querySelector('.node-form')).toBeTruthy();
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('ts-taxo-store-node-features')).toBeNull();
    expect(el.querySelector('ts-taxo-store-node-mappings')).toBeNull();

    await selectTab(1);
    const featureRows = el.querySelectorAll('ts-taxo-store-node-features tbody tr');
    expect(featureRows.length).toBe(2);
    expect(featureRows[0].textContent).toContain('Iacopo');

    await selectTab(2);
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
    await selectTab(2);
    // delete the mapping
    el.querySelectorAll<HTMLButtonElement>('ts-taxo-store-node-mappings tbody button')[1].click();
    await fixture.whenStable();
    expect(tabLabels(el)[2]).toBe('Mappings (0)');
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

  it('should save the loaded features of an edited node', async () => {
    await setup({ treeId: 't', node: { ...existing, features: [feature] } });
    expect(component.features()).toEqual([feature]);
    component.save();
    expect(dialogRef.close.mock.calls[0][0].node.features).toEqual([feature]);
  });

  it('should save the changed features', async () => {
    const el = await setup({
      treeId: 't',
      node: { ...existing, features: [feature, { name: 'obsolete', value: '' }] },
    });
    await selectTab(1);
    // delete the first feature
    el.querySelector<HTMLButtonElement>(
      'ts-taxo-store-node-features button[aria-label="Delete feature son"]',
    )!.click();
    await fixture.whenStable();
    expect(tabLabels(el)[1]).toBe('Features (1)');
    component.save();
    expect(dialogRef.close.mock.calls[0][0].node.features).toEqual([
      { name: 'obsolete', value: '' },
    ]);
  });

  it('should not save features which were not loaded', async () => {
    // null as returned by the API when features are not requested
    await setup({ treeId: 't', node: { ...existing, features: null } });
    expect(component.features()).toEqual([]);
    component.save();
    // undefined features leave the features of the node untouched
    expect(dialogRef.close.mock.calls[0][0].node.features).toBeUndefined();
  });

  it('should save features which were not loaded when changed', async () => {
    await setup({ treeId: 't', node: existing });
    component.onFeaturesChange([feature]);
    component.save();
    expect(dialogRef.close.mock.calls[0][0].node.features).toEqual([feature]);
  });

  it('should not save while a feature is being edited', async () => {
    const el = await setup({ treeId: 't', node: existing });
    expect(component.featureEditing()).toBe(false);
    await selectTab(1);
    el.querySelector<HTMLButtonElement>('ts-taxo-store-node-features .toolbar button')!.click();
    await fixture.whenStable();
    expect(component.featureEditing()).toBe(true);
    expect(component.childEditing()).toBe(true);
    expect(saveButton(el).disabled).toBe(true);
    component.save();
    expect(dialogRef.close).not.toHaveBeenCalled();

    // the features tab tells that editing is in progress from the other tab
    await selectTab(0);
    expect(el.querySelector('[role=tab] mat-icon')?.getAttribute('aria-label')).toBe(
      'editing in progress',
    );
  });

  it('should not save while a mapping is being edited', async () => {
    const el = await setup({ treeId: 't', node: existing });
    expect(component.mappingEditing()).toBe(false);
    await selectTab(2);
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
