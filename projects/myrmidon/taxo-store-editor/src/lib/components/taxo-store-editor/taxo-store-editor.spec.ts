import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaxoStoreEditor } from './taxo-store-editor';

describe('TreeStoreEditor', () => {
  let component: TaxoStoreEditor;
  let fixture: ComponentFixture<TaxoStoreEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaxoStoreEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaxoStoreEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
