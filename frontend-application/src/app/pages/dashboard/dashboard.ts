import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { EventTypes, OidcSecurityService, PublicEventsService } from 'angular-auth-oidc-client';
import { filter } from 'rxjs';
import { JsonHighlightPipe } from '../../shared/json-highlight.pipe';

const RENEW_OFFSET_SECONDS = 30; // must match renewTimeBeforeTokenExpiresInSeconds in auth.config.ts

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
}

interface Toast {
  id: number;
  status: 'success' | 'error';
  message: string;
}

interface RequestLog {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  status: number | null;
  pending: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, JsonHighlightPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly oidc = inject(OidcSecurityService);
  private readonly events = inject(PublicEventsService);
  private readonly http = inject(HttpClient);
  private clockInterval?: ReturnType<typeof setInterval>;

  userData = signal<Record<string, unknown> | null>(null);
  idTokenPayload = signal<Record<string, unknown> | null>(null);
  accessToken = signal<string>('');
  accessTokenDecoded = signal<Record<string, unknown> | null>(null);
  copied = signal(false);

  // UserInfo
  readonly userInfoUrl = 'http://localhost:8080/realms/test-realm/protocol/openid-connect/userinfo';
  userInfo = signal<Record<string, unknown> | null>(null);
  userInfoLoading = signal(false);
  userInfoError = signal<string | null>(null);

  // Token lifecycle
  tokenIssuedAt = signal<number>(0);
  tokenExpiresAt = signal<number>(0);
  tokenNow = signal<number>(Math.floor(Date.now() / 1000));
  refreshing = signal(false);
  justRefreshed = signal(false);
  refreshStep = signal(0); // 0=idle, 1=sending, 2=keycloak processing, 3=response received
  tokensExpanded = signal(true);
  readonly tokenEndpoint = 'http://localhost:8080/realms/test-realm/protocol/openid-connect/token';

  // API Test
  readonly apiBase = 'http://localhost:8090/api/products';
  products = signal<Product[]>([]);
  toasts = signal<Toast[]>([]);
  lastRequest = signal<RequestLog | null>(null);
  newName = '';
  newDescription = '';
  newPrice = 0;
  private toastCounter = 0;

  loginProvider = computed(() =>
    (this.idTokenPayload()?.['identity_provider'] as string) ?? null
  );

  pictureUrl = computed(() =>
    (this.idTokenPayload()?.['picture'] as string)
    ?? (this.userData()?.['picture'] as string)
    ?? null
  );

  initials = computed(() => {
    const name = (this.userData()?.['name'] ?? this.userData()?.['preferred_username'] ?? '?') as string;
    return name.charAt(0).toUpperCase();
  });

  jwtIoUrl = computed(() =>
    this.accessToken() ? `https://jwt.io/#debugger-io?token=${this.accessToken()}` : null
  );

  roles = computed(() => {
    const payload = this.accessTokenDecoded();
    if (!payload) return [];
    const realmRoles = (payload['realm_access'] as { roles?: string[] })?.roles ?? [];
    const ignored = new Set(['default-roles-test-realm', 'offline_access', 'uma_authorization']);
    return realmRoles.filter(r => !ignored.has(r));
  });

  scopes = computed(() => {
    const scope = this.accessTokenDecoded()?.['scope'] as string | undefined;
    return scope ? scope.split(' ').filter(s => s.length > 0) : [];
  });

  email = computed(() =>
    (this.userData()?.['email'] ?? this.idTokenPayload()?.['email']) as string | undefined ?? null
  );

  // Derived
  tokenLifetime = computed(() => this.tokenExpiresAt() - this.tokenIssuedAt());
  tokenElapsed = computed(() => Math.max(0, Math.min(this.tokenNow() - this.tokenIssuedAt(), this.tokenLifetime())));
  tokenRemaining = computed(() => Math.max(0, this.tokenExpiresAt() - this.tokenNow()));
  tokenProgress = computed(() => this.tokenLifetime() > 0 ? (this.tokenElapsed() / this.tokenLifetime()) * 100 : 0);
  autoRenewProgress = computed(() =>
    this.tokenLifetime() > 0
      ? ((this.tokenExpiresAt() - RENEW_OFFSET_SECONDS - this.tokenIssuedAt()) / this.tokenLifetime()) * 100
      : 70
  );
  isInRenewZone = computed(() => this.tokenRemaining() <= RENEW_OFFSET_SECONDS && this.tokenRemaining() > 0);

  ngOnInit() {
    this.oidc.userData$.subscribe(({ userData }) => this.userData.set(userData));
    this.oidc.getAccessToken().subscribe((token) => {
      if (token) this.applyToken(token);
    });
    this.oidc.getIdToken().subscribe((idToken) => {
      if (idToken) {
        try {
          const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          this.idTokenPayload.set(payload);
        } catch { /* ungültiges Token */ }
      }
    });

    this.events.registerForEvents()
      .pipe(filter((e) => e.type === EventTypes.NewAuthenticationResult))
      .subscribe(() => {
        this.oidc.getAccessToken().subscribe((token) => {
          if (token) {
            this.applyToken(token);
            // Only play animation if not already driven by forceRefresh()
            if (this.refreshStep() === 0) {
              this.playRefreshAnimation();
            }
          }
        });
      });

    this.loadUserInfo();

    this.clockInterval = setInterval(() => {
      this.tokenNow.set(Math.floor(Date.now() / 1000));
    }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.clockInterval);
  }

