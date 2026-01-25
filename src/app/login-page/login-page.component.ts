import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthJwtLoginComponent, AuthJwtService, Credentials } from '@myrmidon/auth-jwt-login';

@Component({
  selector: 'app-login-page',
  standalone: true,
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css'],
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    AuthJwtLoginComponent,
  ],
})
export class LoginPageComponent {
  public readonly busy = signal<boolean>(false);
  public readonly error = signal<string | undefined>(undefined);

  constructor(
    private _authService: AuthJwtService,
    private _router: Router,
    private _snackbar: MatSnackBar
  ) {}

  public onLoginRequest(credentials: Credentials): void {
    this.busy.set(true);

    this._authService.login(credentials.name, credentials.password).subscribe({
      next: (user) => {
        console.log('User logged in', user);
        this._router.navigate([credentials.returnUrl || '/items']);
      },
      error: (error) => {
        this.error.set('Login failed');
        console.error(this.error, error);
        this._snackbar.open(this.error()!, 'Dismiss', {
          duration: 5000,
        });
      },
      complete: () => {
        this.busy.set(false);
      },
    });
  }
  public onResetRequest(): void {
    this._router.navigate(['/reset-password']);
  }
}
