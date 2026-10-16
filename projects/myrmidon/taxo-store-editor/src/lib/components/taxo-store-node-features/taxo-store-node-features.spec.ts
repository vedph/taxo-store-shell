import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaxoStoreNodeFeature } from '@myrmidon/taxo-store-api';

import { TaxoStoreNodeFeatures } from './taxo-store-node-features';

describe('TaxoStoreNodeFeatures', () => {
  let fixture: ComponentFixture<TaxoStoreNodeFeatures>;
  let component: TaxoStoreNodeFeatures;
  let changes: TaxoStoreNodeFeature[][];

  const mark: TaxoStoreNodeFeature = { name: 'son', value: 'Mark', filteredValue: 'mark' };
  const jane: TaxoStoreNodeFeature = { name: 'son', value: 'Jane', filteredValue: 'jane' };
  const obsolete: TaxoStoreNodeFeature = { name: 'obsolete', value: '' };

  async function setup(features?: TaxoStoreNodeFeature[]): Promise<HTMLElement> {
    fixture = TestBed.createComponent(TaxoStoreNodeFeatures);
    component = fixture.componentInstance;
    if (features) {
      fixture.componentRef.setInput('features', features);
    }
    changes = [];
    component.features.subscribe((f) => changes.push(f));
    await fixture.whenStable();
    return el();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rows(): HTMLTableRowElement[] {
    return Array.from(el().querySelectorAll('tbody tr'));
  }

  function cells(row: HTMLTableRowElement): (string | undefined)[] {
    return Array.from(row.querySelectorAll('td'))
      .slice(1)
      .map((td) => td.textContent?.trim());
  }

  function button(label: string): HTMLButtonElement {
    return el().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TaxoStoreNodeFeatures] }).compileComponents();
  });

  it('should show a message when there are no features', async () => {
    await setup();
    expect(el().querySelector('table')).toBeNull();
    expect(el().querySelector('.empty-message')?.textContent).toContain('No features');
    expect(component.editing()).toBe(false);
    expect(component.editorTitle()).toBe('Feature');
  });

  it('should list features in their order, also with the same name', async () => {
    await setup([mark, obsolete, jane]);
    expect(rows().map((r) => cells(r))).toEqual([
      ['son', 'Mark'],
      ['obsolete', ''],
      ['son', 'Jane'],
    ]);
    expect(Array.from(el().querySelectorAll('th')).map((th) => th.textContent?.trim())).toEqual([
      'actions',
      'name',
      'value',
    ]);
  });

  it('should add a feature building its filtered value', async () => {
    await setup([mark]);
    el().querySelector<HTMLButtonElement>('.toolbar button')!.click();
    await fixture.whenStable();
    expect(component.editedIndex()).toBe(-1);
    expect(component.editorTitle()).toBe('New feature');
    expect(el().querySelector('.feature-form')).toBeTruthy();
    // the save button is disabled while the name is missing
    expect(el().querySelector<HTMLButtonElement>('.save-btn')!.disabled).toBe(true);

    component.form.name().value.set(' born ');
    component.form.value().value.set(' 384 BC, Stagìra ');
    await fixture.whenStable();
    el().querySelector<HTMLButtonElement>('.save-btn')!.click();
    await fixture.whenStable();

    expect(component.editing()).toBe(false);
    expect(changes).toEqual([
      [mark, { name: 'born', value: '384 BC, Stagìra', filteredValue: '384 bc, stagira' }],
    ]);
  });

  it('should add a marker feature with an empty value', async () => {
    await setup();
    component.addFeature();
    component.form.name().value.set('obsolete');
    component.saveFeature();
    expect(component.features()).toEqual([
      { name: 'obsolete', value: '', filteredValue: undefined },
    ]);
  });

  it('should keep an explicit filtered value', async () => {
    await setup();
    component.addFeature();
    component.form.name().value.set('son');
    component.form.value().value.set('Mark');
    component.form.filteredValue().value.set(' marco ');
    component.saveFeature();
    expect(component.features()[0].filteredValue).toBe('marco');
  });

  it('should validate the name', async () => {
    await setup();
    component.addFeature();
    await fixture.whenStable();
    expect(component.form.name().getError('required')).toBeTruthy();

    component.form.name().value.set('a=b');
    expect(component.form.name().getError('reserved')).toBeTruthy();
    component.form.name().value.set('a~b');
    expect(component.form.name().getError('reserved')).toBeTruthy();
    component.form.name().value.set('x'.repeat(51));
    expect(component.form.name().getError('maxLength')).toBeTruthy();
    component.form.value().value.set('x'.repeat(501));
    expect(component.form.value().getError('maxLength')).toBeTruthy();

    // invalid features are not saved
    component.saveFeature();
    expect(component.editing()).toBe(true);
    expect(component.features()).toEqual([]);

    // the reserved characters error is shown
    component.form.name().value.set('a=b');
    component.form.name().markAsTouched();
    fixture.detectChanges();
    expect(
      Array.from(el().querySelectorAll('mat-error')).map((e) => e.textContent?.trim()),
    ).toContain('Name cannot include = or ~');
  });

  it('should edit a feature', async () => {
    await setup([mark, jane]);
    button('Edit feature son').click();
    await fixture.whenStable();
    expect(component.editedIndex()).toBe(0);
    expect(component.editorTitle()).toBe('Edit feature');
    expect(component.form.value().value()).toBe('Mark');
    expect(rows()[0].classList).toContain('edited');
    // other actions are disabled while editing
    expect(el().querySelector<HTMLButtonElement>('.toolbar button')!.disabled).toBe(true);

    component.form.value().value.set('Marco');
    component.form.filteredValue().value.set('');
    component.saveFeature();
    expect(component.features()).toEqual([
      { name: 'son', value: 'Marco', filteredValue: 'marco' },
      jane,
    ]);
  });

  it('should cancel editing a feature', async () => {
    await setup([mark]);
    component.editFeature(0);
    component.form.value().value.set('changed');
    await fixture.whenStable();
    el().querySelector<HTMLButtonElement>('.cancel-btn')!.click();
    await fixture.whenStable();
    expect(component.editing()).toBe(false);
    expect(component.features()).toEqual([mark]);
    expect(changes).toEqual([]);
  });

  it('should ignore editing a missing feature', async () => {
    await setup([mark]);
    component.editFeature(3);
    expect(component.editing()).toBe(false);
  });

  it('should delete a feature', async () => {
    await setup([mark, obsolete]);
    button('Delete feature obsolete').click();
    await fixture.whenStable();
    expect(changes).toEqual([[mark]]);
  });

  it('should move features', async () => {
    await setup([mark, obsolete, jane]);
    // the first feature cannot move up, the last one cannot move down
    expect(button('Move feature son up').disabled).toBe(true);
    expect(
      el().querySelectorAll<HTMLButtonElement>('button[aria-label="Move feature son down"]')[1]
        .disabled,
    ).toBe(true);

    button('Move feature obsolete up').click();
    await fixture.whenStable();
    expect(component.features()).toEqual([obsolete, mark, jane]);

    button('Move feature obsolete down').click();
    await fixture.whenStable();
    expect(component.features()).toEqual([mark, obsolete, jane]);

    // out of range moves are ignored
    component.moveFeature(0, -1);
    component.moveFeature(2, 1);
    expect(component.features()).toEqual([mark, obsolete, jane]);
  });
});
