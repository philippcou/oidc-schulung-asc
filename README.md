# OIDC Schulung

Schulungsunterlage für OpenID Connect. Demonstriert den Authorization Code Flow mit PKCE anhand einer Angular SPA, einem Spring Boot Resource Server und Keycloak als Identity Provider.

## Voraussetzungen

- Docker & Docker Compose

## Starten

```bash
docker compose up --build
```

Beim ersten Start werden alle Images gebaut — das dauert einige Minuten.

| Service | URL |
|---|---|
| Frontend (Angular SPA) | http://localhost:4200 |
| Backend (Spring Boot API) | http://localhost:8090 |
| Keycloak Admin Console | http://localhost:8080 |

Keycloak Admin-Zugangsdaten: `admin` / `admin`

## Aufbau

```
.
├── frontend-application/   Angular 21 SPA (Authorization Code Flow + PKCE)
├── backend-application/    Spring Boot Resource Server (JWT-Validierung, Rollen)
├── keycloak/
│   ├── Dockerfile          Keycloak mit Custom Protocol Mapper
│   ├── realm-export.json   Realm-Konfiguration (wird beim Start importiert)
│   └── mapper/             Custom Protocol Mapper (Java, SPI)
├── presentation/           Slidev-Präsentation
└── docker-compose.yml
```

## Benutzer (Testrealm)

Die Benutzer müssen manuell in der Keycloak Admin Console unter `test-realm` → **Users** angelegt werden.

## Präsentation

```bash
cd presentation
npm install
npm run dev
```
