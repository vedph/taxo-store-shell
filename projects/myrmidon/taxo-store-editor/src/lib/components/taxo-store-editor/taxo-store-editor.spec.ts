import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';

import { DataPage, PagingOptions } from '@myrmidon/ngx-tools';
import { PagedTreeStore } from '@myrmidon/paged-data-browsers';
import {
  TaxoNodePathStep,
  TaxoStoreNode,
  TaxoStoreTree,
  TaxoStoreNodeFilter as ApiNodeFilter,
  TaxoStoreService,
} from '@myrmidon/taxo-store-api';

import {
  PagedTaxoStoreNode,
  TaxoStoreTreeNode,
} from '../../services/taxo-store-paged-tree.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog';
import { TaxoStoreNodeEditorDialog } from '../taxo-store-node-editor-dialog/taxo-store-node-editor-dialog';
import { TaxoStoreNodeFilter } from '../taxo-store-node-filter/taxo-store-node-filter';
import { TaxoStoreEditor } from './taxo-store-editor';

/**
 * A minimal in-memory fake of TaxoStoreService for a tree like:
 * - a (1)
 *   - a.x (3)
 *   - a.y (4)
 * - b (2)
 */
class FakeTaxoStoreService {
  public nodes: TaxoStoreNode[] = [];
  public flat = false;

  constructor() {
    this.resetData();
  }

  public resetData(): void {
    this.nodes = [
      {
        id: 1,
        treeId: 't',
        key: 'a',
        label: 'A',
        filteredLabel: 'a',
        features: [{ name: 'color', value: 'red' }, { name: 'obsolete' }],
      },
      { id: 2, treeId: 't', key: 'b', label: 'B', filteredLabel: 'b' },
      { id: 3, parentId: 1, treeId: 't', key: 'a.x', label: 'AX', filteredLabel: 'ax' },
      { id: 4, parentId: 1, treeId: 't', key: 'a.y', label: 'AY', filteredLabel: 'ay' },
    ];
  }

