import { Routes } from '@angular/router';

import { jwtGuard, jwtAdminGuard } from '@myrmidon/auth-jwt-login';
import { LoginPageComponent } from './login-page/login-page.component';
import { ManageUsersPageComponent } from './manage-users-page/manage-users-page.component';
import { RegisterUserPageComponent } from './register-user-page/register-user-page.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { HomeComponent } from './home/home.component';
import { TaxoStoreEditorPage } from './taxo-store-editor-page/taxo-store-editor-page';
import { TaxoStorePickerPage } from './tree-store-picker-page/taxo-store-picker-page';

export const routes: Routes = [
  // auth
  { path: 'login', component: LoginPageComponent },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    canActivate: [jwtGuard],
  },
  {
    path: 'register-user',
    component: RegisterUserPageComponent,
    canActivate: [jwtAdminGuard],
  },
  {
    path: 'manage-users',
    component: ManageUsersPageComponent,
    canActivate: [jwtAdminGuard],
  },
  {
    path: 'taxo-store-editor',
    component: TaxoStoreEditorPage,
    canActivate: [jwtGuard],
  },
  {
    path: 'taxo-store-picker',
    component: TaxoStorePickerPage,
    canActivate: [jwtGuard],
  },
  // home
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  // fallback
  { path: '**', component: HomeComponent },
];
