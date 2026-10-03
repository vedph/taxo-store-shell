import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { DataPage } from '@myrmidon/ngx-tools';
import {
  TaxoStoreNode,
  TaxoStoreNodeFlagMatchMode,
  TaxoStoreService,
} from '@myrmidon/taxo-store-api';

import { TaxoStorePagedTreeService } from './taxo-store-paged-tree.service';

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
    flags: 'x',
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

  it('should get root nodes without label filter', async () => {
    service.treeId = 't';
    const result = await firstValueFrom(service.getNodes({ flags: 'x' }, 2, 5));
    expect(api.getRootNodes).toHaveBeenCalledWith('t', { pageNumber: 2, pageSize: 5 }, true);
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
        flags: 'x',
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
      matchDescendants: true,
      flagMatchMode: TaxoStoreNodeFlagMatchMode.Any,
      includePosition: true,
    });
  });

  it('should add flags to root label filter', async () => {
    service.treeId = 't';
    const result = await firstValueFrom(service.getNodes({ label: 'b', flags: 'x' }, 1, 5));
    expect(api.getNodes.mock.calls[0][0].flags).toBe('x');
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
      flagMatchMode: TaxoStoreNodeFlagMatchMode.Any,
      includePosition: true,
    });
    expect(result.items.map((n) => n.id)).toEqual([2]);
  });

  it('should get child nodes with label and flags filter', async () => {
    service.treeId = 't';
    await firstValueFrom(service.getNodes({ parentId: 1, label: 'b', flags: 'y' }, 1, 5));
    expect(api.getNodes).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 5,
      treeId: 't',
      parentId: 1,
      flagMatchMode: TaxoStoreNodeFlagMatchMode.Any,
      includePosition: true,
      filteredLabel: 'b',
      matchDescendants: true,
      flags: 'y',
    });
  });
});
