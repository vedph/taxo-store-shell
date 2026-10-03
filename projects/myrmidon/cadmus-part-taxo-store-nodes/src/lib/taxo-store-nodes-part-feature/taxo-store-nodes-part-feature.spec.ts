import { Component, input, model, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { ItemService, ThesaurusService } from '@myrmidon/cadmus-api';
import { EditedObject, PartIdentity } from '@myrmidon/cadmus-core';
import { CurrentItemBarComponent } from '@myrmidon/cadmus-item-editor';

// @myrmidon/cadmus-item-editor imports packages not installed in this workspace
// (e.g. @myrmidon/cadmus-ui-flag-set), so replace it with a stub module;
// its component is anyway replaced by StubItemBar below
vi.mock('@myrmidon/cadmus-item-editor', () => ({
  CurrentItemBarComponent: class CurrentItemBarComponent {},
}));
import { PartEditorService } from '@myrmidon/cadmus-state';

import { TAXO_STORE_NODES_PART_TYPEID, TaxoStoreNodesPart } from '../taxo-store-nodes-part';
import { TaxoStoreNodesPartComponent } from '../taxo-store-nodes-part/taxo-store-nodes-part.component';
import { TaxoStoreNodesPartFeature } from './taxo-store-nodes-part-feature';

@Component({ selector: 'cadmus-current-item-bar', template: '' })
class StubItemBar {}

@Component({ selector: 'cadmus-taxo-store-nodes-part', template: '' })
class StubPartEditor {
  public readonly identity = input<PartIdentity>();
  public readonly data = model<EditedObject<TaxoStoreNodesPart>>();
  public readonly editorClose = output();
  public readonly dirtyChange = output<boolean>();
}

describe('TaxoStoreNodesPartFeature', () => {
  let fixture: ComponentFixture<TaxoStoreNodesPartFeature>;
  let component: TaxoStoreNodesPartFeature;
  let editorService: {
    loading$: unknown;
    saving$: unknown;
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let snackbar: { open: ReturnType<typeof vi.fn> };

  const part: TaxoStoreNodesPart = {
    id: 'p1',
    itemId: 'i1',
    typeId: TAXO_STORE_NODES_PART_TYPEID,
    roleId: 'animals',
    timeCreated: new Date(),
    creatorId: 'zeus',
    timeModified: new Date(),
    userId: 'zeus',
    treeId: 'animals',
    nodeIds: [{ name: 'A', value: 'a' }],
  };

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    editorService = {
      loading$: of(false),
      saving$: of(false),
      load: vi.fn(() => Promise.resolve({ value: part, thesauri: {} })),
      save: vi.fn((p: TaxoStoreNodesPart) => Promise.resolve({ ...p, id: 'p2' })),
    };
    router = { navigate: vi.fn() };
    snackbar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TaxoStoreNodesPartFeature],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: { iid: 'i1', pid: 'new' },
              queryParams: { rid: 'animals' },
              routeConfig: { path: `${TAXO_STORE_NODES_PART_TYPEID}/:pid` },
            },
          },
        },
        { provide: Router, useValue: router },
        { provide: MatSnackBar, useValue: snackbar },
        { provide: ItemService, useValue: {} },
        { provide: ThesaurusService, useValue: {} },
        { provide: PartEditorService, useValue: editorService },
      ],
    })
      .overrideComponent(TaxoStoreNodesPartFeature, {
        remove: { imports: [CurrentItemBarComponent, TaxoStoreNodesPartComponent] },
        add: { imports: [StubItemBar, StubPartEditor] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TaxoStoreNodesPartFeature);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function editor(): StubPartEditor {
    return fixture.debugElement.query((d) => d.componentInstance instanceof StubPartEditor)
      .componentInstance as StubPartEditor;
  }

  it('should build identity from route', () => {
    expect(component.identity()).toEqual({
      itemId: 'i1',
      typeId: TAXO_STORE_NODES_PART_TYPEID,
      partId: null,
      roleId: 'animals',
    });
    expect(editorService.load).toHaveBeenCalledWith(component.identity(), []);
  });

  it('should pass identity and data to editor', () => {
    expect(fixture.nativeElement.querySelector('cadmus-current-item-bar')).toBeTruthy();
    expect(editor().identity()).toEqual(component.identity());
    expect(editor().data()).toEqual({ value: part, thesauri: {} });
  });

  it('should save data changed by editor', async () => {
    // setting a model from the child emits dataChange
    editor().data.set({ value: part, thesauri: {} });
    await fixture.whenStable();
    expect(editorService.save).toHaveBeenCalledWith(part);
    expect(component.identity().partId).toBe('p2');
    expect(snackbar.open).toHaveBeenCalledWith('Part saved', 'OK', { duration: 3000 });
  });

  it('should track dirty state from editor', () => {
    editor().dirtyChange.emit(true);
    expect(component.dirty()).toBe(true);
    expect(component.canDeactivate()).toBe(false);
    editor().dirtyChange.emit(false);
    expect(component.canDeactivate()).toBe(true);
  });

  it('should navigate to item on close', () => {
    editor().editorClose.emit();
    expect(router.navigate).toHaveBeenCalledWith(['items', 'i1']);
  });
});