  private siblings(parentId?: number, treeId?: string): TaxoStoreNode[] {
    return this.nodes
      .filter((n) => n.parentId === parentId && (!treeId || n.treeId === treeId))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  private depth(node: TaxoStoreNode): number {
    let y = 1;
    let n = node;
    while (n.parentId !== undefined) {
      n = this.nodes.find((p) => p.id === n.parentId)!;
      y++;
    }
    return y;
  }

  private positioned(node: TaxoStoreNode): TaxoStoreNode {
    const sibs = this.siblings(node.parentId, node.treeId);
    return {
      ...node,
      y: this.depth(node),
      x: sibs.indexOf(node) + 1,
      hasChildren: this.nodes.some((n) => n.parentId === node.id),
    };
  }

  private page(all: TaxoStoreNode[], pageNumber: number, pageSize: number) {
    const size = pageSize || all.length || 1;
    const items = all.slice((pageNumber - 1) * size, pageNumber * size);
    return of<DataPage<TaxoStoreNode>>({
      pageNumber,
      pageSize: size,
      pageCount: Math.ceil(all.length / size),
      total: all.length,
      items: items.map((n) => this.positioned(n)),
    });
  }

  public getTree = vi.fn((id: string): Observable<TaxoStoreTree | null> =>
    of({ id, name: id, flat: this.flat }),
  );

  public getRootNodes = vi.fn((treeId: string, options: PagingOptions) =>
    this.page(this.siblings(undefined, treeId), options.pageNumber, options.pageSize),
  );

  public getNodes = vi.fn((filter: ApiNodeFilter) => {
    let all = filter.isRoot
      ? this.siblings(undefined, filter.treeId)
      : this.siblings(filter.parentId, filter.treeId);
    if (filter.filteredLabel) {
      all = all.filter((n) => n.filteredLabel.includes(filter.filteredLabel!));
    }
    return this.page(all, filter.pageNumber, filter.pageSize);
  });

  public getNode = vi.fn((id: number, _includeMappings?: boolean, _includeFeatures?: boolean) =>
    of(this.nodes.find((n) => n.id === id) ?? null),
  );

  public addNode = vi.fn((node: TaxoStoreNode): Observable<number> => {
    if (node.id) {
      const i = this.nodes.findIndex((n) => n.id === node.id);
      this.nodes[i] = { ...node };
      return of(node.id);
    }
    const id = Math.max(...this.nodes.map((n) => n.id)) + 1;
    this.nodes.push({ ...node, id });
    return of(id);
  });

  public deleteNode = vi.fn((id: number) => {
    this.nodes = this.nodes.filter((n) => n.id !== id);
    return of(id);
  });

  public getNodePath = vi.fn((id: number, pageSize: number) => {
    const path: TaxoNodePathStep[] = [];
    let node = this.nodes.find((n) => n.id === id);
    while (node) {
      const index = this.siblings(node.parentId, node.treeId).indexOf(node);
      path.unshift({ nodeId: node.id, pageNumber: Math.floor(index / pageSize) + 1 });
      const parentId: number | undefined = node.parentId;
      node = parentId === undefined ? undefined : this.nodes.find((n) => n.id === parentId);
    }
    return of(path);
  });
}

describe('TaxoStoreEditor', () => {
  let fixture: ComponentFixture<TaxoStoreEditor>;
  let component: TaxoStoreEditor;
  let api: FakeTaxoStoreService;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let dialogResult: unknown;

  async function setup(inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(TaxoStoreEditor);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('treeId', 't');
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    // let the store promises chains complete and re-render
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
  }

  async function nodes(): Promise<readonly PagedTaxoStoreNode[]> {
    return firstValueFrom(component.nodes$!);
  }

  async function nodeIds(): Promise<number[]> {
    return (await nodes()).map((n) => n.id);
  }

  async function nodeById(id: number): Promise<PagedTaxoStoreNode> {
    return (await nodes()).find((n) => n.id === id)!;
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rowButtons(rowIndex: number): HTMLButtonElement[] {
    const row = el().querySelectorAll('.tree-node-row')[rowIndex];
    return Array.from(row.querySelectorAll('.node-actions button'));
  }

  function asTreeNode(n: PagedTaxoStoreNode): TaxoStoreTreeNode {
    return n;
  }

  function addButton(): HTMLButtonElement | null {
    return el().querySelector<HTMLButtonElement>('.top-toolbar button');
  }

  function editorDialogConfig(data: unknown): unknown {
    return { data, width: '720px', maxWidth: '95vw' };
  }

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    api = new FakeTaxoStoreService();
    dialogResult = undefined;
    dialog = {
      open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })),
    };
    await TestBed.configureTestingModule({
      imports: [TaxoStoreEditor],
      providers: [{ provide: TaxoStoreService, useValue: api }],
    })
      .overrideProvider(MatDialog, { useValue: dialog })
      .compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load root nodes', async () => {
    await setup();
    expect(await nodeIds()).toEqual([1, 2]);
    expect(api.getRootNodes).toHaveBeenCalledWith(
      't',
      { pageNumber: 1, pageSize: 20 },
      true,
      false,
      true,
    );
    expect(component.loading()).toBe(false);
    expect(el().querySelectorAll('.tree-node-row').length).toBe(2);
    expect(el().querySelector('[role=tree]')).toBeTruthy();
    expect(el().querySelector('.empty-message')).toBeNull();
  });

  it('should show empty message when no nodes', async () => {
    api.nodes = [];
    await setup();
    expect(el().querySelector('.empty-message')?.textContent).toContain('No nodes found');
  });

  it('should show progress bar while loading', async () => {
    await setup();
    component.loading.set(true);
    await fixture.whenStable();
    expect(el().querySelector('mat-progress-bar')).toBeTruthy();
  });

  it('should reload when tree ID changes', async () => {
    api.nodes.push({ id: 10, treeId: 'u', key: 'z', label: 'Z', filteredLabel: 'z' });
    await setup();
    expect(await nodeIds()).toEqual([1, 2]);
    fixture.componentRef.setInput('treeId', 'u');
    await settle();
    expect(await nodeIds()).toEqual([10]);
  });

  it('should reload with new page size', async () => {
    await setup({ pageSize: 1 });
    expect(await nodeIds()).toEqual([1]);
    fixture.componentRef.setInput('pageSize', 5);
    await settle();
    expect(await nodeIds()).toEqual([1, 2]);
  });

  it('should render all action buttons by default', async () => {
    await setup();
    // node 1 has children: no delete
    expect(rowButtons(0).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Pick this node',
      'Edit this node',
      'Add child node',
    ]);
    // node 2 is a leaf: delete
    expect(rowButtons(1).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Pick this node',
      'Edit this node',
      'Add child node',
      'Delete this node',
    ]);
    // a single button adds nodes at the root level
    expect(addButton()?.textContent).toContain('Add root node');
    // features: their count, with a summary
    const features = el().querySelectorAll('.node-features');
    expect(features.length).toBe(1);
    expect(features[0].textContent?.replace('sell', '').trim()).toBe('2');
    expect(features[0].getAttribute('aria-label')).toBe('Features: color=red; obsolete');
    expect(features[0].getAttribute('tabindex')).toBe('0');
  });

  it('should hide action buttons when disabled', async () => {
    await setup({ canPick: false, canEdit: false, canAdd: false, canDelete: false });
    expect(rowButtons(1).length).toBe(0);
    expect(addButton()).toBeNull();
  });

  it('should emit nodePick on pick', async () => {
    await setup();
    const picked: TaxoStoreTreeNode[] = [];
    component.nodePick.subscribe((n) => picked.push(n));
    rowButtons(0)[0].click();
    expect(picked.length).toBe(1);
    expect(picked[0].id).toBe(1);
    expect(picked[0].key).toBe('a');
  });

  it('should expand and collapse nodes', async () => {
    await setup();
    component.onToggleExpanded(await nodeById(1));
    await settle();
    expect(await nodeIds()).toEqual([1, 3, 4, 2]);
    expect((await nodeById(1)).expanded).toBe(true);
    expect(el().querySelector('.tree-node-row')?.getAttribute('aria-expanded')).toBe('true');

    component.onToggleExpanded(await nodeById(1));
    await settle();
    expect(await nodeIds()).toEqual([1, 2]);
    expect(component.loading()).toBe(false);
  });

  it('should change page of children', async () => {
    await setup({ pageSize: 1 });
    component.onToggleExpanded(await nodeById(1));
    await settle();
    expect(await nodeIds()).toEqual([1, 3]);
    const parent = await nodeById(1);
    // paging is shown for expanded node with more than 1 page
    expect(component.getPagingForNode(await nodes(), 0)).toEqual({
      pageNumber: 1,
      pageCount: 2,
      total: 2,
    });
    component.onPageChangeRequest({
      node: parent,
      paging: { pageNumber: 2, pageCount: 2, total: 2 },
    });
    await settle();
    expect(await nodeIds()).toEqual([1, 4]);
  });

  it('getPagingForNode should return undefined when not applicable', async () => {
    await setup();
    const list = await nodes();
    // not expanded
    expect(component.getPagingForNode(list, 0)).toBeUndefined();
    // last node
    expect(component.getPagingForNode(list, list.length - 1)).toBeUndefined();
    // expanded with a single page
    component.onToggleExpanded(await nodeById(1));
    await settle();
    expect(component.getPagingForNode(await nodes(), 0)).toBeUndefined();
    // expanded but last node
    const expandedLast = [{ ...list[1], expanded: true }] as PagedTaxoStoreNode[];
    expect(component.getPagingForNode(expandedLast, 0)).toBeUndefined();
  });

  it('should apply global filter', async () => {
    await setup();
    component.onFilterChange({ label: 'b' });
    await settle();
    expect(await nodeIds()).toEqual([2]);
    component.onFilterChange(null);
    await settle();
    expect(await nodeIds()).toEqual([1, 2]);
  });

  it('should reset', async () => {
    await setup();
    api.nodes.push({ id: 9, treeId: 't', key: 'c', label: 'C', filteredLabel: 'c' });
    el().querySelector<HTMLButtonElement>('.toolbar button')!.click();
    await settle();
    expect(await nodeIds()).toEqual([1, 2, 9]);
  });

  it('should open node filter dialog and set node filter', async () => {
    await setup();
    const setNodeFilter = vi.spyOn(PagedTreeStore.prototype, 'setNodeFilter');
    const node = await nodeById(1);
    dialogResult = { label: 'x' };
    component.onEditFilterRequest(node);
    expect(dialog.open).toHaveBeenCalledWith(TaxoStoreNodeFilter, {
      data: { filter: undefined },
    });
    expect(setNodeFilter).toHaveBeenCalledWith(1, { label: 'x' });
  });

  it('should not set node filter when dialog is dismissed', async () => {
    await setup();
    const setNodeFilter = vi.spyOn(PagedTreeStore.prototype, 'setNodeFilter');
    dialogResult = undefined;
    component.onEditFilterRequest(await nodeById(1));
    expect(setNodeFilter).not.toHaveBeenCalled();
  });

  it('should edit a node', async () => {
    await setup();
    const original = { ...api.nodes[1] };
    dialogResult = { node: { ...original, label: 'B2' } };
    await component.editNode(asTreeNode(await nodeById(2)));
    await settle();
    // the node is got with its mappings and features, which are always arrays
    expect(api.getNode).toHaveBeenCalledWith(2, true, true);
    expect(dialog.open).toHaveBeenCalledWith(
      TaxoStoreNodeEditorDialog,
      editorDialogConfig({ node: { ...original, mappings: [], features: [] }, treeId: 't' }),
    );
    expect(api.addNode).toHaveBeenCalled();
    expect((await nodeById(2)).label).toBe('B2');
    expect(component.loading()).toBe(false);
  });

  it('should not edit a node not found', async () => {
    await setup();
    await component.editNode({ ...asTreeNode(await nodeById(2)), id: 99 });
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('should not save an edited node when dialog is cancelled', async () => {
    await setup();
    await component.editNode(asTreeNode(await nodeById(2)));
    expect(dialog.open).toHaveBeenCalled();
    expect(api.addNode).not.toHaveBeenCalled();
  });

  it('should add a child node and navigate to it', async () => {
    await setup();
    dialogResult = {
      node: { id: 0, parentId: 1, treeId: 't', key: 'a.z', label: 'AZ', filteredLabel: 'az' },
    };
    await component.addChildNode(asTreeNode(await nodeById(1)));
    await settle();
    expect(dialog.open).toHaveBeenCalledWith(
      TaxoStoreNodeEditorDialog,
      editorDialogConfig({ treeId: 't', parentId: 1 }),
    );
    expect(api.getNodePath).toHaveBeenCalledWith(5, 20);
    expect(await nodeIds()).toEqual([1, 3, 4, 5, 2]);
    expect(component.loading()).toBe(false);
  });

  it('should navigate to a new child on a later page', async () => {
    await setup({ pageSize: 2 });
    dialogResult = {
      node: { id: 0, parentId: 1, treeId: 't', key: 'a.z', label: 'AZ', filteredLabel: 'az' },
    };
    await component.addChildNode(asTreeNode(await nodeById(1)));
    await settle();
    expect(await nodeIds()).toEqual([1, 5, 2]);
  });

  it('should not add a child node when dialog is cancelled', async () => {
    await setup();
    await component.addChildNode(asTreeNode(await nodeById(1)));
    expect(api.addNode).not.toHaveBeenCalled();
  });

  it('should add a root node and navigate to it', async () => {
    await setup();
    dialogResult = {
      node: { id: 0, treeId: 't', key: 'c', label: 'C', filteredLabel: 'c' },
    };
    addButton()!.click();
    await settle();
    expect(dialog.open).toHaveBeenCalledWith(
      TaxoStoreNodeEditorDialog,
      editorDialogConfig({ treeId: 't' }),
    );
    expect(await nodeIds()).toEqual([1, 2, 5]);
  });

  it('should not add a root node when dialog is cancelled', async () => {
    await setup();
    await component.addRootNode();
    expect(api.addNode).not.toHaveBeenCalled();
  });

  it('should fall back to ensureNodeVisible for roots beyond page 1', async () => {
    await setup({ pageSize: 1 });
    const ensure = vi.spyOn(PagedTreeStore.prototype, 'ensureNodeVisible').mockResolvedValue(true);
    dialogResult = { node: { id: 0, treeId: 't', key: 'c', label: 'C', filteredLabel: 'c' } };
    await component.addRootNode();
    expect(ensure).toHaveBeenCalledWith(5, undefined, false);
  });

  it('should just reset when the navigated node is not found', async () => {
    await setup();
    api.getNodePath.mockReturnValueOnce(of([]));
    dialogResult = { node: { ...api.nodes[1] } };
    await component.editNode(asTreeNode(await nodeById(2)));
    await settle();
    expect(await nodeIds()).toEqual([1, 2]);
  });

  it('should reset loading when saving fails', async () => {
    await setup();
    api.addNode.mockImplementationOnce(() => {
      throw new Error('fail');
    });
    dialogResult = { node: { ...api.nodes[1] } };
    await expect(component.editNode(asTreeNode(await nodeById(2)))).rejects.toThrow('fail');
    expect(component.loading()).toBe(false);
  });

  it('should delete a node after confirmation and navigate to its sibling', async () => {
    await setup();
    component.onToggleExpanded(await nodeById(1));
    await settle();
    dialogResult = true;
    await component.deleteNode(asTreeNode(await nodeById(3)));
    await settle();
    expect(dialog.open.mock.calls[0][0]).toBe(ConfirmDialogComponent);
    expect(dialog.open.mock.calls[0][1].data.message).toContain('"AX"');
    expect(api.deleteNode).toHaveBeenCalledWith(3);
    expect(await nodeIds()).toEqual([1, 4, 2]);
  });

  it('should reset after deleting the only root node', async () => {
    api.nodes = [{ id: 1, treeId: 't', key: 'a', label: 'A', filteredLabel: 'a' }];
    await setup();
    dialogResult = true;
    rowButtons(0)[3].click();
    await settle();
    expect(api.deleteNode).toHaveBeenCalledWith(1);
    expect(await nodeIds()).toEqual([]);
  });

  it('should not delete a node when not confirmed', async () => {
    await setup();
    dialogResult = false;
    await component.deleteNode(asTreeNode(await nodeById(2)));
    expect(api.deleteNode).not.toHaveBeenCalled();
  });

  it('should open dialogs from buttons', async () => {
    await setup();
    const [, edit, addChild] = rowButtons(1);
    edit.click();
    addChild.click();
    addButton()!.click();
    await settle();
    expect(dialog.open).toHaveBeenCalledTimes(3);
  });

  it('should use the tree view when the tree is not found or fails', async () => {
    api.flat = true;
    api.getTree.mockReturnValueOnce(of(null));
    await setup();
    expect(component.flat()).toBe(false);
    expect(el().querySelector('[role=tree]')).toBeTruthy();

    api.getTree.mockReturnValueOnce(throwError(() => new Error('fail')));
    fixture.componentRef.setInput('pageSize', 5);
    await settle();
    expect(component.flat()).toBe(false);
    expect(await nodeIds()).toEqual([1, 2]);
  });

  describe('flat tree', () => {
    async function page() {
      return firstValueFrom(component.page$!);
    }

    async function pageIds(): Promise<number[]> {
      return (await page()).items.map((n) => n.id);
    }

    function listButtons(rowIndex: number): HTMLButtonElement[] {
      const row = el().querySelectorAll('.list-node-row')[rowIndex];
      return Array.from(row.querySelectorAll('.node-actions button'));
    }

    beforeEach(() => {
      api.flat = true;
      api.nodes = [
        {
          id: 1,
          treeId: 't',
          key: 'a',
          label: 'A',
          filteredLabel: 'a',
          features: [{ name: 'status', value: 'draft' }],
        },
        { id: 2, treeId: 't', key: 'c', label: 'C', filteredLabel: 'c' },
        { id: 3, treeId: 't', key: 'e', label: 'E', filteredLabel: 'e' },
      ];
    });

    it('should display nodes as a list', async () => {
      await setup();
      expect(component.flat()).toBe(true);
      expect(component.nodes$).toBeUndefined();
      expect(await pageIds()).toEqual([1, 2, 3]);
      expect(api.getRootNodes).toHaveBeenCalledWith(
        't',
        { pageNumber: 1, pageSize: 20 },
        false,
        false,
        true,
      );
      expect(el().querySelector('[role=tree]')).toBeNull();
      const rows = el().querySelectorAll('.list-node-row');
      expect(rows.length).toBe(3);
      expect(rows[0].querySelector('.node-key')?.textContent).toBe('a');
      expect(rows[0].querySelector('.node-label')?.textContent).toBe('A');
      expect(rows[0].querySelector('.node-features')?.getAttribute('aria-label')).toBe(
        'Features: status=draft',
      );
      expect(rows[1].querySelector('.node-features')).toBeNull();
      // a single page needs no pager
      expect(el().querySelector('pdb-compact-pager')).toBeNull();
      expect(component.loading()).toBe(false);
    });

    it('should not offer to add children', async () => {
      await setup();
      expect(listButtons(0).map((b) => b.getAttribute('aria-label'))).toEqual([
        'Pick this node',
        'Edit this node',
        'Delete this node',
      ]);
      expect(addButton()?.textContent).toContain('Add node');
    });

    it('should show empty message when no nodes', async () => {
      api.nodes = [];
      await setup();
      expect(el().querySelector('.list-nodes')).toBeNull();
      expect(el().querySelector('.empty-message')?.textContent).toContain('No nodes found');
    });

    it('should switch view when the tree changes', async () => {
      await setup();
      expect(el().querySelector('.list-nodes')).toBeTruthy();
      api.flat = false;
      fixture.componentRef.setInput('treeId', 'u');
      await settle();
      expect(component.flat()).toBe(false);
      expect(component.page$).toBeUndefined();
      expect(el().querySelector('.list-nodes')).toBeNull();
    });

    it('should page the list', async () => {
      await setup({ pageSize: 2 });
      expect(await pageIds()).toEqual([1, 2]);
      expect(el().querySelector('pdb-compact-pager')).toBeTruthy();
      component.onListPageChange({ pageNumber: 2 });
      await settle();
      expect(await pageIds()).toEqual([3]);
      expect(component.loading()).toBe(false);
    });

    it('should filter and reset the list', async () => {
      await setup();
      component.onFilterChange({ label: 'c' });
      await settle();
      expect(await pageIds()).toEqual([2]);
      expect(api.getNodes.mock.calls[0][0]).toMatchObject({
        treeId: 't',
        isRoot: true,
        filteredLabel: 'c',
      });
      component.reset();
      await settle();
      expect(await pageIds()).toEqual([1, 2, 3]);
    });

    it('should filter the list by features', async () => {
      await setup();
      component.onFilterChange({ features: [{ name: 'status', value: 'draft' }] });
      await settle();
      expect(api.getNodes.mock.calls[0][0]).toMatchObject({
        treeId: 't',
        isRoot: true,
        features: [{ name: 'status', value: 'draft' }],
        featureMatchMode: 'all',
        includeFeatures: true,
      });
    });

    it('should pick a node', async () => {
      await setup();
      const picked: TaxoStoreTreeNode[] = [];
      component.nodePick.subscribe((n) => picked.push(n));
      listButtons(1)[0].click();
      expect(picked.map((n) => n.key)).toEqual(['c']);
    });

    it('should add a node and move to its page', async () => {
      await setup({ pageSize: 2 });
      dialogResult = {
        node: { id: 0, treeId: 't', key: 'd', label: 'D', filteredLabel: 'd' },
      };
      addButton()!.click();
      await settle();
      expect(dialog.open).toHaveBeenCalledWith(
        TaxoStoreNodeEditorDialog,
        editorDialogConfig({ treeId: 't' }),
      );
      // a, c | d, e
      expect(api.getNodePath).toHaveBeenCalledWith(4, 2);
      expect(await pageIds()).toEqual([4, 3]);
      expect(component.hiliteId()).toBe(4);
      expect(el().querySelector('.list-node-row.hilite .node-key')?.textContent).toBe('d');
      expect(component.loading()).toBe(false);
    });

    it('should edit a node and refresh its page', async () => {
      await setup();
      dialogResult = { node: { ...api.nodes[1], label: 'C2' } };
      listButtons(1)[1].click();
      await settle();
      expect(api.getNode).toHaveBeenCalledWith(2, true, true);
      expect((await page()).items[1].label).toBe('C2');
      expect(component.hiliteId()).toBe(2);
    });

    it('should stay on the current page when saving a node in a filtered list', async () => {
      await setup();
      component.onFilterChange({ label: 'c' });
      await settle();
      dialogResult = {
        node: { id: 0, treeId: 't', key: 'cc', label: 'CC', filteredLabel: 'cc' },
      };
      await component.addRootNode();
      await settle();
      expect(api.getNodePath).not.toHaveBeenCalled();
      expect(await pageIds()).toEqual([2, 4]);
    });

    it('should stay on the current page when the saved node is not found', async () => {
      await setup({ pageSize: 2 });
      component.onListPageChange({ pageNumber: 2 });
      await settle();
      api.getNodePath.mockReturnValueOnce(of([]));
      dialogResult = { node: { ...api.nodes[2], label: 'E2' } };
      await component.editNode((await page()).items[0]);
      await settle();
      expect((await page()).pageNumber).toBe(2);
    });

    it('should delete a node and reload its page', async () => {
      await setup();
      dialogResult = true;
      listButtons(1)[2].click();
      await settle();
      expect(api.deleteNode).toHaveBeenCalledWith(2);
      expect(await pageIds()).toEqual([1, 3]);
      expect(component.loading()).toBe(false);
    });

    it('should move to the previous page after deleting the last node of a page', async () => {
      await setup({ pageSize: 2 });
      component.onListPageChange({ pageNumber: 2 });
      await settle();
      dialogResult = true;
      await component.deleteNode((await page()).items[0]);
      await settle();
      expect(await pageIds()).toEqual([1, 2]);
    });

    it('should not delete a node when not confirmed', async () => {
      await setup();
      dialogResult = false;
      await component.deleteNode((await page()).items[0]);
      expect(api.deleteNode).not.toHaveBeenCalled();
    });
  });
});
