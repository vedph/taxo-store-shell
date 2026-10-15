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
      const form = (fixture.nativeElement as HTMLElement).querySelector('.filter')!;
      expect(form.classList.contains('wrapped')).toBe(false);
    });

    it('should label every field with mat-label', () => {
      const el = fixture.nativeElement as HTMLElement;
      const labels = Array.from(el.querySelectorAll('mat-form-field')).map((f) =>
        f.querySelector('mat-label')?.textContent?.trim(),
      );
      expect(labels).toEqual(['label', 'flags']);
      expect(el.querySelectorAll('[placeholder]').length).toBe(0);
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
      expect(component.form.label().value()).toBe('cat');
      expect(component.form.flags().value()).toBe('x');
      expect(component.form().dirty()).toBe(false);

      fixture.componentRef.setInput('filter', {});
      await fixture.whenStable();
      expect(component.form.label().value()).toBe('');
      expect(component.form.flags().value()).toBe('');

      fixture.componentRef.setInput('filter', { label: 'x' });
      await fixture.whenStable();
      fixture.componentRef.setInput('filter', null);
      await fixture.whenStable();
      expect(component.form.label().value()).toBe('');
    });

    it('should apply trimmed filter on submit', async () => {
      const emitted: (TaxoStoreNodeTreeFilter | null | undefined)[] = [];
      component.filter.subscribe((f) => emitted.push(f));
      component.form.label().value.set(' dog ');
      component.form.flags().value.set(' ');
      buttons()[1].click();
      await fixture.whenStable();
      expect(component.filter()).toEqual({ label: 'dog', flags: undefined });
      expect(emitted).toEqual([{ label: 'dog', flags: undefined }]);
    });

    it('should not render a form element', () => {
      expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
      expect(buttons().every((b) => b.type === 'button')).toBe(true);
    });

    it('should be dirty after typing and pristine once applied', async () => {
      const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
      input.value = ' dog ';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(component.form().dirty()).toBe(true);

      buttons()[1].click();
      await fixture.whenStable();
      // the applied filter is shown normalized, as it is now in sync
      expect(component.form.label().value()).toBe('dog');
      expect(component.form().dirty()).toBe(false);
    });

    it('should apply on Enter', async () => {
      const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
      input.value = 'cat';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await fixture.whenStable();
      expect(component.filter()).toEqual({ label: 'cat', flags: undefined });
    });

    it('should clear typed values on reset when filter is already null', async () => {
      fixture.componentRef.setInput('filter', null);
      await fixture.whenStable();
      component.form.label().value.set('typed');
      buttons()[0].click();
      await fixture.whenStable();
      expect(component.filter()).toBeNull();
      expect(component.form.label().value()).toBe('');
    });

    it('should reset filter', async () => {
      fixture.componentRef.setInput('filter', { label: 'cat' });
      await fixture.whenStable();
      buttons()[0].click();
      await fixture.whenStable();
      expect(component.filter()).toBeNull();
      expect(component.form.label().value()).toBe('');
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
      const form = (fixture.nativeElement as HTMLElement).querySelector('.filter')!;
      expect(form.classList.contains('wrapped')).toBe(true);
      expect(component.form.label().value()).toBe('bird');
      expect(component.form.flags().value()).toBe('f');
    });

    it('should start empty without data filter', async () => {
      await setup(null);
      expect(component.wrapped).toBe(true);
      expect(component.form.label().value()).toBe('');
    });

    it('should close with filter on apply', async () => {
      await setup({});
      component.form.label().value.set('x');
      component.form.flags().value.set('ab');
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
