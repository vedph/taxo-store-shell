import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { DataPage } from '@myrmidon/ngx-tools';
import {
  TaxoStoreNode,
  TaxoStoreNodeFeatureMatchMode,
  TaxoStoreService,
} from '@myrmidon/taxo-store-api';

import {
  hasTaxoFeatureFilter,
  summarizeTaxoFeatures,
  TaxoStorePagedTreeService,
  TaxoStoreTreeNode,
} from './taxo-store-paged-tree.service';

function page(items: TaxoStoreNode[]): DataPage<TaxoStoreNode> {
  return { pageNumber: 2, pageSize: 5, pageCount: 3, total: 11, items };
}

describe('TaxoStorePagedTreeService', () => {
  let service: TaxoStorePagedTreeService;
  let api: { getNodes: ReturnType<typeof vi.fn>; getRootNodes: ReturnType<typeof vi.fn> };

  const root: TaxoStoreNode = {
    id: 1,
    parentId: null as unknown as undefined, // as returned by the API
    treeId: 't',
    key: 'a',
    label: 'A',
    filteredLabel: 'a',
    features: [{ name: 'status', value: 'draft', filteredValue: 'draft' }],
    note: 'n',
    y: 1,
    x: 2,
    hasChildren: true,
  };
  const child: TaxoStoreNode = {
    id: 2,
    parentId: 1,
    treeId: 't',
    key: 'a.b',
    label: 'B',
    filteredLabel: 'b',
    features: [],
  };

  beforeEach(() => {
    api = {
      getNodes: vi.fn(() => of(page([child]))),
      getRootNodes: vi.fn(() => of(page([root]))),
    };
    TestBed.configureTestingModule({
      providers: [TaxoStorePagedTreeService, { provide: TaxoStoreService, useValue: api }],
    });
    service = TestBed.inject(TaxoStorePagedTreeService);
  });

  it('should get and set tree ID', () => {
    expect(service.treeId).toBeUndefined();
    service.treeId = 't';
    expect(service.treeId).toBe('t');
  });

  it('should return an empty page without tree ID', async () => {
    const result = await firstValueFrom(service.getNodes({}, 1, 7));
    expect(result).toEqual({ pageNumber: 1, pageSize: 7, pageCount: 0, total: 0, items: [] });
    expect(api.getNodes).not.toHaveBeenCalled();
    expect(api.getRootNodes).not.toHaveBeenCalled();
  });

  it('should get root nodes with position and features without filters', async () => {
    service.treeId = 't';
    const result = await firstValueFrom(service.getNodes({ features: [] }, 2, 5));
    expect(api.getRootNodes).toHaveBeenCalledWith(
      't',
      { pageNumber: 2, pageSize: 5 },
      true,
      false,
      true,
    );
    expect(result.pageNumber).toBe(2);
    expect(result.pageSize).toBe(5);
    expect(result.pageCount).toBe(3);
    expect(result.total).toBe(11);
    expect(result.items).toEqual([
      {
        id: 1,
        parentId: undefined,
        y: 1,
        x: 2,
        label: 'A',
        hasChildren: true,
        treeId: 't',
        key: 'a',
        filteredLabel: 'a',
        features: root.features,
        featuresSummary: 'status=draft',
        note: 'n',
      },
    ]);
  });

  it('should default missing position to 1,1', async () => {
    service.treeId = 't';
    const result = await firstValueFrom(service.getNodes({ parentId: 1 }, 1, 5));
    expect(result.items[0].y).toBe(1);
    expect(result.items[0].x).toBe(1);
    expect(result.items[0].parentId).toBe(1);
    // no features: no summary
    expect((result.items[0] as TaxoStoreTreeNode).featuresSummary).toBeUndefined();
  });

  it('should get root nodes matching label via descendants', async () => {
    service.treeId = 't';
    await firstValueFrom(service.getNodes({ label: 'b' }, 1, 5));
    expect(api.getRootNodes).not.toHaveBeenCalled();
    expect(api.getNodes).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 5,
      treeId: 't',
      isRoot: true,
      filteredLabel: 'b',
      filteredMappingLabel: 'b',
      matchDescendants: true,
      includePosition: true,
      includeFeatures: true,
    });
  });

  it('should add features to root label filter', async () => {
    service.treeId = 't';
    const result = await firstValueFrom(
      service.getNodes(
        {
          label: 'b',
          features: [{ name: 'status', value: 'draft' }],
          featureMatchMode: TaxoStoreNodeFeatureMatchMode.None,
        },
        1,
        5,
      ),
    );
    const filter = api.getNodes.mock.calls[0][0];
    expect(filter.features).toEqual([{ name: 'status', value: 'draft' }]);
    expect(filter.featureMatchMode).toBe(TaxoStoreNodeFeatureMatchMode.None);
    expect(result.items[0].id).toBe(2);
  });

  it('should get child nodes', async () => {
    service.treeId = 't';
    const result = await firstValueFrom(service.getNodes({ parentId: 1 }, 1, 5));
    expect(api.getNodes).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 5,
      treeId: 't',
      parentId: 1,
      includePosition: true,
      includeFeatures: true,
    });
    expect(result.items.map((n) => n.id)).toEqual([2]);
  });

  it('should get root nodes matching features via descendants', async () => {
    service.treeId = 't';
    await firstValueFrom(service.getNodes({ features: [{ name: 'status' }] }, 1, 5));
    expect(api.getRootNodes).not.toHaveBeenCalled();
    expect(api.getNodes).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 5,
      treeId: 't',
      isRoot: true,
      matchDescendants: true,
      features: [{ name: 'status' }],
      featureMatchMode: TaxoStoreNodeFeatureMatchMode.All,
      includePosition: true,
      includeFeatures: true,
    });
  });

  it('should get child nodes matching features via descendants', async () => {
    service.treeId = 't';
    await firstValueFrom(
      service.getNodes(
        {
          parentId: 1,
          features: [{ name: 'status' }],
          featureMatchMode: TaxoStoreNodeFeatureMatchMode.None,
        },
        1,
        5,
      ),
    );
    expect(api.getNodes).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 5,
      treeId: 't',
      parentId: 1,
      matchDescendants: true,
      features: [{ name: 'status' }],
      featureMatchMode: TaxoStoreNodeFeatureMatchMode.None,
      includePosition: true,
      includeFeatures: true,
    });
  });

  it('should get child nodes with label and features filter', async () => {
    service.treeId = 't';
    await firstValueFrom(
      service.getNodes({ parentId: 1, label: 'b', features: [{ name: 'obsolete' }] }, 1, 5),
    );
    expect(api.getNodes).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 5,
      treeId: 't',
      parentId: 1,
      includePosition: true,
      includeFeatures: true,
      filteredLabel: 'b',
      filteredMappingLabel: 'b',
      matchDescendants: true,
      features: [{ name: 'obsolete' }],
      featureMatchMode: TaxoStoreNodeFeatureMatchMode.All,
    });
  });
});

describe('feature helpers', () => {
  it('hasTaxoFeatureFilter should check for criteria', () => {
    expect(hasTaxoFeatureFilter({})).toBe(false);
    expect(hasTaxoFeatureFilter({ features: [] })).toBe(false);
    expect(hasTaxoFeatureFilter({ features: [{ name: 'a' }] })).toBe(true);
  });

  it('summarizeTaxoFeatures should summarize features', () => {
    expect(summarizeTaxoFeatures(undefined)).toBeUndefined();
    expect(summarizeTaxoFeatures(null)).toBeUndefined();
    expect(summarizeTaxoFeatures([])).toBeUndefined();
    expect(
      summarizeTaxoFeatures([
        { name: 'son', value: 'Mark' },
        { name: 'son', value: 'Jane' },
        { name: 'obsolete' },
      ]),
    ).toBe('son=Mark; son=Jane; obsolete');
  });
});
