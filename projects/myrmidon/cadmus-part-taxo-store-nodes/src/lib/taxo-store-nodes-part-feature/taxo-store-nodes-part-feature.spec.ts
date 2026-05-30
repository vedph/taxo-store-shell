import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaxoStoreNodesPartFeature } from './taxo-store-nodes-part-feature';

describe('TaxoStoreNodesPartFeature', () => {
  let component: TaxoStoreNodesPartFeature;
  let fixture: ComponentFixture<TaxoStoreNodesPartFeature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaxoStoreNodesPartFeature]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaxoStoreNodesPartFeature);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
