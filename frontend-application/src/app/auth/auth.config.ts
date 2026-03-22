import { PassedInitialConfig } from 'angular-auth-oidc-client';

export const authConfig: PassedInitialConfig = {
  config: {
              authority: 'http://localhost:8080/realms/test-realm',
              redirectUrl: window.location.origin + '/callback',
              postLoginRoute: '/dashboard',
              postLogoutRedirectUri: window.location.origin,
              clientId: 'test-application',
              scope: 'openid profile',
              responseType: 'code',
              silentRenew: true,
              useRefreshToken: true,
              renewTimeBeforeTokenExpiresInSeconds: 30,
              autoUserInfo: true,
          }
}
