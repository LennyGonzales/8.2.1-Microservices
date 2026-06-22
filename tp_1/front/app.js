import Keycloak from '/keycloak.js';

const API_BASE = 'http://localhost:8080/api';
const VOL_URL = API_BASE + '/vol';
const PROFIL_URL = API_BASE + '/profil';

// ---------------------------------------------------------------------------
// Initialisation du client Keycloak JS
// Le script keycloak.js est chargé depuis le serveur Keycloak (voir index.html)
// ---------------------------------------------------------------------------
const keycloak = new Keycloak({
  url: 'http://localhost:8180',
  realm: 'microservices-realm',
  clientId: 'web-app'
});

// ---------------------------------------------------------------------------
// Éléments DOM
// ---------------------------------------------------------------------------
const btnFetch          = document.getElementById('btn-fetch');
const flightsResultEl   = document.getElementById('flights-result');
const profileEl         = document.getElementById('profile');
const btnLogin          = document.getElementById('btn-keycloak-login');
const btnLogout         = document.getElementById('btn-keycloak-logout');

const priceFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR'
});

// ---------------------------------------------------------------------------
// Démarrage : initialisation Keycloak en mode "check-sso" (non-intrusif)
// Si l'utilisateur a déjà une session SSO active, il sera automatiquement
// reconnecté. Sinon, l'app s'affiche en mode non-authentifié.
// ---------------------------------------------------------------------------
keycloak
  .init({
    onLoad: 'check-sso',
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
    pkceMethod: 'S256'  // PKCE obligatoire pour les clients publics
  })
  .then(function (authenticated) {
    if (authenticated) {
      renderProfile(keycloak.tokenParsed);
      showLogoutButton();
    } else {
      showLoginButton();
    }
  })
  .catch(function () {
    console.error('Erreur lors de l\'initialisation de Keycloak');
    showLoginButton();
  });

// ---------------------------------------------------------------------------
// Gestion des boutons Login / Logout
// ---------------------------------------------------------------------------
btnLogin.addEventListener('click', function () {
  keycloak.login();
});

btnLogout.addEventListener('click', function () {
  keycloak.logout({ redirectUri: window.location.origin });
});

btnFetch.addEventListener('click', fetchVols);

// ---------------------------------------------------------------------------
// Affichage du profil
// ---------------------------------------------------------------------------
function showLoginButton() {
  btnLogin.classList.remove('hidden');
  btnLogout.classList.add('hidden');
  profileEl.classList.add('hidden');
  profileEl.replaceChildren();
}

function showLogoutButton() {
  btnLogin.classList.add('hidden');
  btnLogout.classList.remove('hidden');
}

/**
 * Affiche le profil depuis les claims du JWT Keycloak (tokenParsed).
 * Claims disponibles : name, preferred_username, email, given_name, family_name
 */
function renderProfile(claims) {
  const name  = claims.name || claims.preferred_username || 'Utilisateur';
  const email = claims.email || '';

  profileEl.replaceChildren();
  profileEl.classList.remove('hidden');

  const info = document.createElement('div');
  info.className = 'profile-info';

  const nameEl = document.createElement('p');
  nameEl.className = 'profile-name';
  nameEl.textContent = name;

  const emailEl = document.createElement('p');
  emailEl.className = 'profile-email';
  emailEl.textContent = email;

  info.append(nameEl, emailEl);
  profileEl.append(info);
}

// ---------------------------------------------------------------------------
// Appels API
// ---------------------------------------------------------------------------

/**
 * Retourne un header Authorization avec le Bearer token Keycloak.
 * Rafraîchit automatiquement le token s'il expire dans moins de 30 secondes.
 */
async function getAuthHeaders() {
  if (!keycloak.authenticated) {
    return {};
  }
  try {
    await keycloak.updateToken(30);
  } catch {
    // Token expiré et refresh impossible → forcer reconnexion
    keycloak.login();
    return {};
  }
  return {
    'Authorization': 'Bearer ' + keycloak.token,
    'Accept': 'application/json'
  };
}

async function fetchVols() {
  showFlightsLoading();
  try {
    const response = await fetch(VOL_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      showFlightsError('Impossible de récupérer les vols', 'Erreur HTTP ' + response.status);
      return;
    }

    renderFlights(normalizeVols(await response.json()));
  } catch (err) {
    showFlightsError('Connexion impossible', 'Vérifiez que l\'API est démarrée sur le port 8080.');
  }
}

// ---------------------------------------------------------------------------
// Rendu des vols
// ---------------------------------------------------------------------------
function showFlightsLoading() {
  btnFetch.disabled = true;
  flightsResultEl.className = 'loading';
  flightsResultEl.replaceChildren();

  const spinner = document.createElement('div');
  spinner.className = 'spinner';

  const label = document.createElement('span');
  label.textContent = 'Chargement des vols…';

  flightsResultEl.append(spinner, label);
}

function showFlightsError(title, detail) {
  btnFetch.disabled = false;
  flightsResultEl.className = 'error';

  const heading = document.createElement('strong');
  heading.textContent = title;

  const message = document.createElement('p');
  message.textContent = detail;

  flightsResultEl.replaceChildren(heading, message);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function normalizeVols(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

function createCell(text, className) {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = text;
  return cell;
}

function renderFlights(vols) {
  btnFetch.disabled = false;
  flightsResultEl.className = '';
  flightsResultEl.replaceChildren();

  if (!vols.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Aucun vol disponible.';
    flightsResultEl.append(empty);
    return;
  }

  const wrapper = document.createElement('section');
  wrapper.className = 'results';

  const summary = document.createElement('p');
  summary.className = 'results-summary';
  summary.textContent = vols.length + (vols.length > 1 ? ' vols disponibles' : ' vol disponible');

  const table = document.createElement('table');
  table.className = 'flights-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Compagnie', 'N° vol', 'Place', 'Date', 'Prix'].forEach(function (label) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    headRow.append(th);
  });
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  vols.forEach(function (vol) {
    const row = document.createElement('tr');
    row.append(
      createCell(vol.compagnieAerienne ?? '—', 'company'),
      createCell(vol.numeroVol ?? '—', 'flight-code'),
      createCell(vol.place ?? '—'),
      createCell(formatDate(vol.date ?? '—')),
      createCell(
        typeof vol.prix === 'number' ? priceFormatter.format(vol.prix) : '—',
        'price'
      )
    );
    tbody.append(row);
  });

  table.append(thead, tbody);
  wrapper.append(summary, table);
  flightsResultEl.append(wrapper);
}

