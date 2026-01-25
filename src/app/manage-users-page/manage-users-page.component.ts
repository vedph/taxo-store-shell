import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { UserListComponent } from '@myrmidon/auth-jwt-admin';

@Component({
  selector: 'app-manage-users-page',
  standalone: true,
  templateUrl: './manage-users-page.component.html',
  styleUrls: ['./manage-users-page.component.css'],
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    UserListComponent,
  ],
})
export class ManageUsersPageComponent {}
