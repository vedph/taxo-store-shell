import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { DataPage } from '@myrmidon/ngx-tools';
import { RefLookupComponent } from '@myrmidon/cadmus-refs-lookup';
import {
  TaxoStoreNode,
  TaxoStoreNodeFeatureMatchMode,
  TaxoStoreService,
} from '@myrmidon/taxo-store-api';
import { TaxoStoreEditor, TaxoStoreTreeNode } from '@myrmidon/taxo-store-editor';

import { TaxoStorePicker } from './taxo-store-picker';

function page(items: TaxoStoreNode[]): DataPage<TaxoStoreNode> {
  return { pageNumber: 1, pageSize: 0, pageCount: 1, total: items.length, items };
}

describe('TaxoStorePicker', () => {
  let fixture: ComponentFixture<TaxoStorePicker>;
  let component: TaxoStorePicker;
  let api: {
    getRootNodes: ReturnType<typeof vi.fn>;
    getNodes: ReturnType<typeof vi.fn>;
  };

  const roots: TaxoStoreNode[] = [
    { id: 1, treeId: 't', key: 'animal', label: 'animals', filteredLabel: 'animals' },
    { id: 2, treeId: 't', key: 'plant', label: 'plants', filteredLabel: 'plants' },
  ];

  async function setup(inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(TaxoStorePicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('treeId', 't');
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    api = {
      getRootNodes: vi.fn(() => of(page(roots))),
      getNodes: vi.fn(() => of(page([]))),
    };
    await TestBed.configureTestingModule({
      imports: [TaxoStorePicker],
      providers: [{ provide: TaxoStoreService, useValue: api }],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load top nodes for tree', async () => {
    await setup();
    expect(api.getRootNodes).toHaveBeenCalledWith('t', { pageNumber: 1, pageSize: 0 });
    expect(component.topNodes()).toEqual(roots);
    expect(component.loading()).toBe(false);
    expect(el().querySelector('.top-node-select')).toBeTruthy();
  });

  it('should not load top nodes when filter is disabled', async () => {
    await setup({ hasTopNodeFilter: false });
    expect(api.getRootNodes).not.toHaveBeenCalledWith('t', { pageNumber: 1, pageSize: 0 });
    expect(component.topNodes()).toEqual([]);
    expect(el().querySelector('.top-node-select')).toBeNull();
  });

  it('should clear top nodes and editor without tree', async () => {
    await setup({ treeId: null });
    expect(component.topNodes()).toEqual([]);
    expect(el().querySelector('mat-expansion-panel')).toBeNull();
    expect(component.lookupFilter()).toEqual({ treeId: undefined });
  });

  it('should handle top nodes load error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // fail only the picker's top nodes request (the editor requests positions)
    api.getRootNodes.mockImplementation((_id: string, _o: unknown, pos?: boolean) =>
      pos ? of(page(roots)) : throwError(() => 'boom'),
    );
    await setup();
    expect(component.topNodes()).toEqual([]);
    expect(component.loading()).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it('should reset selected top node and reload when tree changes', async () => {
    await setup();
    component.onTopNodeChange('animal');
    expect(component.lookupOptions()).toEqual({ ancestorKey: 'animal' });
    const otherRoots = [{ ...roots[0], id: 9, treeId: 'u', key: 'x' }];
    api.getRootNodes.mockReturnValue(of(page(otherRoots)));
    fixture.componentRef.setInput('treeId', 'u');
    await settle();
    expect(component.selectedTopNodeKey()).toBeNull();
    expect(component.topNodes()).toEqual(otherRoots);
    expect(component.lookupFilter()).toEqual({ treeId: 'u' });
  });

  it('should ignore stale top nodes response', async () => {
    const slow = new Subject<DataPage<TaxoStoreNode>>();
    api.getRootNodes.mockReturnValueOnce(slow);
    await setup();
    api.getRootNodes.mockReturnValue(of(page([roots[1]])));
    fixture.componentRef.setInput('treeId', 'u');
    await settle();
    slow.next(page(roots));
    slow.complete();
    await settle();
    expect(component.topNodes()).toEqual([roots[1]]);
  });

  it('should hide features filter without available features', async () => {
    await setup();
    expect(component.showFeaturesFilter()).toBe(false);
    expect(el().querySelector('.features-select')).toBeNull();
  });

  it('should hide features filter when disabled', async () => {
    await setup({
      hasFeaturesFilter: false,
      availableFeatures: [{ id: 'a', name: 'alpha', filter: { name: 'a' } }],
    });
    expect(component.showFeaturesFilter()).toBe(false);
  });

  it('should show features filter and build lookup options', async () => {
    await setup({
      availableFeatures: [
        { id: 'o', name: 'obsolete', filter: { name: 'obsolete' } },
        { id: 'd', name: 'draft', filter: { name: 'status', value: 'draft' } },
        { id: 'r', name: 'red', filter: { name: 'color', value: 'red' } },
      ],
    });
    expect(component.showFeaturesFilter()).toBe(true);
    expect(el().querySelector('.features-select')).toBeTruthy();
    expect(el().querySelector('.feature-mode-select')).toBeTruthy();
    expect(component.featureMatchModes.map((m) => m.value)).toEqual([
      TaxoStoreNodeFeatureMatchMode.All,
      TaxoStoreNodeFeatureMatchMode.Any,
      TaxoStoreNodeFeatureMatchMode.None,
    ]);
    expect(component.selectedFeatureMatchMode()).toBe(TaxoStoreNodeFeatureMatchMode.All);
    // no clear button without selection
    expect(el().querySelector('button[aria-label="Clear features"]')).toBeNull();

    // options are in their order, whatever the selection order; unknown
    // IDs are ignored
    component.onFeaturesChange(['r', 'o', 'x']);
    component.onFeatureMatchModeChange(TaxoStoreNodeFeatureMatchMode.None);
    component.onTopNodeChange('plant');
    expect(component.lookupOptions()).toEqual({
      ancestorKey: 'plant',
      features: [{ name: 'obsolete' }, { name: 'color', value: 'red' }],
      featureMatchMode: TaxoStoreNodeFeatureMatchMode.None,
    });
    await fixture.whenStable();

    const clear = el().querySelector<HTMLButtonElement>('button[aria-label="Clear features"]')!;
    expect(clear).toBeTruthy();
    clear.click();
    expect(component.selectedFeatures()).toEqual([]);
    component.onTopNodeChange(null);
    expect(component.lookupOptions()).toEqual({});
  });

  it('should pass inputs to lookup and editor', async () => {
    await setup({
      label: 'taxon',
      canEdit: false,
      canAdd: false,
      canDelete: false,
      hideLoc: true,
      hideFilter: true,
    });
    const lookup = fixture.debugElement.query(
      (d) => d.componentInstance instanceof RefLookupComponent,
    ).componentInstance as RefLookupComponent;
    expect(lookup.label()).toBe('taxon');
    expect(lookup.service()).toBe(component.lookupService);

    const editor = fixture.debugElement.query((d) => d.componentInstance instanceof TaxoStoreEditor)
      .componentInstance as TaxoStoreEditor;
    expect(editor.treeId()).toBe('t');
    expect(editor.canPick()).toBe(true);
    expect(editor.canEdit()).toBe(false);
    expect(editor.canAdd()).toBe(false);
    expect(editor.canDelete()).toBe(false);
    expect(editor.hideLoc()).toBe(true);
    expect(editor.hideFilter()).toBe(true);
  });

  it('should toggle expansion', async () => {
    await setup();
    const toggle = el().querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle tree editor"]',
    )!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('expand_more');
    toggle.click();
    await fixture.whenStable();
    expect(component.expanded()).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toContain('expand_less');
    toggle.click();
    expect(component.expanded()).toBe(false);
  });

  it('should emit picked lookup item', async () => {
    await setup();
    const picked: (TaxoStoreNode | null)[] = [];
    component.nodePick.subscribe((n) => picked.push(n));
    const lookup = fixture.debugElement.query(
      (d) => d.componentInstance instanceof RefLookupComponent,
    ).componentInstance as RefLookupComponent;
    lookup.item.set(roots[0]);
    lookup.item.set(null);
    // the model emits only on user changes, so call the handler too
    component.onLookupItemChange(roots[1]);
    expect(component.pickedItem()).toBe(roots[1]);
    expect(picked).toContain(roots[1]);
    component.onLookupItemChange(null);
    expect(component.pickedItem()).toBeNull();
    expect(picked[picked.length - 1]).toBeNull();
  });

  it('should emit node picked from editor and collapse', async () => {
    await setup();
    component.expanded.set(true);
    const picked: (TaxoStoreNode | null)[] = [];
    component.nodePick.subscribe((n) => picked.push(n));
    const treeNode: TaxoStoreTreeNode = {
      id: 3,
      parentId: 1,
      treeId: 't',
      key: 'animal.bird',
      label: 'birds',
      filteredLabel: 'birds',
      features: [{ name: 'obsolete', value: '' }],
      featuresSummary: 'obsolete',
      note: 'n',
      x: 1,
      y: 2,
      hasChildren: true,
      tag: 'ignored',
    };
    const editor = fixture.debugElement.query((d) => d.componentInstance instanceof TaxoStoreEditor)
      .componentInstance as TaxoStoreEditor;
    editor.nodePick.emit(treeNode);
    const expected: TaxoStoreNode = {
      id: 3,
      parentId: 1,
      treeId: 't',
      key: 'animal.bird',
      label: 'birds',
      filteredLabel: 'birds',
      features: [{ name: 'obsolete', value: '' }],
      note: 'n',
      x: 1,
      y: 2,
      hasChildren: true,
    };
    expect(picked).toEqual([expected]);
    expect(component.pickedItem()).toEqual(expected);
    expect(component.expanded()).toBe(false);
  });
});
