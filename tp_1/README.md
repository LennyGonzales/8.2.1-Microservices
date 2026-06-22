# TP — Web Services Sécurisés avec Keycloak

Architecture microservices à trois tiers : frontend statique, API REST Spring Boot, et serveur d'autorisation Keycloak.

---

## Migration de l'IdP : Google → Keycloak

Dans un premier temps, l'application utilisait **Google** comme Identity Provider via Spring Security OAuth2 Client (`spring-boot-starter-oauth2-client`). Le backend gérait une session HTTP côté serveur, l'utilisateur se connectait via "Se connecter avec Google", et le profil était récupéré depuis l'objet `OidcUser` de Google.

Cette approche a été **remplacée intégralement par Keycloak** pour les raisons suivantes :
- Keycloak est auto-hébergé : aucune dépendance à un service tiers externe
- Il permet de gérer les utilisateurs, les rôles et les clients en interne
- Il sert à la fois l'authentification du frontend **et** l'autorisation de l'API (deux clients distincts)

**Changements opérés lors de la migration :**

| Élément | Avant (Google) | Après (Keycloak) |
|---|---|---|
| Dépendance Maven | `oauth2-client` | `oauth2-resource-server` |
| Mode session backend | Stateful (session HTTP) | Stateless (JWT Bearer) |
| Principal Spring | `OidcUser` (Google) | `Jwt` (Keycloak) |
| Auth frontend | Lien redirect Google | `keycloak-js` (Authorization Code + PKCE) |
| Config `application.yml` | `clientId` / `clientSecret` Google | `issuer-uri` Keycloak |
| Credentials | `GOOGLE_CLIENT_ID/SECRET` | `KEYCLOAK_ISSUER_URI` |

---

## Architecture

```
Navigateur (localhost:3000)
    │  keycloak-js (OIDC Authorization Code + PKCE)
    ▼
Keycloak (localhost:8180)          ← Identity Provider (OpenID Connect)
    │  JWT (access token)
    ▼
Frontend nginx (localhost:3000)
    │  Authorization: Bearer <JWT>
    ▼
API REST Spring Boot (localhost:8080)  ← Resource Server (valide le JWT)
```

---

## Services

| Service | Technologie | Port | Rôle |
|---|---|---|---|
| `front` | nginx + HTML/JS vanilla | 3000 | SPA statique, auth via Keycloak JS |
| `back` | Spring Boot 4.1 / Java 21 | 8080 | API REST sécurisée par JWT |
| `keycloak` | Keycloak 26.x | 8180 | Serveur OpenID Connect (Auth + Token) |

---

## Démarrage rapide

```bash
# Copier et remplir les variables d'environnement
cp .env.example .env

# Lancer toute la stack
docker compose up --build
```

Le backend attend que Keycloak soit `healthy` avant de démarrer (`depends_on: condition: service_healthy`).

**Compte de test :** `testuser` / `Test1234!`

---

## Tâches réalisées

### Tâche 1–3 — API REST de base

- API Spring Boot exposant deux endpoints :
  - `GET /api/vol` — liste de vols (public)
  - `GET /api/profil` — profil de l'utilisateur connecté (protégé)
- Modèle `Vol` : `compagnieAerienne`, `numeroVol`, `place`, `prix`, `date`
- Frontend HTML/JS affichant les vols dans un tableau et le profil utilisateur

---

### Tâche 4 — Sécurisation de l'API REST via Keycloak (Resource Server)

**4a — Installation Keycloak**

Keycloak tourne en Docker (`quay.io/keycloak/keycloak:latest`, mode dev). Il importe automatiquement le realm au démarrage via `--import-realm` et le volume `./keycloak:/opt/keycloak/data/import`.

**4b — Client `rest-api` (bearer-only)**

Déclaré dans `keycloak/realm-export.json` :
- Type : confidentiel, `bearerOnly: true`
- Tous les flows désactivés (pas de login direct, uniquement validation de tokens)

**4c — Configuration du backend comme Resource Server**

Dépendance Maven : `spring-boot-starter-oauth2-resource-server` (standard Spring Security, pas d'adapter Keycloak propriétaire).

`application.yml` :
```yaml
spring.security.oauth2.resourceserver.jwt.issuer-uri:
  ${KEYCLOAK_ISSUER_URI:http://localhost:8180/realms/microservices-realm}
```

`SecurityConfig.java` — points clés :
- Session `STATELESS` (API REST pure, pas de cookie de session)
- `oauth2ResourceServer(jwt -> {})` : chaque requête doit porter un Bearer JWT valide signé par Keycloak
- CSRF désactivé
- CORS : origine `http://localhost:3000` autorisée, `allowCredentials: false`

`ProfilController.java` : reçoit `@AuthenticationPrincipal Jwt`, extrait les claims `name`, `preferred_username`, `email`.

**4d — Validation**

```bash
# Sans token → 401
curl -i http://localhost:8080/api/profil

# Avec token → 200
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/profil

# Endpoint public → 200 sans token
curl http://localhost:8080/api/vol
```

---

### Tâche 5 — Authentification du frontend via Keycloak

**5a — Client `web-app` (public)**

Déclaré dans `keycloak/realm-export.json` :
- Type : public (PKCE obligatoire, pas de secret côté client)
- `standardFlowEnabled: true` (Authorization Code Flow)
- `redirectUris: ["http://localhost:3000/*"]`
- `webOrigins: ["http://localhost:3000"]`

**5b — Intégration keycloak-js**

La librairie `keycloak-js` est auto-hébergée dans `front/keycloak.js` (package npm `keycloak-js@26.2.4`, compatible Keycloak 26.x). Elle est servie par nginx sur la même origine que l'app pour éviter les erreurs CORS/ORB.

`index.html` charge `app.js` en tant que module ES (`type="module"`).

**5c — Flow d'authentification**

`app.js` initialise Keycloak en mode `check-sso` (non-intrusif : pas de redirection forcée au chargement) avec PKCE S256 :

```js
const keycloak = new Keycloak({
  url: 'http://localhost:8180',
  realm: 'microservices-realm',
  clientId: 'web-app'
});
keycloak.init({ onLoad: 'check-sso', pkceMethod: 'S256' });
```

- Si session SSO active → profil affiché depuis `keycloak.tokenParsed` (JWT décodé)
- Clic "Se connecter" → `keycloak.login()` → redirection vers Keycloak → retour avec code → échange contre JWT
- Appels à `/api/profil` → header `Authorization: Bearer <access_token>` (avec refresh auto si expiry < 30s)
- `silent-check-sso.html` : page iframe pour la vérification SSO silencieuse

---

## Keycloak — Realm `microservices-realm`

| Élément | Valeur |
|---|---|
| Realm | `microservices-realm` |
| Client API | `rest-api` (bearer-only, confidentiel) |
| Client Web | `web-app` (public, Authorization Code + PKCE) |
| Utilisateur test | `testuser` / `Test1234!` |

Console d'administration : [http://localhost:8180/admin](http://localhost:8180/admin)

---

## Notes techniques

- **Healthcheck Keycloak** : `curl` et `wget` sont absents de l'image Keycloak 26. Le healthcheck utilise `/proc/net/tcp6` (port 8080 = `1F90` en hex) — seul `grep` est nécessaire.
- **keycloak-js** : depuis Keycloak 20+, `keycloak.js` n'existe plus comme fichier statique dans l'image Docker. Il faut l'auto-héberger depuis le package npm officiel.
- **Pas d'adapter Keycloak propriétaire** : la configuration utilise uniquement les standards Spring Security OAuth2 et OIDC, conformément aux recommandations (les adapters Keycloak sont dépréciés).
