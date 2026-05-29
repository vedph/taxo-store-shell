import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaxoStoreNodesPartComponentTs } from './taxo-store-nodes-part.component.js';

describe('TaxoStoreNodesPartComponentTs', () => {
  let component: TaxoStoreNodesPartComponentTs;
  let fixture: ComponentFixture<TaxoStoreNodesPartComponentTs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaxoStoreNodesPartComponentTs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaxoStoreNodesPartComponentTs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
