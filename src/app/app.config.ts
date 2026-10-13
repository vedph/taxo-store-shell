import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { AUTH_JWT_EXCLUDED_URLS, jwtInterceptor } from '@myrmidon/auth-jwt-login';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions()),
    // HTTP Client with JWT interceptor and Fetch API support
    provideHttpClient(withInterceptors([jwtInterceptor])),
    // excluded URLs for JWT interceptor
    {
      provide: AUTH_JWT_EXCLUDED_URLS,
      useValue: ['https://viaf.org/viaf/'],
    },
  ],
};
