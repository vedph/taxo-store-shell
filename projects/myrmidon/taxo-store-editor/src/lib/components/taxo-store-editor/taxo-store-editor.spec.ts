import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Observable, firstValueFrom, of } from 'rxjs';

import { DataPage, PagingOptions } from '@myrmidon/ngx-tools';
import { PagedTreeStore } from '@myrmidon/paged-data-browsers';
import {
  TaxoNodePathStep,
  TaxoStoreNode,
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

  constructor() {
    this.resetData();
  }

  public resetData(): void {
    this.nodes = [
      { id: 1, treeId: 't', key: 'a', label: 'A', filteredLabel: 'a', flags: 'f' },
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

  public getNode = vi.fn((id: number) => of(this.nodes.find((n) => n.id === id) ?? null));

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
    expect(api.getRootNodes).toHaveBeenCalledWith('t', { pageNumber: 1, pageSize: 20 }, true);
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
      'Add sibling node',
    ]);
    // node 2 is a leaf: delete
    expect(rowButtons(1).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Pick this node',
      'Edit this node',
      'Add child node',
      'Add sibling node',
      'Delete this node',
    ]);
    // flags
    expect(el().querySelector('.node-flags')?.textContent?.trim()).toBe('f');
  });

  it('should hide action buttons when disabled', async () => {
    await setup({ canPick: false, canEdit: false, canAdd: false, canDelete: false });
    expect(rowButtons(1).length).toBe(0);
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
    expect(dialog.open).toHaveBeenCalledWith(TaxoStoreNodeEditorDialog, {
      data: { node: original, treeId: 't' },
    });
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
    expect(dialog.open).toHaveBeenCalledWith(TaxoStoreNodeEditorDialog, {
      data: { treeId: 't', parentId: 1 },
    });
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

  it('should add a sibling node and navigate to it', async () => {
    await setup();
    dialogResult = {
      node: { id: 0, treeId: 't', key: 'c', label: 'C', filteredLabel: 'c' },
    };
    await component.addSiblingNode(asTreeNode(await nodeById(2)));
    await settle();
    expect(dialog.open).toHaveBeenCalledWith(TaxoStoreNodeEditorDialog, {
      data: { treeId: 't', parentId: undefined },
    });
    expect(await nodeIds()).toEqual([1, 2, 5]);
  });

  it('should not add a sibling node when dialog is cancelled', async () => {
    await setup();
    await component.addSiblingNode(asTreeNode(await nodeById(2)));
    expect(api.addNode).not.toHaveBeenCalled();
  });

  it('should fall back to ensureNodeVisible for roots beyond page 1', async () => {
    await setup({ pageSize: 1 });
    const ensure = vi.spyOn(PagedTreeStore.prototype, 'ensureNodeVisible').mockResolvedValue(true);
    dialogResult = { node: { id: 0, treeId: 't', key: 'c', label: 'C', filteredLabel: 'c' } };
    await component.addSiblingNode(asTreeNode(await nodeById(1)));
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
    rowButtons(0)[4].click();
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
    const [, edit, addChild, addSibling] = rowButtons(1);
    edit.click();
    addChild.click();
    addSibling.click();
    await settle();
    expect(dialog.open).toHaveBeenCalledTimes(3);
  });
});
