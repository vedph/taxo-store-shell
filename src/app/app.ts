import { Component, OnInit, Inject, OnDestroy, signal, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';

// material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

// myrmidon
import { EnvService } from '@myrmidon/ngx-tools';
import { AuthJwtService, GravatarPipe, User } from '@myrmidon/auth-jwt-login';

@Component({
  selector: 'app-root',
  imports: [
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    MatTooltipModule,
    GravatarPipe,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnDestroy {
  private readonly _subs: Subscription[] = [];

  // add backing signal for current user
  private readonly _user = signal<User | undefined>(undefined);

  public readonly user = computed<User | undefined>(() => {
    return this._user();
  });

  public readonly logged = computed<boolean>(() => {
    return this.user() !== undefined;
  });

  public readonly version = signal<string>('');

  constructor(
    private _authService: AuthJwtService,
    private _router: Router,
    env: EnvService,
  ) {
    this.version.set(env.get('version') || '');

    // subscribe to currentUser$ and update the signal
    const sub = this._authService.currentUser$.subscribe((u) => this._user.set(u || undefined));
    this._subs.push(sub);
  }

  public ngOnDestroy(): void {
    this._subs.forEach((s) => s.unsubscribe());
  }

  public logout(): void {
    if (!this.logged()) {
      return;
    }
    this._authService
      .logout()
      .pipe(take(1))
      .subscribe((_) => {
        this._router.navigate(['/home']);
      });
  }
}
