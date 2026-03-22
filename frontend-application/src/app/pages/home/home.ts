import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { JsonHighlightPipe } from '../../shared/json-highlight.pipe';

const POLL_INTERVAL_MS = 5000;

export interface EndpointInfo {
  key: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-home',
  imports: [JsonHighlightPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly oidc = inject(OidcSecurityService);
  private readonly http = inject(HttpClient);
  private pollInterval?: ReturnType<typeof setInterval>;

  readonly discoveryUrl = 'http://localhost:8080/realms/test-realm/.well-known/openid-configuration';
  readonly tokenEndpoint = 'http://localhost:8080/realms/test-realm/protocol/openid-connect/token';

  discoveryDoc = signal<Record<string, unknown> | null>(null);
  discoveryError = signal<string | null>(null);
  realmAvailable = signal<boolean | null>(null);
  clientExists = signal<boolean | null>(null);

  keycloakAvailable = computed<boolean | null>(() => {
    const realm = this.realmAvailable();
    const client = this.clientExists();
    if (realm === null || client === null) return null;
    return realm === true && client === true;
  });

  readonly highlightedEndpoints: EndpointInfo[] = [
    { key: 'issuer',                  label: 'Issuer',                  description: 'Eindeutige ID des Identity Providers' },
    { key: 'authorization_endpoint',  label: 'Authorization Endpoint',  description: 'Hier startet der Login-Flow (PKCE)' },
    { key: 'token_endpoint',          label: 'Token Endpoint',          description: 'Tauscht Authorization Code gegen Tokens' },
    { key: 'userinfo_endpoint',       label: 'UserInfo Endpoint',       description: 'Liefert Nutzerinfos anhand des Access Tokens' },
    { key: 'jwks_uri',                label: 'JWKS URI',                description: 'Public Keys zur Token-Validierung' },
    { key: 'end_session_endpoint',    label: 'End Session Endpoint',    description: 'Logout-Endpunkt' },
  ];

  ngOnInit() {
    this.checkAvailability();
    this.pollInterval = setInterval(() => this.checkAvailability(), POLL_INTERVAL_MS);
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
  }

  private checkAvailability() {
    this.http.get<Record<string, unknown>>(this.discoveryUrl).subscribe({
      next: (res) => {
        this.realmAvailable.set(true);
        if (!this.discoveryDoc()) {
          this.discoveryDoc.set(res);
        }
        if (this.clientExists() !== true) {
          this.probeClient();
        }
      },
      error: () => {
        this.realmAvailable.set(false);
        this.clientExists.set(false);
        this.discoveryDoc.set(null);
      },
    });
  }

  private probeClient() {
    const body = `grant_type=authorization_code&client_id=test-application&code=probe&redirect_uri=${encodeURIComponent(window.location.origin + '/callback')}`;
    this.http.post<{ error: string }>(this.tokenEndpoint, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).subscribe({
      next: () => this.clientExists.set(true),
      error: (err) => {
        const e = err.error?.error;
        this.clientExists.set(e !== 'invalid_client' && e !== 'unauthorized_client');
      },
    });
  }

  login() {
    this.oidc.authorize();
  }
}
