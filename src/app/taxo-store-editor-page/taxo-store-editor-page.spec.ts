import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreeStoreEditorPage } from './taxo-store-editor-page';

describe('TreeStoreEditorPage', () => {
  let component: TreeStoreEditorPage;
  let fixture: ComponentFixture<TreeStoreEditorPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeStoreEditorPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreeStoreEditorPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
