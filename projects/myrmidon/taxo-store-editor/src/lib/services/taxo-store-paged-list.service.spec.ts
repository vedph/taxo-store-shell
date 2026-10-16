import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { DataPage } from '@myrmidon/ngx-tools';
import {
  TaxoStoreNode,
  TaxoStoreNodeFeatureMatchMode,
  TaxoStoreService,
} from '@myrmidon/taxo-store-api';

import { TaxoStorePagedListService } from './taxo-store-paged-list.service';

function page(items: TaxoStoreNode[]): DataPage<TaxoStoreNode> {
  return { pageNumber: 2, pageSize: 5, pageCount: 3, total: 11, items };
}

describe('TaxoStorePagedListService', () => {
  let service: TaxoStorePagedListService;
  let api: { getNodes: ReturnType<typeof vi.fn>; getRootNodes: ReturnType<typeof vi.fn> };

  const node: TaxoStoreNode = {
    id: 1,
    parentId: null as unknown as undefined, // as returned by the API
    treeId: 't',
    key: 'a',
    label: 'A',
    filteredLabel: 'a',
    features: [
      { name: 'color', value: 'red', filteredValue: 'red' },
      { name: 'obsolete', value: '', filteredValue: '' },
    ],
    note: 'n',
  };

  beforeEach(() => {
    api = {
      getNodes: vi.fn(() => of(page([node]))),
      getRootNodes: vi.fn(() => of(page([node]))),
    };
    TestBed.configureTestingModule({
      providers: [TaxoStorePagedListService, { provide: TaxoStoreService, useValue: api }],
    });
    service = TestBed.inject(TaxoStorePagedListService);
  });

  it('should get and set tree ID', () => {
    expect(service.treeId).toBeUndefined();
    service.treeId = 't';
    expect(service.treeId).toBe('t');
  });

  it('should return an empty page without tree ID', async () => {
    const result = await firstValueFrom(service.loadPage(1, 7, {}));
    expect(result).toEqual({ pageNumber: 1, pageSize: 7, pageCount: 0, total: 0, items: [] });
    expect(api.getNodes).not.toHaveBeenCalled();
    expect(api.getRootNodes).not.toHaveBeenCalled();
  });

  it('should get root nodes with features without filter', async () => {
    service.treeId = 't';
    const result = await firstValueFrom(service.loadPage(2, 5, { features: [] }));
    expect(api.getRootNodes).toHaveBeenCalledWith(
      't',
      { pageNumber: 2, pageSize: 5 },
      false,
      false,
      true,
    );
    expect(api.getNodes).not.toHaveBeenCalled();
    expect(result.pageNumber).toBe(2);
    expect(result.pageSize).toBe(5);
    expect(result.pageCount).toBe(3);
    expect(result.total).toBe(11);
    expect(result.items).toEqual([
      {
        id: 1,
        parentId: undefined,
        y: 1,
        x: 1,
        label: 'A',
        // nodes in a flat tree never have children
        hasChildren: false,
        treeId: 't',
        key: 'a',
        filteredLabel: 'a',
        features: node.features,
        featuresSummary: 'color=red; obsolete',
        note: 'n',
      },
    ]);
  });

  it('should filter by label', async () => {
    service.treeId = 't';
    const result = await firstValueFrom(service.loadPage(1, 5, { label: 'a' }));
    expect(api.getRootNodes).not.toHaveBeenCalled();
    expect(api.getNodes).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 5,
      treeId: 't',
      isRoot: true,
      filteredLabel: 'a',
      filteredMappingLabel: 'a',
      features: undefined,
      featureMatchMode: undefined,
      includeFeatures: true,
    });
    expect(result.items.map((n) => n.id)).toEqual([1]);
    expect(result.items[0].hasChildren).toBe(false);
  });

  it('should filter by features with the default match mode', async () => {
    service.treeId = 't';
    await firstValueFrom(service.loadPage(1, 5, { features: [{ name: 'obsolete' }] }));
    expect(api.getNodes).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 5,
      treeId: 't',
      isRoot: true,
      filteredLabel: undefined,
      filteredMappingLabel: undefined,
      features: [{ name: 'obsolete' }],
      featureMatchMode: TaxoStoreNodeFeatureMatchMode.All,
      includeFeatures: true,
    });
  });

  it('should filter by features with the specified match mode', async () => {
    service.treeId = 't';
    await firstValueFrom(
      service.loadPage(1, 5, {
        features: [{ name: 'obsolete' }],
        featureMatchMode: TaxoStoreNodeFeatureMatchMode.None,
      }),
    );
    expect(api.getNodes.mock.calls[0][0].featureMatchMode).toBe(TaxoStoreNodeFeatureMatchMode.None);
  });
});
