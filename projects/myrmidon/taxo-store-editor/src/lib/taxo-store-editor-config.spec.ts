import { generateTaxoKey } from './taxo-store-editor-config';

describe('generateTaxoKey', () => {
  it('should return empty for empty or blank label', () => {
    expect(generateTaxoKey('')).toBe('');
    expect(generateTaxoKey('   ')).toBe('');
  });

  it('should lowercase and replace spaces with underscores', () => {
    expect(generateTaxoKey('Red Fox')).toBe('red_fox');
  });

  it('should trim the label', () => {
    expect(generateTaxoKey('  red fox ')).toBe('red_fox');
  });

  it('should replace any sequence of whitespaces with a single underscore', () => {
    expect(generateTaxoKey('a\tb  c \n d')).toBe('a_b_c_d');
  });

  it('should replace colons with dots', () => {
    expect(generateTaxoKey('animal:bird')).toBe('animal.bird');
  });

  it('should remove diacritics', () => {
    expect(generateTaxoKey('Città Ærøskøbing über')).toBe('citta_rskbing_uber');
  });

  it('should keep digits, underscores, dashes and dots', () => {
    expect(generateTaxoKey('x-1_y.2')).toBe('x-1_y.2');
  });

  it('should drop any other character', () => {
    expect(generateTaxoKey("Dante's (1265/1321)!")).toBe('dantes_12651321');
    expect(generateTaxoKey('ἀλφα straße')).toBe('_strae');
  });
});
