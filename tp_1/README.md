# TP — Web Services Sécurisés avec Keycloak

Architecture microservices à trois tiers : frontend statique, API REST Spring Boot, et serveur d'autorisation Keycloak.


## Démarrage rapide

```bash
cp .env.example .env
docker compose up --build
```

Le backend attend que Keycloak soit `healthy` avant de démarrer (`depends_on: condition: service_healthy`).

**Compte de test :** `testuser` / `Test1234!`

---

## Tâches réalisées

### Tâche 1 — API REST de base

Projet Maven Spring Boot généré avec l'archétype `maven-archetype-webapp`, groupId `infres.ws.rest`, artifactId `java-rest-server`.

**1b — Hiérarchie de ressources REST**

```
/api
└── /vol          GET → liste des vols disponibles
    └── /{id}     (extensible par compagnie, numéro, place, date)
```

**1c/1d — Ressource `Vol` en JSON**

Modèle Java (`Vol.java`) exposé en JSON via Jackson :

```java
record Vol(String compagnieAerienne, String numeroVol, String place, double prix, String date)
```

`GET /api/vol` retourne une liste statique de 3 vols (pas de base de données). La consigne demandait initialement du XML/JAXB — on utilise directement JSON (Spring Boot sérialise via Jackson par défaut, ce qui correspond à la demande 1d).

---

### Tâche 2 — Application JavaScript

Frontend HTML/JS vanilla servi par nginx (port 3000).

- Bouton "Récupérer les vols" → `GET /api/vol` → affichage en tableau (compagnie, n° vol, place, date, prix)
- Section profil : affiche le nom et l'email de l'utilisateur connecté
- Aucun framework, aucune dépendance npm côté frontend applicatif

---

### Tâche 3 — Délégation OAuth 2.0 auprès de Google (remplacé par Keycloak)

**3a — Inscription auprès de Google**

Un projet Google Cloud a été créé, l'API Google+ activée, et des credentials OAuth 2.0 récupérés (`client_id` + `client_secret`). L'URL de redirection `http://localhost:8080/api/login/oauth2/code/google` a été déclarée.

**3b/3c — Intégration Spring Security OAuth2 Client**

Dépendance `spring-boot-starter-oauth2-client`. Spring Security gère automatiquement le flow Authorization Code. Le profil était récupéré depuis l'objet `OidcUser` (claims Google : `name`, `email`, `picture`) et renvoyé par `GET /api/profil`.

**Migration vers Keycloak (tâches 4 & 5)**

Google a été **remplacé intégralement par Keycloak** (auto-hébergé, gestion interne des utilisateurs). Voir le tableau de migration ci-dessous.

| Élément | Avant (Google) | Après (Keycloak) |
|---|---|---|
| Dépendance Maven | `oauth2-client` | `oauth2-resource-server` |
| Mode session backend | Stateful (session HTTP) | Stateless (JWT Bearer) |
| Principal Spring | `OidcUser` | `Jwt` |
| Auth frontend | Lien redirect Google | `keycloak-js` (Authorization Code + PKCE) |
| Config `application.yml` | `clientId` / `clientSecret` Google | `issuer-uri` Keycloak |

---

### Tâche 4 — Sécurisation de l'API REST via Keycloak (Resource Server)

**4a — Installation Keycloak**

Keycloak tourne en Docker (`quay.io/keycloak/keycloak:latest`, mode dev). Il importe automatiquement le realm au démarrage via `--import-realm` et le volume `./keycloak:/opt/keycloak/data/import`.

**4b — Client `rest-api` (bearer-only)**

Déclaré dans `keycloak/realm-export.json` :
- Type : confidentiel, `bearerOnly: true`
- Tous les flows désactivés (pas de login direct, uniquement validation de tokens)

**4c — Configuration du backend comme Resource Server**

