import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { RamStorageService } from '@myrmidon/ngx-tools';
import {
  LOOKUP_CONFIGS_KEY,
  RefLookupConfig,
  RefLookupService,
  RefLookupSetEvent,
} from '@myrmidon/cadmus-refs-lookup';
import { TaxoStoreNodeMapping } from '@myrmidon/taxo-store-api';

import { TaxoStoreNodeMappings } from './taxo-store-node-mappings';

interface FakeItem {
  id: string | number;
  name: string;
}

class FakeLookupService implements RefLookupService {
  public readonly id = 'fake';
  public lookup = vi.fn(() => of([]));
  public getName = vi.fn((item: FakeItem | undefined) => item?.name ?? '');
  public getById = vi.fn(() => of(undefined));
}

describe('TaxoStoreNodeMappings', () => {
  let fixture: ComponentFixture<TaxoStoreNodeMappings>;
  let component: TaxoStoreNodeMappings;
  let changes: TaxoStoreNodeMapping[][];
  let config: RefLookupConfig;

  const viaf: TaxoStoreNodeMapping = { scope: 'viaf', target: '100', label: 'Dante' };
  const web: TaxoStoreNodeMapping = { scope: 'web', target: 'https://example.org/x' };

  async function setup(
    mappings?: TaxoStoreNodeMapping[],
    lookupConfigs?: RefLookupConfig[],
  ): Promise<HTMLElement> {
    fixture = TestBed.createComponent(TaxoStoreNodeMappings);
    component = fixture.componentInstance;
    if (mappings) {
      fixture.componentRef.setInput('mappings', mappings);
    }
    if (lookupConfigs) {
      fixture.componentRef.setInput('lookupConfigs', lookupConfigs);
    }
    changes = [];
    component.mappings.subscribe((m) => changes.push(m));
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

  function lookupEvent(item: unknown, itemId: unknown, itemLabel: unknown): RefLookupSetEvent {
    return {
      configs: [config],
      config,
      item,
      itemId: itemId as string,
      itemLabel: itemLabel as string,
    };
  }

  beforeEach(async () => {
    config = { name: 'Fake', service: new FakeLookupService() };
    await TestBed.configureTestingModule({ imports: [TaxoStoreNodeMappings] }).compileComponents();
    TestBed.inject(RamStorageService).remove(LOOKUP_CONFIGS_KEY);
  });

  it('should show a message when there are no mappings', async () => {
    await setup();
    expect(el().querySelector('table')).toBeNull();
    expect(el().querySelector('.empty-message')?.textContent).toContain('No mappings');
    expect(component.editing()).toBe(false);
    expect(component.editorTitle()).toBe('Mapping');
  });

  it('should list mappings', async () => {
    await setup([viaf, web]);
    expect(rows().length).toBe(2);
    expect(cells(rows()[0])).toEqual(['viaf', '100', 'Dante']);
    expect(cells(rows()[1])).toEqual(['web', 'https://example.org/x', '']);
    expect(
      Array.from(el().querySelectorAll('th')).map((th) => th.textContent?.trim()),
    ).toEqual(['actions', 'scope', 'target', 'label']);
  });

  it('should link only targets which are web addresses', async () => {
    await setup([viaf, web, { scope: 'x', target: 'httpx' }, { scope: 'y', target: 'HTTP://Y' }]);
    expect(rows()[0].querySelector('a')).toBeNull();
    expect(rows()[2].querySelector('a')).toBeNull();
    const link = rows()[1].querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://example.org/x');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('aria-label')).toContain('https://example.org/x');
    expect(rows()[3].querySelector('a')).toBeTruthy();
  });

  it('should add a mapping', async () => {
    await setup([viaf]);
    el().querySelector<HTMLButtonElement>('.toolbar button')!.click();
    await fixture.whenStable();
    expect(component.editedIndex()).toBe(-1);
    expect(component.editorTitle()).toBe('New mapping');
    expect(el().querySelector('form')).toBeTruthy();
    expect(component.form.invalid).toBe(true);

    component.scope.setValue(' geonames ');
    component.target.setValue(' 42 ');
    component.label.setValue('  ');
    await fixture.whenStable();
    el().querySelector<HTMLButtonElement>('form button[type=submit]')!.click();
    await fixture.whenStable();

    expect(changes).toEqual([[viaf, { scope: 'geonames', target: '42', label: undefined }]]);
    expect(component.editing()).toBe(false);
    expect(rows().length).toBe(2);
    expect(el().querySelector('form')).toBeNull();
  });

  it('should edit a mapping', async () => {
    await setup([viaf, web]);
    rows()[0].querySelectorAll('button')[0].click();
    await fixture.whenStable();
    expect(component.editedIndex()).toBe(0);
    expect(component.editorTitle()).toBe('Edit mapping');
    expect(rows()[0].classList).toContain('edited');
    expect(component.scope.value).toBe('viaf');
    expect(component.target.value).toBe('100');
    expect(component.label.value).toBe('Dante');
    // the edited mapping is not a duplicate of itself
    expect(component.form.valid).toBe(true);

    component.label.setValue('Dante Alighieri');
    component.saveMapping();
    expect(changes).toEqual([[{ ...viaf, label: 'Dante Alighieri' }, web]]);
    expect(component.editing()).toBe(false);
  });

  it('should load a mapping without label', async () => {
    await setup([web]);
    component.editMapping(0);
    expect(component.label.value).toBe('');
    // an index out of range is ignored
    component.cancelMapping();
    component.editMapping(9);
    expect(component.editing()).toBe(false);
  });

  it('should delete a mapping', async () => {
    await setup([viaf, web]);
    rows()[0].querySelectorAll('button')[1].click();
    await fixture.whenStable();
    expect(changes).toEqual([[web]]);
    expect(rows().length).toBe(1);
  });

  it('should disable other commands while editing', async () => {
    await setup([viaf]);
    component.addMapping();
    await fixture.whenStable();
    expect(el().querySelector<HTMLButtonElement>('.toolbar button')!.disabled).toBe(true);
    expect(
      Array.from(rows()[0].querySelectorAll('button')).map((b) => b.disabled),
    ).toEqual([true, true]);
  });

  it('should cancel editing', async () => {
    await setup([viaf]);
    component.editMapping(0);
    component.label.setValue('changed');
    await fixture.whenStable();
    el().querySelector<HTMLButtonElement>('form button[type=button]')!.click();
    await fixture.whenStable();
    expect(component.editing()).toBe(false);
    expect(changes).toEqual([]);
    // a new edit starts from the saved values
    component.editMapping(0);
    expect(component.label.value).toBe('Dante');
  });

  it('should not save when not editing or invalid', async () => {
    await setup([viaf]);
    component.saveMapping();
    component.addMapping();
    component.saveMapping();
    expect(changes).toEqual([]);
    expect(component.editing()).toBe(true);
  });

  it('should validate lengths', async () => {
    await setup();
    component.addMapping();
    component.scope.setValue('s'.repeat(101));
    component.target.setValue('t'.repeat(501));
    component.label.setValue('l'.repeat(501));
    expect(component.scope.hasError('maxlength')).toBe(true);
    expect(component.target.hasError('maxlength')).toBe(true);
    expect(component.label.hasError('maxlength')).toBe(true);
    component.scope.setValue('s'.repeat(100));
    component.target.setValue('t'.repeat(500));
    component.label.setValue('l'.repeat(500));
    expect(component.form.valid).toBe(true);
  });

  it('should reject a duplicate scope and target', async () => {
    await setup([viaf, web]);
    component.addMapping();
    component.scope.setValue('viaf');
    component.target.setValue(' 100 ');
    await fixture.whenStable();
    expect(component.form.hasError('duplicate')).toBe(true);
    expect(el().querySelector('form > mat-error')?.textContent).toContain('already has a mapping');
    expect(el().querySelector<HTMLButtonElement>('form button[type=submit]')!.disabled).toBe(true);
    // same target in another scope is fine
    component.scope.setValue('lc');
    expect(component.form.valid).toBe(true);
    // editing a mapping into another one is a duplicate too
    component.editMapping(1);
    component.scope.setValue('viaf');
    component.target.setValue('100');
    expect(component.form.hasError('duplicate')).toBe(true);
  });

  it('should not show lookup when not configured', async () => {
    await setup();
    component.addMapping();
    await fixture.whenStable();
    expect(component.configs()).toEqual([]);
    expect(el().querySelector('cadmus-refs-lookup-set')).toBeNull();
  });

  it('should show lookup from stored configuration only while editing', async () => {
    TestBed.inject(RamStorageService).store(LOOKUP_CONFIGS_KEY, [config]);
    await setup();
    expect(el().querySelector('cadmus-refs-lookup-set')).toBeNull();
    component.addMapping();
    await fixture.whenStable();
    expect(component.configs()).toEqual([config]);
    expect(el().querySelector('fieldset.lookup cadmus-refs-lookup-set')).toBeTruthy();
  });

  it('should prefer lookup configurations from input', async () => {
    TestBed.inject(RamStorageService).store(LOOKUP_CONFIGS_KEY, [config]);
    await setup([], []);
    expect(component.configs()).toEqual([]);
  });

  it('should fill the mapping from a picked lookup item', async () => {
    await setup([], [config]);
    component.addMapping();
    component.onLookupItemChange(lookupEvent({ id: 'x1', name: 'Name' }, 'x1', 'Label'));
    expect(component.scope.value).toBe('fake');
    expect(component.target.value).toBe('x1');
    expect(component.label.value).toBe('Label');
    expect(component.form.dirty).toBe(true);
    expect(component.form.valid).toBe(true);
  });

  it('should get numeric IDs and missing labels from a picked lookup item', async () => {
    await setup([], [config]);
    component.addMapping();
    // without getters, the lookup set returns the item itself as ID and label
    const item: FakeItem = { id: 7, name: 'Seven' };
    component.onLookupItemChange(lookupEvent(item, 7, item));
    expect(component.target.value).toBe('7');
    expect(component.label.value).toBe('Seven');
  });

  it('should use the configuration name as scope when it has no service', async () => {
    config = { name: 'NoService' };
    await setup([], [config]);
    component.addMapping();
    component.onLookupItemChange(lookupEvent('abc', 'abc', undefined));
    expect(component.scope.value).toBe('NoService');
    expect(component.target.value).toBe('abc');
    expect(component.label.value).toBe('');
  });

  it('should ignore a cleared lookup or an item without ID', async () => {
    await setup([], [config]);
    component.editMapping(0);
    component.addMapping();
    component.scope.setValue('keep');
    component.onLookupItemChange(lookupEvent(null, null, null));
    component.onLookupItemChange(lookupEvent(undefined, undefined, undefined));
    component.onLookupItemChange(lookupEvent({ id: 1, name: 'x' }, { id: 1 }, 'x'));
    expect(component.scope.value).toBe('keep');
    expect(component.target.value).toBe('');
  });
});
