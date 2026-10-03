import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TaxoStoreNodeTreeFilter } from '../../services/taxo-store-paged-tree.service';
import { TaxoStoreNodeFilter, TaxoStoreNodeFilterDialogData } from './taxo-store-node-filter';

describe('TaxoStoreNodeFilter', () => {
  let fixture: ComponentFixture<TaxoStoreNodeFilter>;
  let component: TaxoStoreNodeFilter;

  function buttons(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  }

  describe('standalone', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TaxoStoreNodeFilter],
      }).compileComponents();
      fixture = TestBed.createComponent(TaxoStoreNodeFilter);
      component = fixture.componentInstance;
      await fixture.whenStable();
    });

    it('should not be wrapped', () => {
      expect(component.wrapped).toBe(false);
      expect(component.dialogRef).toBeNull();
      const form = (fixture.nativeElement as HTMLElement).querySelector('form')!;
      expect(form.classList.contains('wrapped')).toBe(false);
    });

    it('should have accessible names for buttons', () => {
      expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual([
        'Reset filter',
        'Apply filter',
      ]);
    });

    it('should update form when filter input changes', async () => {
      fixture.componentRef.setInput('filter', { label: 'cat', flags: 'x' });
      await fixture.whenStable();
      expect(component.label.value).toBe('cat');
      expect(component.flags.value).toBe('x');
      expect(component.form.pristine).toBe(true);

      fixture.componentRef.setInput('filter', {});
      await fixture.whenStable();
      expect(component.label.value).toBe('');
      expect(component.flags.value).toBe('');

      fixture.componentRef.setInput('filter', { label: 'x' });
      await fixture.whenStable();
      fixture.componentRef.setInput('filter', null);
      await fixture.whenStable();
      expect(component.label.value).toBe('');
    });

    it('should apply trimmed filter on submit', async () => {
      const emitted: (TaxoStoreNodeTreeFilter | null | undefined)[] = [];
      component.filter.subscribe((f) => emitted.push(f));
      component.label.setValue(' dog ');
      component.flags.setValue(' ');
      buttons()[1].click();
      await fixture.whenStable();
      expect(component.filter()).toEqual({ label: 'dog', flags: undefined });
      expect(emitted).toEqual([{ label: 'dog', flags: undefined }]);
    });

    it('should reset filter', async () => {
      fixture.componentRef.setInput('filter', { label: 'cat' });
      await fixture.whenStable();
      buttons()[0].click();
      await fixture.whenStable();
      expect(component.filter()).toBeNull();
      expect(component.label.value).toBe('');
    });
  });

  describe('in dialog', () => {
    let dialogRef: { close: ReturnType<typeof vi.fn> };

    async function setup(data: TaxoStoreNodeFilterDialogData | null): Promise<void> {
      dialogRef = { close: vi.fn() };
      await TestBed.configureTestingModule({
        imports: [TaxoStoreNodeFilter],
        providers: [
          { provide: MatDialogRef, useValue: dialogRef },
          { provide: MAT_DIALOG_DATA, useValue: data },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(TaxoStoreNodeFilter);
      component = fixture.componentInstance;
      await fixture.whenStable();
    }

    it('should be wrapped and load filter from data', async () => {
      await setup({ filter: { label: 'bird', flags: 'f' } });
      expect(component.wrapped).toBe(true);
      const form = (fixture.nativeElement as HTMLElement).querySelector('form')!;
      expect(form.classList.contains('wrapped')).toBe(true);
      expect(component.label.value).toBe('bird');
      expect(component.flags.value).toBe('f');
    });

    it('should start empty without data filter', async () => {
      await setup(null);
      expect(component.wrapped).toBe(true);
      expect(component.label.value).toBe('');
    });

    it('should close with filter on apply', async () => {
      await setup({});
      component.label.setValue('x');
      component.flags.setValue('ab');
      component.apply();
      expect(dialogRef.close).toHaveBeenCalledWith({ label: 'x', flags: 'ab' });
    });

    it('should close with null on reset', async () => {
      await setup({ filter: { label: 'x' } });
      component.reset();
      expect(dialogRef.close).toHaveBeenCalledWith(null);
    });
  });
});
