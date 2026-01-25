import { TestBed } from '@angular/core/testing';

import { TaxoStoreService } from './taxo-store.service';

describe('TaxoStoreService', () => {
  let service: TaxoStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TaxoStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