Dépendance Maven : `spring-boot-starter-oauth2-resource-server` (standard Spring Security, pas d'adapter Keycloak propriétaire — les adapters Keycloak sont dépréciés).

`application.yml` :
```yaml
spring.security.oauth2.resourceserver.jwt.issuer-uri:
  ${KEYCLOAK_ISSUER_URI:http://localhost:8180/realms/microservices-realm}
```

`SecurityConfig.java` :
- Session `STATELESS`
- `oauth2ResourceServer(jwt -> {})` : chaque requête doit porter un Bearer JWT valide signé par Keycloak
- CSRF désactivé
- CORS : origine `http://localhost:3000` autorisée

`ProfilController.java` : `@AuthenticationPrincipal Jwt` → claims `name`, `preferred_username`, `email`.

**4d — Validation**

```bash
curl -i http://localhost:8080/api/profil                              # → 401 sans token
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/profil  # → 200
curl http://localhost:8080/api/vol                                    # → 200 (public)
```

---

### Tâche 5 — Authentification du frontend via Keycloak

**5a — Client `web-app` (public)**

Déclaré dans `keycloak/realm-export.json` :
- Type : public (PKCE obligatoire, pas de secret côté client)
- `standardFlowEnabled: true` (Authorization Code Flow)
- `redirectUris: ["http://localhost:3000/*"]`
- `webOrigins: ["http://localhost:3000"]`

**5c — Flow d'authentification et récupération du JWT**

```js
const keycloak = new Keycloak({
  url: 'http://localhost:8180',
  realm: 'microservices-realm',
  clientId: 'web-app'
});
keycloak.init({ onLoad: 'check-sso', pkceMethod: 'S256' });
```

- Clic "Se connecter" → `keycloak.login()` → redirection Keycloak → retour avec code d'autorisation → échange contre un **JWT access token**
- `keycloak.tokenParsed` contient les claims JWT décodés (sub, name, email…) — ID utilisateur visible directement
- Appels à `/api/profil` → header `Authorization: Bearer <access_token>` (refresh auto si expiry < 30s)

---

### Tâche 6 — Analyse du token JWT Keycloak

**6a — Récupération du token**

Après connexion, le token est accessible dans la console navigateur :
```js
// Dans la console du navigateur (après connexion)
keycloak.token        // access token brut (JWT)
keycloak.tokenParsed  // claims décodés (objet JS)
```

Ou via les DevTools → Onglet Réseau → requête vers `http://localhost:8180/realms/microservices-realm/protocol/openid-connect/token` → champ `access_token` dans la réponse JSON.

**6b — Décodage sur jwt.io**

En collant le token sur [https://jwt.io](https://jwt.io), on observe :

- **Header** : 
```json
{
  "alg": "HS512",
  "typ": "JWT",
  "kid": "3e283f18-d7bf-4c38-b6f2-209131e1e5e2"
}
```
- **Payload**:
```json
{
  "exp": 1782174794,
  "iat": 1782138794,
  "jti": "fc6fcfd7-0bfc-15fe-882d-401942ec1770",
  "iss": "http://localhost:8180/realms/microservices-realm",
  "sub": "66170568-9e2d-42cc-b552-a9eba180d090",
  "typ": "Serialized-ID",
  "sid": "fqCllbTeS37I7x-l008i_HPE",
  "state_checker": "JvOSOgbjH-NSNVdT4o_nOT8-BNT-MVdJaG7RAJv2myo"
}
```
- **Signature** : vérifiable avec la clé publique du realm (`http://localhost:8180/realms/microservices-realm`)

---

### Tâche 7 — Contrat d'API OpenAPI / Swagger

**7a — Définition du contrat**

Le contrat OpenAPI 3.0 de l'API est défini ci-dessous (à coller dans [https://editor.swagger.io](https://editor.swagger.io)) :

```yaml
openapi: 3.0.3
info:
  title: API Réservation de Vols
  version: 1.0.0
  description: Web service REST de réservation de vols sécurisé par Keycloak (JWT Bearer)

servers:
  - url: http://localhost:8080/api

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Vol:
      type: object
      properties:
        compagnieAerienne:
          type: string
          example: Air France
        numeroVol:
          type: string
          example: AF123
        place:
          type: string
          example: 12A
        prix:
          type: number
          format: double
          example: 350.0
        date:
          type: string
          format: date
          example: "2024-07-01"

    Profil:
      type: object
      properties:
        name:
          type: string
          example: Test User
        email:
          type: string
          example: testuser@demo.local
        picture:
          type: string
          example: ""

paths:
  /vol:
    get:
      summary: Liste des vols disponibles
      description: Retourne la liste statique des vols. Endpoint public, aucune authentification requise.
      responses:
        "200":
          description: Liste des vols
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Vol'

  /profil:
    get:
      summary: Profil de l'utilisateur connecté
      description: Retourne les informations de l'utilisateur extraites du JWT Keycloak.
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Profil utilisateur
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Profil'
        "401":
          description: Token absent ou invalide
```

**7b — Génération depuis le contrat**

Depuis [https://editor.swagger.io](https://editor.swagger.io) après avoir collé le contrat :

- **Documentation HTML** : `Generate Client → html2` ou `Generate Server → html`
- **Client JavaScript** : `Generate Client → javascript`
- **Client Java** : `Generate Client → java`

Ou via la CLI `openapi-generator` :
```bash
# Documentation HTML
openapi-generator generate -i openapi.yaml -g html2 -o ./docs

# Client JavaScript
openapi-generator generate -i openapi.yaml -g javascript -o ./client-js
```

---

## Keycloak — Realm `microservices-realm`

| Élément | Valeur |
|---|---|
| Realm | `microservices-realm` |
| Client API | `rest-api` (bearer-only, confidentiel) |
| Client Web | `web-app` (public, Authorization Code + PKCE) |
| Utilisateur test | `testuser` / `Test1234!` |

Console d'administration : [http://localhost:8180/admin](http://localhost:8180/admin)

