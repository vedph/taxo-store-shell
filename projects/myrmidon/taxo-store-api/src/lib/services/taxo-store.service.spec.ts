import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { DataPage, EnvService } from '@myrmidon/ngx-tools';

import { TaxoStoreNode, TaxoStoreTree } from '../models';
import { TaxoStoreNodeFlagMatchMode, TaxoStoreService } from './taxo-store.service';

const API = 'http://test/api/';
const URL = `${API}taxostore/`;

function makeNode(id: number, key = `k${id}`): TaxoStoreNode {
  return { id, treeId: 't', key, label: `L${id}`, filteredLabel: `l${id}` };
}

function makePage<T>(items: T[]): DataPage<T> {
  return { pageNumber: 1, pageSize: 20, pageCount: 1, total: items.length, items };
}

describe('TaxoStoreService', () => {
  let service: TaxoStoreService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(EnvService).set('taxoUrl', API);
    service = TestBed.inject(TaxoStoreService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  /**
   * Flush the same error to the original request and to all its retries.
   */
  function failWithRetries(url: string, status: number, times = 4): void {
    for (let i = 0; i < times; i++) {
      http.expectOne(url).flush('boom', { status, statusText: 'Error' });
    }
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // #region URL prefix
  it('should have default url prefix', () => {
    expect(service.urlPrefix).toBe('taxostore/');
  });

  it('should use a custom url prefix', async () => {
    service.urlPrefix = 'custom/';
    expect(service.urlPrefix).toBe('custom/');
    const p = firstValueFrom(service.getNode(1));
    http.expectOne(`${API}custom/nodes/1`).flush(makeNode(1));
    expect((await p)?.id).toBe(1);
  });

  it('should handle an empty url prefix', async () => {
    service.urlPrefix = '';
    const p = firstValueFrom(service.getNode(1));
    http.expectOne(`${API}nodes/1`).flush(makeNode(1));
    await p;
  });
  // #endregion

  // #region Trees
  it('getTree should get a tree', async () => {
    const tree: TaxoStoreTree = { id: 'animals', name: 'Animals' };
    const p = firstValueFrom(service.getTree('animals'));
    const req = http.expectOne(`${URL}trees/animals`);
    expect(req.request.method).toBe('GET');
    req.flush(tree);
    expect(await p).toEqual(tree);
  });

  it('getTree should return null on 404 without retrying', async () => {
    const p = firstValueFrom(service.getTree('none'));
    http.expectOne(`${URL}trees/none`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(await p).toBeNull();
  });

  it('getTree should retry and then error on server error', async () => {
    const p = firstValueFrom(service.getTree('x'));
    failWithRetries(`${URL}trees/x`, 500);
    await expect(p).rejects.toContain('Server error');
  });

  it('getTrees should pass paging and name', async () => {
    const page = makePage<TaxoStoreTree>([{ id: 'a', name: 'A' }]);
    const p = firstValueFrom(service.getTrees({ pageNumber: 2, pageSize: 5, name: 'an' }));
    const req = http.expectOne((r) => r.url === `${URL}trees`);
    expect(req.request.params.get('pageNumber')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('5');
    expect(req.request.params.get('name')).toBe('an');
    req.flush(page);
    expect(await p).toEqual(page);
  });

  it('getTrees should omit empty name', async () => {
    const p = firstValueFrom(service.getTrees({ pageNumber: 1, pageSize: 5 }));
    const req = http.expectOne((r) => r.url === `${URL}trees`);
    expect(req.request.params.has('name')).toBe(false);
    req.flush(makePage([]));
    await p;
  });

  it('addTree should post tree and return its ID', async () => {
    const tree: TaxoStoreTree = { id: 'new', name: 'New' };
    const p = firstValueFrom(service.addTree(tree));
    const req = http.expectOne(`${URL}trees`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(tree);
    // the API returns 201 with no body
    req.flush(null, { status: 201, statusText: 'Created' });
    expect(await p).toBe('new');
  });

  it('addTree should not retry on error', async () => {
    const p = firstValueFrom(service.addTree({ id: 'x', name: 'X' }));
    http.expectOne(`${URL}trees`).flush('bad', { status: 400, statusText: 'Bad' });
    await expect(p).rejects.toBe('Server error: bad');
  });

  it('deleteTree should delete', async () => {
    const p = firstValueFrom(service.deleteTree('x'));
    const req = http.expectOne(`${URL}trees/x`);
    expect(req.request.method).toBe('DELETE');
    req.flush('x');
    expect(await p).toBe('x');
  });
  // #endregion

  // #region Nodes
  it('getNodeFromKey should get node', async () => {
    const p = firstValueFrom(service.getNodeFromKey('animals', 'animal.bird'));
    http.expectOne(`${URL}nodes/tree/animals/key/animal.bird`).flush(makeNode(29));
    expect((await p)?.id).toBe(29);
  });

  it('getNodeFromKey should encode path segments', async () => {
    const p = firstValueFrom(service.getNodeFromKey('t', 'a/b c'));
    http.expectOne(`${URL}nodes/tree/t/key/a%2Fb%20c`).flush(makeNode(1));
    await p;
  });

  it('getNodeFromKey should return null on 404', async () => {
    const p = firstValueFrom(service.getNodeFromKey('t', 'none'));
    http
      .expectOne(`${URL}nodes/tree/t/key/none`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    expect(await p).toBeNull();
  });

  it('getNode should get node', async () => {
    const p = firstValueFrom(service.getNode(3));
    http.expectOne(`${URL}nodes/3`).flush(makeNode(3));
    expect(await p).toEqual(makeNode(3));
  });

  it('getNode should return null on 404', async () => {
    const p = firstValueFrom(service.getNode(999));
    http.expectOne(`${URL}nodes/999`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(await p).toBeNull();
  });

  it('getNode should succeed after a transient error', async () => {
    const p = firstValueFrom(service.getNode(3));
    http.expectOne(`${URL}nodes/3`).flush('x', { status: 503, statusText: 'Unavailable' });
    http.expectOne(`${URL}nodes/3`).flush(makeNode(3));
    expect((await p)?.id).toBe(3);
  });

  it('getNode should report client-side errors', async () => {
    const p = firstValueFrom(service.getNode(3));
    for (let i = 0; i < 4; i++) {
      http.expectOne(`${URL}nodes/3`).error(new ErrorEvent('Network error'));
    }
    await expect(p).rejects.toContain('try again later');
  });

  it('getNodes should pass only required params with minimal filter', async () => {
    const p = firstValueFrom(
      service.getNodes({
        pageNumber: 1,
        pageSize: 10,
        flagMatchMode: TaxoStoreNodeFlagMatchMode.Any,
      }),
    );
    const req = http.expectOne((r) => r.url === `${URL}nodes`);
    expect(req.request.params.keys().sort()).toEqual(['flagMatchMode', 'pageNumber', 'pageSize']);
    expect(req.request.params.get('flagMatchMode')).toBe('any');
    req.flush(makePage([makeNode(1)]));
    expect((await p).items.length).toBe(1);
  });

  it('getNodes should pass all filter params', async () => {
    const p = firstValueFrom(
      service.getNodes({
        pageNumber: 2,
        pageSize: 10,
        treeId: 't',
        parentId: 0,
        key: 'k',
        parentKey: 'pk',
        ancestorKey: ['a1', 'a2'],
        filteredLabel: 'lab',
        flags: 'ab',
        flagMatchMode: TaxoStoreNodeFlagMatchMode.All,
        isLeaf: false,
        includePosition: true,
        isRoot: true,
        matchDescendants: true,
      }),
    );
    const req = http.expectOne((r) => r.url === `${URL}nodes`);
    const params = req.request.params;
    expect(params.get('pageNumber')).toBe('2');
    expect(params.get('treeId')).toBe('t');
    expect(params.get('parentId')).toBe('0');
    expect(params.get('key')).toBe('k');
    expect(params.get('parentKey')).toBe('pk');
    expect(params.getAll('ancestorKey')).toEqual(['a1', 'a2']);
    expect(params.get('filteredLabel')).toBe('lab');
    expect(params.get('flags')).toBe('ab');
    expect(params.get('flagMatchMode')).toBe('all');
    expect(params.get('isLeaf')).toBe('false');
    expect(params.get('includePosition')).toBe('true');
    expect(params.get('isRoot')).toBe('true');
    expect(params.get('matchDescendants')).toBe('true');
    req.flush(makePage([]));
    await p;
  });

  it('getNodes should omit false boolean options', async () => {
    const p = firstValueFrom(
      service.getNodes({
        pageNumber: 1,
        pageSize: 10,
        flagMatchMode: TaxoStoreNodeFlagMatchMode.None,
        includePosition: false,
        isRoot: false,
        matchDescendants: false,
      }),
    );
    const req = http.expectOne((r) => r.url === `${URL}nodes`);
    expect(req.request.params.has('includePosition')).toBe(false);
    expect(req.request.params.has('isRoot')).toBe(false);
    expect(req.request.params.has('matchDescendants')).toBe(false);
    req.flush(makePage([]));
    await p;
  });

  it('getRootNodes should get roots with paging', async () => {
    const p = firstValueFrom(service.getRootNodes('t', { pageNumber: 1, pageSize: 5 }));
    const req = http.expectOne((r) => r.url === `${URL}nodes/roots/t`);
    expect(req.request.params.get('pageSize')).toBe('5');
    expect(req.request.params.has('includePosition')).toBe(false);
    req.flush(makePage([makeNode(1)]));
    expect((await p).items[0].id).toBe(1);
  });

  it('getRootNodes should request position when specified', async () => {
    const p = firstValueFrom(service.getRootNodes('t', { pageNumber: 1, pageSize: 5 }, true));
    const req = http.expectOne((r) => r.url === `${URL}nodes/roots/t`);
    expect(req.request.params.get('includePosition')).toBe('true');
    req.flush(makePage([]));
    await p;
  });

  it('addNode should return the ID of an updated node', async () => {
    const node = makeNode(5);
    const p = firstValueFrom(service.addNode(node));
    const req = http.expectOne(`${URL}nodes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(node);
    req.flush(null, { status: 201, statusText: 'Created' });
    expect(await p).toBe(5);
  });

  it('addNode should get the new ID from Location header', async () => {
    const p = firstValueFrom(service.addNode(makeNode(0, 'new')));
    http.expectOne(`${URL}nodes`).flush(null, {
      status: 201,
      statusText: 'Created',
      headers: { Location: `${URL}nodes/42` },
    });
    expect(await p).toBe(42);
  });

  it('addNode should get the new ID by key when Location is not available', async () => {
    const p = firstValueFrom(service.addNode(makeNode(0, 'new')));
    http.expectOne(`${URL}nodes`).flush(null, { status: 201, statusText: 'Created' });
    http.expectOne(`${URL}nodes/tree/t/key/new`).flush(makeNode(43, 'new'));
    expect(await p).toBe(43);
  });

  it('addNode should error when the new node cannot be found', async () => {
    const p = firstValueFrom(service.addNode(makeNode(0, 'new')));
    http.expectOne(`${URL}nodes`).flush(null, { status: 201, statusText: 'Created' });
    http
      .expectOne(`${URL}nodes/tree/t/key/new`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    await expect(p).rejects.toThrow('Added node not found');
  });

  it('addNode should error without retrying on failure', async () => {
    const p = firstValueFrom(service.addNode(makeNode(0)));
    http.expectOne(`${URL}nodes`).flush('dup', { status: 400, statusText: 'Bad' });
    await expect(p).rejects.toBe('Server error: dup');
  });

  it('addNodes should post batch', async () => {
    const nodes = [makeNode(0, 'a'), makeNode(0, 'b')];
    const p = firstValueFrom(service.addNodes(nodes));
    const req = http.expectOne(`${URL}nodes/batch`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(nodes);
    req.flush([1, 2]);
    expect(await p).toEqual([1, 2]);
  });

  it('deleteNode should delete', async () => {
    const p = firstValueFrom(service.deleteNode(7));
    const req = http.expectOne(`${URL}nodes/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(7);
    expect(await p).toBe(7);
  });

  it('nodeHasChildren should get boolean', async () => {
    const p = firstValueFrom(service.nodeHasChildren(1));
    http.expectOne(`${URL}nodes/1/haschildren`).flush(true);
    expect(await p).toBe(true);
  });

  for (const [method, path] of [
    ['getChildNodes', 'children'],
    ['getDescendantNodes', 'descendants'],
    ['getAncestorNodes', 'ancestors'],
  ] as const) {
    it(`${method} should get nodes without position by default`, async () => {
      const p = firstValueFrom(service[method](1));
      const req = http.expectOne((r) => r.url === `${URL}nodes/1/${path}`);
      expect(req.request.params.has('includePosition')).toBe(false);
      req.flush([makeNode(2)]);
      expect((await p)[0].id).toBe(2);
    });

    it(`${method} should request position when specified`, async () => {
      const p = firstValueFrom(service[method](1, true));
      const req = http.expectOne((r) => r.url === `${URL}nodes/1/${path}`);
      expect(req.request.params.get('includePosition')).toBe('true');
      req.flush([]);
      await p;
    });
  }

  it('getNodePath should pass page size', async () => {
    const path = [
      { nodeId: 1, pageNumber: 1 },
      { nodeId: 2, pageNumber: 3 },
    ];
    const p = firstValueFrom(service.getNodePath(2, 10));
    const req = http.expectOne((r) => r.url === `${URL}nodes/2/path`);
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush(path);
    expect(await p).toEqual(path);
  });

  it('clear should delete all nodes', async () => {
    const p = firstValueFrom(service.clear());
    const req = http.expectOne(`${URL}nodes`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await p;
  });
  // #endregion
});
