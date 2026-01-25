import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { jwtInterceptor } from '@myrmidon/auth-jwt-login';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions()),
    // HTTP Client with JWT interceptor and Fetch API support
    provideHttpClient(withInterceptors([jwtInterceptor]), withFetch()),
  ],
};
