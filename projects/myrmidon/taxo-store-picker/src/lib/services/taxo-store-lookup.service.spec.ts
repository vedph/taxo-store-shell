import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import {
  TaxoStoreNode,
  TaxoStoreNodeFlagMatchMode,
  TaxoStoreService,
} from '@myrmidon/taxo-store-api';

import { TaxoStoreLookupService } from './taxo-store-lookup.service';

describe('TaxoStoreLookupService', () => {
  let service: TaxoStoreLookupService;
  let api: {
    getNodes: ReturnType<typeof vi.fn>;
    getNode: ReturnType<typeof vi.fn>;
    getNodeFromKey: ReturnType<typeof vi.fn>;
  };

  const node: TaxoStoreNode = {
    id: 29,
    treeId: 'animals',
    key: 'animal.bird',
    label: 'birds',
    filteredLabel: 'birds',
  };

  beforeEach(() => {
    api = {
      getNodes: vi.fn(() =>
        of({ pageNumber: 1, pageSize: 10, pageCount: 1, total: 1, items: [node] }),
      ),
      getNode: vi.fn(() => of(node)),
      getNodeFromKey: vi.fn(() => of(node)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: TaxoStoreService, useValue: api }],
    });
    service = TestBed.inject(TaxoStoreLookupService);
  });

  it('should have taxostore ID', () => {
    expect(service.id).toBe('taxostore');
  });

  it('lookup should return empty without tree ID', async () => {
    expect(await firstValueFrom(service.lookup({ text: 'b', limit: 0 }))).toEqual([]);
    expect(api.getNodes).not.toHaveBeenCalled();
  });

  it('lookup should return empty without text', async () => {
    expect(await firstValueFrom(service.lookup({ treeId: 'animals', text: '', limit: 0 }))).toEqual(
      [],
    );
    expect(api.getNodes).not.toHaveBeenCalled();
  });

  it('lookup should query by label with default limit and match mode', async () => {
    const result = await firstValueFrom(
      service.lookup({ treeId: 'animals', text: 'bi', limit: 0 }),
    );
    expect(result).toEqual([node]);
    expect(api.getNodes).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 10,
      treeId: 'animals',
      filteredLabel: 'bi',
      flagMatchMode: TaxoStoreNodeFlagMatchMode.Any,
    });
  });

  it('lookup should apply limit and options', async () => {
    await firstValueFrom(
      service.lookup(
        { treeId: 'animals', text: 'bi', limit: 3 },
        { parentKey: 'animal', flags: 'ab', flagMatchMode: TaxoStoreNodeFlagMatchMode.All },
      ),
    );
    expect(api.getNodes).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 3,
      treeId: 'animals',
      filteredLabel: 'bi',
      flagMatchMode: TaxoStoreNodeFlagMatchMode.All,
      parentKey: 'animal',
      flags: 'ab',
    });
  });

  it('getName should return label or empty', () => {
    expect(service.getName(node)).toBe('birds');
    expect(service.getName(undefined)).toBe('');
    expect(service.getName(null)).toBe('');
  });

  it('getById should get node by numeric ID', async () => {
    expect(await firstValueFrom(service.getById('29'))).toBe(node);
    expect(api.getNode).toHaveBeenCalledWith(29);
  });

  it('getById should map null node to undefined', async () => {
    api.getNode.mockReturnValueOnce(of(null));
    expect(await firstValueFrom(service.getById('99'))).toBeUndefined();
  });

  it('getById should get node by tree and key', async () => {
    expect(await firstValueFrom(service.getById('animals.animal'))).toBe(node);
    expect(api.getNodeFromKey).toHaveBeenCalledWith('animals', 'animal');
  });

  it('getById should keep dots in key', async () => {
    await firstValueFrom(service.getById('animals.animal.bird.crow'));
    expect(api.getNodeFromKey).toHaveBeenCalledWith('animals', 'animal.bird.crow');
  });

  it('getById should map null key node to undefined', async () => {
    api.getNodeFromKey.mockReturnValueOnce(of(null));
    expect(await firstValueFrom(service.getById('animals.x'))).toBeUndefined();
  });

  for (const id of ['animals', '.key', 'animals.', '']) {
    it(`getById should return undefined for invalid ID "${id}"`, async () => {
      expect(await firstValueFrom(service.getById(id))).toBeUndefined();
      expect(api.getNodeFromKey).not.toHaveBeenCalled();
      expect(api.getNode).not.toHaveBeenCalled();
    });
  }
});
