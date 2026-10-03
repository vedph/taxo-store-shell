import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  async function setup(data: ConfirmDialogData): Promise<HTMLElement> {
    dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function buttons(el: HTMLElement): HTMLButtonElement[] {
    return Array.from(el.querySelectorAll('button'));
  }

  it('should render title, message and default labels', async () => {
    const el = await setup({ title: 'Delete', message: 'Sure?' });
    expect(el.querySelector('h2')?.textContent).toContain('Delete');
    expect(el.querySelector('p')?.textContent).toContain('Sure?');
    const [cancel, confirm] = buttons(el);
    expect(cancel.textContent?.trim()).toBe('Cancel');
    expect(confirm.textContent?.trim()).toBe('Confirm');
  });

  it('should render custom labels', async () => {
    const el = await setup({ title: 'T', message: 'M', confirmLabel: 'Yes', cancelLabel: 'No' });
    const [cancel, confirm] = buttons(el);
    expect(cancel.textContent?.trim()).toBe('No');
    expect(confirm.textContent?.trim()).toBe('Yes');
  });

  it('should close with false on cancel', async () => {
    const el = await setup({ title: 'T', message: 'M' });
    buttons(el)[0].click();
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('should close with true on confirm', async () => {
    const el = await setup({ title: 'T', message: 'M' });
    buttons(el)[1].click();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
