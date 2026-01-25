import { Component, signal } from '@angular/core';
import {
  FormGroup,
  FormControl,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

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
  imports: [
    ReactiveFormsModule,
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
  public readonly busy = signal<boolean>(false);

  public email: FormControl<string | null>;
  public form: FormGroup;

  constructor(
    private _snackbar: MatSnackBar,
    private _accountService: AuthJwtAccountService,
    formBuilder: FormBuilder
  ) {
    this.email = formBuilder.control(null, [
      Validators.required,
      Validators.email,
    ]);
    this.form = formBuilder.group({
      email: this.email,
    });
  }

  public reset(): void {
    if (this.busy() || !this.email.value) {
      return;
    }

    this.busy.set(true);
    this._accountService.resetPassword(this.email.value).subscribe({
      next: () => {
        this.busy.set(false);
        this._snackbar.open(`Message sent to ${this.email.value}`, 'OK');
      },
      error: (error) => {
        this.busy.set(false);
        console.error(error);
        this._snackbar.open(
          `Error sending message to ${this.email.value}`,
          'OK'
        );
      },
    });
  }
}
