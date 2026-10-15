import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { email, form, FormField, FormRoot, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthJwtAccountService } from '@myrmidon/auth-jwt-admin';

@Component({
  selector: 'cadmus-reset-password',
  standalone: true,
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormField,
    FormRoot,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
})
export class ResetPasswordComponent {
  private readonly _snackbar = inject(MatSnackBar);
  private readonly _accountService = inject(AuthJwtAccountService);

  public readonly form = form(
    signal({ email: '' }),
    (p) => {
      required(p.email);
      email(p.email);
    },
    {
      submission: {
        action: async (f) => {
          await this.reset(f.email().value());
          return undefined;
        },
      },
    },
  );

  public readonly busy = computed(() => this.form().submitting());

  private async reset(address: string): Promise<void> {
    try {
      await firstValueFrom(this._accountService.resetPassword(address));
      this._snackbar.open(`Message sent to ${address}`, 'OK');
    } catch (error) {
      console.error(error);
      this._snackbar.open(`Error sending message to ${address}`, 'OK');
    }
  }
}
