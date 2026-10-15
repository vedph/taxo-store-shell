import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TaxoStoreEditorPage } from './taxo-store-editor-page';

describe('TaxoStoreEditorPage', () => {
  let component: TaxoStoreEditorPage;
  let fixture: ComponentFixture<TaxoStoreEditorPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaxoStoreEditorPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TaxoStoreEditorPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function loadButton(): HTMLButtonElement {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.textContent?.includes('load tree'))!;
  }

  async function flushTrees(): Promise<void> {
    const trees = [
      { id: 'animals', name: 'Animals' },
      { id: 'plants', name: 'Plants' },
    ];
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('trees'))
      .flush({ pageNumber: 1, pageSize: 100, pageCount: 1, total: 2, items: trees });
    // the trees are set after the awaited request, in a later task
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
  }

  it('should load the default tree', async () => {
    await flushTrees();
    // with trees available, the tree ID is picked from a select
    expect((fixture.nativeElement as HTMLElement).querySelector('mat-select')).toBeTruthy();
    expect(component.treeForm.treeId().value()).toBe('animals');
    loadButton().click();
    expect(component.selectedTreeId()).toBe('animals');
  });

  it('should require a tree ID', async () => {
    component.treeForm.treeId().value.set('');
    component.treeForm.treeId().markAsTouched();
    await fixture.whenStable();
    expect(loadButton().disabled).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('mat-error')?.textContent).toContain(
      'Tree ID is required',
    );
    component.selectTree();
    expect(component.selectedTreeId()).toBeNull();
  });

  it('should restore the default tree ID on clear', async () => {
    component.treeForm.treeId().value.set('plants');
    component.selectTree();
    expect(component.selectedTreeId()).toBe('plants');
    component.clearSelection();
    expect(component.selectedTreeId()).toBeNull();
    expect(component.treeForm.treeId().value()).toBe('animals');
    expect(component.treeForm().dirty()).toBe(false);
  });
});