  /** Canned animation for silent renew (we only know it's done, not when it started) */
  private playRefreshAnimation() {
    this.refreshStep.set(1);
    setTimeout(() => this.refreshStep.set(2), 350);
    setTimeout(() => {
      this.refreshStep.set(3);
      this.justRefreshed.set(true);
    }, 800);
    setTimeout(() => {
      this.refreshStep.set(0);
      this.justRefreshed.set(false);
    }, 3300);
  }

  forceRefresh() {
    this.refreshing.set(true);
    this.refreshStep.set(1); // Arrow 1: Browser → Keycloak

    // Advance to "processing" step if the request takes a moment
    setTimeout(() => {
      if (this.refreshStep() === 1) this.refreshStep.set(2);
    }, 500);

    this.oidc.forceRefreshSession().subscribe({
      next: (result) => {
        this.refreshStep.set(3);
        this.refreshing.set(false);
        if (result?.accessToken) {
          this.applyToken(result.accessToken);
        }
        this.justRefreshed.set(true);
        setTimeout(() => {
          this.justRefreshed.set(false);
          this.refreshStep.set(0);
        }, 2500);
      },
      error: () => {
        this.refreshing.set(false);
        this.refreshStep.set(0);
      },
    });
  }

  private applyToken(token: string) {
    this.accessToken.set(token);
    try {
      const payload = JSON.parse(
        atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
      );
      this.accessTokenDecoded.set(payload);
      this.tokenIssuedAt.set(payload['iat'] ?? 0);
      this.tokenExpiresAt.set(payload['exp'] ?? 0);
    } catch {
      // ungültiges Token
    }
  }

  formatTime(epochSeconds: number): string {
    if (!epochSeconds) return '';
    return new Date(epochSeconds * 1000).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  copyToken() {
    navigator.clipboard.writeText(this.accessToken()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  loadUserInfo() {
    this.userInfoLoading.set(true);
    this.userInfoError.set(null);
    const headers = new HttpHeaders({ Authorization: `Bearer ${this.accessToken()}` });
    this.http.get<Record<string, unknown>>(this.userInfoUrl, { headers }).subscribe({
      next: (res) => {
        this.userInfo.set(res);
        this.userInfoLoading.set(false);
      },
      error: (err) => {
        this.userInfoError.set(`${err.status} - ${err.statusText || 'Fehler'}`);
        this.userInfoLoading.set(false);
      },
    });
  }

  loadProducts() {
    this.lastRequest.set({ method: 'GET', path: '/api/products', status: null, pending: true });
    this.http.get<Product[]>(this.apiBase, { headers: this.authHeaders(), observe: 'response' }).subscribe({
      next: (res) => {
        this.lastRequest.update(r => r ? { ...r, status: res.status, pending: false } : null);
        this.products.set(res.body ?? []);
        this.toast('success', `${res.body?.length ?? 0} Produkte geladen`);
      },
      error: (err) => {
        this.lastRequest.update(r => r ? { ...r, status: err.status, pending: false } : null);
        this.toast('error', `${err.status} - ${this.httpError(err.status)}`);
      },
    });
  }

  createProduct() {
    const body = { name: this.newName, description: this.newDescription, price: this.newPrice };
    this.lastRequest.set({ method: 'POST', path: '/api/products', body, status: null, pending: true });
    this.http.post<Product>(this.apiBase, body, { headers: this.authHeaders(), observe: 'response' }).subscribe({
      next: (res) => {
        this.lastRequest.update(r => r ? { ...r, status: res.status, pending: false } : null);
        const product = res.body!;
        this.products.update((list) => [...list, product]);
        this.toast('success', `Produkt "${product.name}" angelegt`);
        this.newName = '';
        this.newDescription = '';
        this.newPrice = 0;
      },
      error: (err) => {
        this.lastRequest.update(r => r ? { ...r, status: err.status, pending: false } : null);
        this.toast('error', `${err.status} - ${this.httpError(err.status)}`);
      },
    });
  }

  deleteProduct(id: number, name: string) {
    this.lastRequest.set({ method: 'DELETE', path: `/api/products/${id}`, status: null, pending: true });
    this.http.delete(`${this.apiBase}/${id}`, { headers: this.authHeaders(), observe: 'response' }).subscribe({
      next: (res) => {
        this.lastRequest.update(r => r ? { ...r, status: res.status, pending: false } : null);
        this.products.update((list) => list.filter((p) => p.id !== id));
        this.toast('success', `"${name}" gelöscht`);
      },
      error: (err) => {
        this.lastRequest.update(r => r ? { ...r, status: err.status, pending: false } : null);
        this.toast('error', `${err.status} - ${this.httpError(err.status)}`);
      },
    });
  }

  truncateToken(token: string, length = 64): string {
    return token.length > length ? token.slice(0, length) + '…' : token;
  }

  httpStatusText(status: number): string {
    const map: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' };
    return map[status] ?? '';
  }

  dismissToast(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private authHeaders() {
    return new HttpHeaders({ Authorization: `Bearer ${this.accessToken()}` });
  }

  private toast(status: 'success' | 'error', message: string) {
    const id = ++this.toastCounter;
    this.toasts.update((list) => [...list, { id, status, message }]);
    setTimeout(() => this.toasts.update((list) => list.filter((t) => t.id !== id)), 4000);
  }

  private httpError(status: number): string {
    const map: Record<number, string> = {
      401: 'Unauthorized - kein gültiges Token',
      403: 'Forbidden - fehlende Rolle',
      404: 'Not Found',
      500: 'Internal Server Error',
    };
    return map[status] ?? 'Unbekannter Fehler';
  }

  logout() {
    this.oidc.logoff().subscribe();
  }
}
