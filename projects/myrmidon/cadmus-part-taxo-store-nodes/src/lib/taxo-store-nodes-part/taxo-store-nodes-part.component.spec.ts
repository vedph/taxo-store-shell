import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';

import { AuthJwtService, User } from '@myrmidon/auth-jwt-login';
import { EditedObject, PartIdentity } from '@myrmidon/cadmus-core';
import { AppRepository } from '@myrmidon/cadmus-state';
import { DialogService } from '@myrmidon/ngx-mat-tools';
import { TaxoStoreNode } from '@myrmidon/taxo-store-api';
import { FlagOption, TaxoStorePicker } from '@myrmidon/taxo-store-picker';

import { TAXO_STORE_NODES_PART_TYPEID, TaxoStoreNodesPart } from '../taxo-store-nodes-part';
import { TaxoStoreNodesPartComponent } from './taxo-store-nodes-part.component';

@Component({
  selector: 'ts-taxo-store-picker',
  template: '',
})
class StubPicker {
  public readonly treeId = input<string | null>(null);
  public readonly hasTopNodeFilter = input<boolean>(true);
  public readonly hasFlagsFilter = input<boolean>(true);
  public readonly availableFlags = input<FlagOption[]>([]);
  public readonly canEdit = input(true);
  public readonly canAdd = input(true);
  public readonly canDelete = input(true);
  public readonly hideLoc = input(false);
  public readonly hideFilter = input(false);
  public readonly label = input<string>('node');
  public readonly nodePick = output<TaxoStoreNode | null>();
}

function makeNode(key: string, label = key.toUpperCase()): TaxoStoreNode {
  return { id: 1, treeId: 'animals', key, label, filteredLabel: label };
}

function makePart(props: Partial<TaxoStoreNodesPart> = {}): TaxoStoreNodesPart {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    itemId: '00000000-0000-0000-0000-000000000002',
    typeId: TAXO_STORE_NODES_PART_TYPEID,
    roleId: 'animals',
    timeCreated: new Date(),
    creatorId: 'zeus',
    timeModified: new Date(),
    userId: 'zeus',
    treeId: 'animals',
    nodeIds: [
      { name: 'A', value: 'a' },
      { name: 'B', value: 'b' },
      { name: 'C', value: 'c' },
    ],
    ...props,
  };
}

