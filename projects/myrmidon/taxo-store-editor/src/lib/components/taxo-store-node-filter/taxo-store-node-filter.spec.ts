import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatChipInputEvent } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TaxoStoreNodeFeatureMatchMode } from '@myrmidon/taxo-store-api';

import { TaxoStoreNodeTreeFilter } from '../../services/taxo-store-paged-tree.service';
import { TaxoStoreNodeFilter, TaxoStoreNodeFilterDialogData } from './taxo-store-node-filter';

describe('TaxoStoreNodeFilter', () => {
  let fixture: ComponentFixture<TaxoStoreNodeFilter>;
  let component: TaxoStoreNodeFilter;

  function buttons(): HTMLButtonElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  }

  function chipEvent(value: string): MatChipInputEvent {
    return { value, chipInput: { clear: vi.fn() } } as unknown as MatChipInputEvent;
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
      expect(labels).toEqual(['label', 'features']);
      expect(el.querySelectorAll('[placeholder]').length).toBe(0);
    });

    it('should show the match mode only with features', async () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.mode-field')).toBeNull();
      component.addFeature(chipEvent('obsolete'));
      await fixture.whenStable();
      expect(el.querySelector('.mode-field mat-label')?.textContent?.trim()).toBe('match');
    });

    it('should have accessible names for buttons', () => {
      expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual([
        'Reset filter',
        'Apply filter',
      ]);
    });

    it('should update form when filter input changes', async () => {
      fixture.componentRef.setInput('filter', {
        label: 'cat',
        features: [{ name: 'a' }, { name: 'b', value: '1', partial: true }],
        featureMatchMode: TaxoStoreNodeFeatureMatchMode.Any,
      });
      await fixture.whenStable();
      expect(component.form.label().value()).toBe('cat');
      expect(component.form.features().value()).toEqual(['a', 'b~1']);
      expect(component.form.featureMatchMode().value()).toBe(TaxoStoreNodeFeatureMatchMode.Any);
      expect(component.form().dirty()).toBe(false);
      // features are shown as chips
      const chips = (fixture.nativeElement as HTMLElement).querySelectorAll('mat-chip-row');
      expect(Array.from(chips).map((c) => c.textContent?.replace('cancel', '').trim())).toEqual([
        'a',
        'b~1',
      ]);

      fixture.componentRef.setInput('filter', {});
      await fixture.whenStable();
      expect(component.form.label().value()).toBe('');
      expect(component.form.features().value()).toEqual([]);
      expect(component.form.featureMatchMode().value()).toBe(TaxoStoreNodeFeatureMatchMode.All);

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
      buttons()
        .find((b) => b.getAttribute('aria-label') === 'Apply filter')!
        .click();
      await fixture.whenStable();
      expect(component.filter()).toEqual({
        label: 'dog',
        features: undefined,
        featureMatchMode: undefined,
      });
      expect(emitted.length).toBe(1);
    });

    it('should add parsed and unique features and apply them', async () => {
      const event = chipEvent(' son ~ mar ');
      component.addFeature(event);
      expect(event.chipInput.clear).toHaveBeenCalled();
      component.addFeature(chipEvent('obsolete'));
      // duplicates and invalid criteria are ignored
      component.addFeature(chipEvent('obsolete'));
      component.addFeature(chipEvent('=x'));
      expect(component.form.features().value()).toEqual(['son~ mar', 'obsolete']);
      expect(component.form().dirty()).toBe(true);

      component.form.featureMatchMode().value.set(TaxoStoreNodeFeatureMatchMode.None);
      component.apply();
      expect(component.filter()).toEqual({
        label: undefined,
        features: [{ name: 'son', value: ' mar', partial: true }, { name: 'obsolete' }],
        featureMatchMode: TaxoStoreNodeFeatureMatchMode.None,
      });
    });

    it('should remove features', async () => {
      fixture.componentRef.setInput('filter', { features: [{ name: 'a' }, { name: 'b' }] });
      await fixture.whenStable();
      const remove = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'button[aria-label="Remove feature a"]',
      )!;
      remove.click();
      await fixture.whenStable();
      expect(component.form.features().value()).toEqual(['b']);
      expect(component.form().dirty()).toBe(true);
    });

    it('should apply on Enter in an empty features input', async () => {
      component.form.label().value.set('cat');
      component.addFeature(chipEvent(' '));
      await fixture.whenStable();
      expect(component.filter()).toEqual({
        label: 'cat',
        features: undefined,
        featureMatchMode: undefined,
      });
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

      buttons()
        .find((b) => b.getAttribute('aria-label') === 'Apply filter')!
        .click();
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
      expect(component.filter()).toEqual({ label: 'cat' });
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
      await setup({ filter: { label: 'bird', features: [{ name: 'f', value: '1' }] } });
      expect(component.wrapped).toBe(true);
      const form = (fixture.nativeElement as HTMLElement).querySelector('.filter')!;
      expect(form.classList.contains('wrapped')).toBe(true);
      expect(component.form.label().value()).toBe('bird');
      expect(component.form.features().value()).toEqual(['f=1']);
    });

    it('should start empty without data filter', async () => {
      await setup(null);
      expect(component.wrapped).toBe(true);
      expect(component.form.label().value()).toBe('');
    });

    it('should close with filter on apply', async () => {
      await setup({});
      component.form.label().value.set('x');
      component.addFeature(chipEvent('a=b'));
      component.apply();
      expect(dialogRef.close).toHaveBeenCalledWith({
        label: 'x',
        features: [{ name: 'a', value: 'b' }],
        featureMatchMode: TaxoStoreNodeFeatureMatchMode.All,
      });
    });

    it('should close with null on reset', async () => {
      await setup({ filter: { label: 'x' } });
      component.reset();
      expect(dialogRef.close).toHaveBeenCalledWith(null);
    });
  });
});
