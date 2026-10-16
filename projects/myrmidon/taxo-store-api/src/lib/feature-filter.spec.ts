import { formatTaxoFeatureFilter, parseTaxoFeatureFilter } from './feature-filter';

describe('parseTaxoFeatureFilter', () => {
  it('should return null for empty text or no name', () => {
    expect(parseTaxoFeatureFilter(undefined)).toBeNull();
    expect(parseTaxoFeatureFilter(null)).toBeNull();
    expect(parseTaxoFeatureFilter('  ')).toBeNull();
    expect(parseTaxoFeatureFilter('=x')).toBeNull();
    expect(parseTaxoFeatureFilter(' ~x')).toBeNull();
  });

  it('should parse a name only', () => {
    expect(parseTaxoFeatureFilter(' obsolete ')).toEqual({ name: 'obsolete' });
  });

  it('should parse an exact value', () => {
    expect(parseTaxoFeatureFilter('status=draft')).toEqual({ name: 'status', value: 'draft' });
    expect(parseTaxoFeatureFilter('status=')).toEqual({ name: 'status', value: '' });
  });

  it('should parse a partial value', () => {
    expect(parseTaxoFeatureFilter('son ~ mar')).toEqual({
      name: 'son',
      value: ' mar',
      partial: true,
    });
    // an empty partial value is an exact empty value
    expect(parseTaxoFeatureFilter('son~')).toEqual({ name: 'son', value: '' });
  });

  it('should split at the first = or ~', () => {
    expect(parseTaxoFeatureFilter('a~b=c')).toEqual({ name: 'a', value: 'b=c', partial: true });
    expect(parseTaxoFeatureFilter('a=b~c')).toEqual({ name: 'a', value: 'b~c' });
  });
});

describe('formatTaxoFeatureFilter', () => {
  it('should format all the variants', () => {
    expect(formatTaxoFeatureFilter({ name: 'a' })).toBe('a');
    expect(formatTaxoFeatureFilter({ name: 'a', value: null })).toBe('a');
    expect(formatTaxoFeatureFilter({ name: 'a', value: '1' })).toBe('a=1');
    expect(formatTaxoFeatureFilter({ name: 'a', value: '1', partial: true })).toBe('a~1');
    expect(formatTaxoFeatureFilter({ name: 'a', value: '', partial: true })).toBe('a=');
  });

  it('should round-trip with parse', () => {
    for (const text of ['a', 'a=1', 'a~1', 'a=', 'a~b=c']) {
      expect(formatTaxoFeatureFilter(parseTaxoFeatureFilter(text)!)).toBe(text);
    }
  });
});