describe('TaxoStoreNodesPartComponent', () => {
  let fixture: ComponentFixture<TaxoStoreNodesPartComponent>;
  let component: TaxoStoreNodesPartComponent;
  let confirm$: Subject<boolean | undefined>;
  let dialog: { confirm: ReturnType<typeof vi.fn> };
  let settings: unknown;
  let appRepository: {
    getSettingFor: ReturnType<typeof vi.fn>;
    getTypeThesaurus: () => undefined;
  };
  let user$: BehaviorSubject<User | null>;

  const identity: PartIdentity = {
    itemId: '00000000-0000-0000-0000-000000000002',
    typeId: TAXO_STORE_NODES_PART_TYPEID,
    partId: null,
    roleId: 'animals',
  };

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    confirm$ = new Subject<boolean | undefined>();
    dialog = { confirm: vi.fn((): Observable<boolean | undefined> => confirm$) };
    settings = undefined;
    appRepository = {
      getSettingFor: vi.fn(() => Promise.resolve(settings)),
      getTypeThesaurus: () => undefined,
    };
    user$ = new BehaviorSubject<User | null>({
      userName: 'zeus',
      email: 'zeus@x.org',
      roles: ['admin'],
      emailConfirmed: true,
      firstName: 'Zeus',
      lastName: 'Olympian',
    } as User);

    await TestBed.configureTestingModule({
      imports: [TaxoStoreNodesPartComponent],
      providers: [
        {
          provide: AuthJwtService,
          useValue: {
            get currentUserValue() {
              return user$.value;
            },
            currentUser$: user$.asObservable(),
          },
        },
        { provide: AppRepository, useValue: appRepository },
        { provide: DialogService, useValue: dialog },
      ],
    })
      .overrideComponent(TaxoStoreNodesPartComponent, {
        remove: { imports: [TaxoStorePicker] },
        add: { imports: [StubPicker] },
      })
      .compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setup(
    part?: TaxoStoreNodesPart | null,
    id: PartIdentity | undefined = identity,
  ): Promise<void> {
    fixture = TestBed.createComponent(TaxoStoreNodesPartComponent);
    component = fixture.componentInstance;
    if (id) {
      fixture.componentRef.setInput('identity', id);
    }
    if (part !== undefined) {
      fixture.componentRef.setInput('data', {
        value: part,
        thesauri: {},
      } as EditedObject<TaxoStoreNodesPart>);
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

  function rows(): string[][] {
    return Array.from(el().querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td'))
        .slice(1)
        .map((td) => td.textContent?.trim() ?? ''),
    );
  }

  function picker(): StubPicker {
    return fixture.debugElement.query((d) => d.componentInstance instanceof StubPicker)
      .componentInstance as StubPicker;
  }

  it('should load part', async () => {
    await setup(makePart());
    expect(component.treeId()).toBe('animals');
    expect(component.nodeIds.value.map((e) => e.value)).toEqual(['a', 'b', 'c']);
    expect(component.form.pristine).toBe(true);
    expect(rows()).toEqual([
      ['A', 'a'],
      ['B', 'b'],
      ['C', 'c'],
    ]);
    expect(picker().treeId()).toBe('animals');
  });

  it('should use role ID when part has no tree ID', async () => {
    await setup(makePart({ treeId: '', roleId: 'food' }));
    expect(component.treeId()).toBe('food');
  });

  it('should use identity role ID for a new part', async () => {
    await setup(null);
    expect(component.treeId()).toBe('animals');
    expect(picker().treeId()).toBe('animals');
    expect(component.nodeIds.value).toEqual([]);
    expect(el().querySelector('table')).toBeNull();
  });

  it('should have no tree without data and role', async () => {
    await setup(undefined, { ...identity, roleId: null });
    expect(component.treeId()).toBe('');
  });

  it('should reset when data is cleared', async () => {
    await setup(makePart());
    fixture.componentRef.setInput('data', undefined);
    await settle();
    expect(component.nodeIds.value).toEqual([]);
    expect(rows()).toEqual([]);
  });

  it('should show default title', async () => {
    await setup(makePart());
    expect(el().querySelector('mat-card-title')?.textContent?.trim()).toBeTruthy();
  });

  it('should load settings for role', async () => {
    settings = {
      hasTopNodeFilter: false,
      hasFlagsFilter: false,
      availableFlags: [{ id: 'x', name: 'ex' }],
      canEdit: false,
      canAdd: false,
      canDelete: false,
      hideLoc: true,
      hideFilter: true,
      label: 'taxon',
    };
    await setup(makePart());
    expect(appRepository.getSettingFor).toHaveBeenCalledWith(
      TAXO_STORE_NODES_PART_TYPEID,
      'animals',
    );
    expect(component.settings()).toEqual(settings);
    const p = picker();
    expect(p.hasTopNodeFilter()).toBe(false);
    expect(p.hasFlagsFilter()).toBe(false);
    expect(p.availableFlags()).toEqual([{ id: 'x', name: 'ex' }]);
    expect(p.canEdit()).toBe(false);
    expect(p.canAdd()).toBe(false);
    expect(p.canDelete()).toBe(false);
    expect(p.hideLoc()).toBe(true);
    expect(p.hideFilter()).toBe(true);
    expect(p.label()).toBe('taxon');
  });

  it('should keep default settings when none are found', async () => {
    await setup(makePart());
    expect(component.settings()).toEqual({
      hasTopNodeFilter: true,
      hasFlagsFilter: true,
      canEdit: true,
      canAdd: true,
      canDelete: true,
    });
    const p = picker();
    expect(p.availableFlags()).toEqual([]);
    expect(p.hideLoc()).toBe(false);
    expect(p.hideFilter()).toBe(false);
    expect(p.label()).toBe('node');
  });

  it('should map empty settings to false', async () => {
    settings = {};
    await setup(makePart());
    const p = picker();
    expect(p.hasTopNodeFilter()).toBe(false);
    expect(p.canEdit()).toBe(false);
  });

  it('should add picked node', async () => {
    await setup(makePart({ nodeIds: [] }));
    expect(component.form.invalid).toBe(true);
    picker().nodePick.emit(makeNode('d', 'Dog'));
    await settle();
    expect(component.nodeIds.value).toEqual([{ name: 'Dog', value: 'd' }]);
    expect(component.nodeIds.dirty).toBe(true);
    expect(component.form.valid).toBe(true);
    expect(rows()).toEqual([['Dog', 'd']]);
  });

  it('should use key as name when node has no label', async () => {
    await setup(makePart({ nodeIds: [] }));
    component.addNodeId({ ...makeNode('d'), label: '' });
    expect(component.nodeIds.value).toEqual([{ name: 'd', value: 'd' }]);
  });

  it('should not add null or duplicate node', async () => {
    await setup(makePart());
    component.addNodeId(null);
    component.addNodeId(makeNode('a'));
    expect(component.nodeIds.value.length).toBe(3);
    expect(component.nodeIds.dirty).toBe(false);
  });

  it('should move node up', async () => {
    await setup(makePart());
    const buttons = el().querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Move this node up"]',
    );
    expect(buttons[0].disabled).toBe(true);
    buttons[1].click();
    await settle();
    expect(rows().map((r) => r[1])).toEqual(['b', 'a', 'c']);
    expect(component.nodeIds.dirty).toBe(true);
    // no-op on first
    component.moveNodeIdUp(0);
    expect(component.nodeIds.value.map((e) => e.value)).toEqual(['b', 'a', 'c']);
  });

  it('should move node down', async () => {
    await setup(makePart());
    const buttons = el().querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Move this node down"]',
    );
    expect(buttons[2].disabled).toBe(true);
    buttons[0].click();
    await settle();
    expect(rows().map((r) => r[1])).toEqual(['b', 'a', 'c']);
    // no-op on last
    component.moveNodeIdDown(2);
    expect(component.nodeIds.value.map((e) => e.value)).toEqual(['b', 'a', 'c']);
  });

  it('should delete node after confirmation', async () => {
    await setup(makePart());
    el().querySelectorAll<HTMLButtonElement>('button[aria-label="Delete this node"]')[1].click();
    expect(dialog.confirm).toHaveBeenCalledWith('Confirmation', 'Delete node?');
    // confirmation arrives asynchronously, outside of any template event
    confirm$.next(true);
    await settle();
    expect(component.nodeIds.value.map((e) => e.value)).toEqual(['a', 'c']);
    expect(component.nodeIds.dirty).toBe(true);
    expect(rows().map((r) => r[1])).toEqual(['a', 'c']);
  });

  it('should not delete node without confirmation', async () => {
    await setup(makePart());
    component.deleteNodeId(0);
    confirm$.next(false);
    confirm$.next(undefined);
    await settle();
    expect(component.nodeIds.value.length).toBe(3);
  });

  it('should save part', async () => {
    await setup(makePart({ nodeIds: [] }));
    const saved: (EditedObject<TaxoStoreNodesPart> | undefined)[] = [];
    component.data.subscribe((d) => saved.push(d));
    component.addNodeId(makeNode('x', 'X'));
    component.save();
    expect(saved.length).toBe(1);
    expect(saved[0]!.value!.treeId).toBe('animals');
    expect(saved[0]!.value!.nodeIds).toEqual([{ name: 'X', value: 'x' }]);
    expect(component.form.pristine).toBe(true);
  });

  it('should save a new part with identity tree', async () => {
    await setup(null);
    const saved: (EditedObject<TaxoStoreNodesPart> | undefined)[] = [];
    component.data.subscribe((d) => saved.push(d));
    component.addNodeId(makeNode('x', 'X'));
    component.save();
    const part = saved[0]!.value!;
    expect(part.typeId).toBe(TAXO_STORE_NODES_PART_TYPEID);
    expect(part.roleId).toBe('animals');
    expect(part.treeId).toBe('animals');
    expect(part.nodeIds).toEqual([{ name: 'X', value: 'x' }]);
  });

  it('should not save invalid part', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await setup(makePart({ nodeIds: [] }));
    const saved: unknown[] = [];
    component.data.subscribe((d) => saved.push(d));
    component.save();
    expect(saved).toEqual([]);
  });

  it('should emit dirty change', async () => {
    await setup(makePart());
    const dirty: boolean[] = [];
    component.dirtyChange.subscribe((d) => dirty.push(d));
    component.addNodeId(makeNode('z'));
    expect(dirty).toEqual([true]);
  });

  it('should emit close', async () => {
    await setup(makePart());
    let closed = false;
    component.editorClose.subscribe(() => (closed = true));
    component.close();
    expect(closed).toBe(true);
  });
});
