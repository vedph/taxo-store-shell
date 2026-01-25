import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

/**
 * Data passed to the confirm dialog.
 */
export interface ConfirmDialogData {
  /**
   * The dialog title.
   */
  title: string;

  /**
   * The confirmation message.
   */
  message: string;

  /**
   * The label for the confirm button. Default is "Confirm".
   */
  confirmLabel?: string;

  /**
   * The label for the cancel button. Default is "Cancel".
   */
  cancelLabel?: string;
}

/**
 * A simple confirmation dialog component.
 */
@Component({
  selector: 'ts-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" mat-button (click)="cancel()">
        {{ data.cancelLabel || 'Cancel' }}
      </button>
      <button type="button" mat-flat-button color="primary" (click)="confirm()">
        {{ data.confirmLabel || 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      p {
        margin: 0;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  private readonly _dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  public readonly data: ConfirmDialogData = inject(MAT_DIALOG_DATA);

  public cancel(): void {
    this._dialogRef.close(false);
  }

  public confirm(): void {
    this._dialogRef.close(true);
  }
}
