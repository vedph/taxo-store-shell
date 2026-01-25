import { TestBed } from '@angular/core/testing';

import { TaxoStoreLookupService } from './taxo-store-lookup.service';

describe('TaxoStoreLookupService', () => {
  let service: TaxoStoreLookupService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TaxoStoreLookupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
