import { TestBed } from '@angular/core/testing';

import { StripeService } from './stripe.service';
import { beforeEach, describe, it } from 'node:test';

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StripeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
function expect(service: StripeService) {
  return {
    toBeTruthy: () => {
      if (!service) {
        throw new Error('Expected service to be truthy, but it was falsy.');
      }
    }
  };
}

