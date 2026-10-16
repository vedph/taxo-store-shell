import { filterTaxoFeatureValue, filterTaxoLabel } from './label-filter';

describe('filterTaxoLabel', () => {
  it('should return empty for empty input', () => {
    expect(filterTaxoLabel(undefined)).toBe('');
    expect(filterTaxoLabel(null)).toBe('');
    expect(filterTaxoLabel('')).toBe('');
  });

  it('should remove diacritics and lowercase', () => {
    expect(filterTaxoLabel("Federico II d'Angiò")).toBe('federico ii dangio');
    expect(filterTaxoLabel('Pitàgora di Samo')).toBe('pitagora di samo');
    expect(filterTaxoLabel('ÆSCHYLUS Ἀριστοτέλης')).toBe('æschylus αριστοτελης');
  });

  it('should keep only letters, whitespace and some punctuation', () => {
    expect(filterTaxoLabel('Aristotle, 384-322 BC')).toBe('aristotle, - bc');
    expect(filterTaxoLabel('a-b_c/d.e,f:g;h')).toBe('a-b_c/d.e,f:g;h');
    expect(filterTaxoLabel('red (color)!')).toBe('red color');
    expect(filterTaxoLabel('C#')).toBe('c');
  });

  it('should normalize whitespace into spaces and trim', () => {
    expect(filterTaxoLabel('  a\tb\nc  ')).toBe('a b c');
    // spaces are not collapsed
    expect(filterTaxoLabel('a  b')).toBe('a  b');
  });

  it('should drop non-letter characters only', () => {
    expect(filterTaxoLabel('123')).toBe('');
  });
});

describe('filterTaxoFeatureValue', () => {
  it('should return empty for empty input', () => {
    expect(filterTaxoFeatureValue(undefined)).toBe('');
    expect(filterTaxoFeatureValue(null)).toBe('');
    expect(filterTaxoFeatureValue('')).toBe('');
  });

  it('should filter like labels but keep digits', () => {
    expect(filterTaxoFeatureValue('Aristotle, 384-322 BC')).toBe('aristotle, 384-322 bc');
    expect(filterTaxoFeatureValue(' Città #1 ')).toBe('citta 1');
    expect(filterTaxoFeatureValue('123')).toBe('123');
    expect(filterTaxoFeatureValue('!?')).toBe('');
  });
});
