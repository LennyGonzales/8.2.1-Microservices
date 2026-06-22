const API_BASE = 'http://localhost:8080/api';
const VOL_URL = API_BASE + '/vol';
const PROFILE_URL = API_BASE + '/profil';

const btnFetch = document.getElementById('btn-fetch');
const flightsResultEl = document.getElementById('flights-result');
const profileEl = document.getElementById('profile');
const googleLoginBtn = document.getElementById('btn-google-login');

const priceFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR'
});

const fetchOptions = {
  credentials: 'include',
  headers: { Accept: 'application/json' }
};

btnFetch.addEventListener('click', fetchVols);
loadProfile();

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
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object') {
    return [data];
  }
  return [];
}

function createCell(text, className) {
  const cell = document.createElement('td');
  if (className) {
    cell.className = className;
  }
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

function showLoginButton() {
  googleLoginBtn.classList.remove('hidden');
  profileEl.classList.add('hidden');
  profileEl.replaceChildren();
}

function renderProfile(profile) {
  const name = profile.name || profile.nom || 'Utilisateur';
  const email = profile.email || '';
  const picture = profile.picture || profile.photo || profile.avatar || '';

  profileEl.replaceChildren();
  profileEl.classList.remove('hidden');
  googleLoginBtn.classList.add('hidden');

  if (picture) {
    const avatar = document.createElement('img');
    avatar.className = 'profile-avatar';
    avatar.src = picture;
    avatar.alt = 'Photo de profil';
    profileEl.append(avatar);
  }

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

async function loadProfile() {
  try {
    const response = await fetch(PROFILE_URL, fetchOptions);

    if (response.status === 401 || response.status === 403) {
      showLoginButton();
      return;
    }

    if (!response.ok) {
      showLoginButton();
      return;
    }

    renderProfile(await response.json());
  } catch (err) {
    showLoginButton();
  }
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
