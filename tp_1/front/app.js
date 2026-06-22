const API_URL = 'http://localhost:8080/api/vol';

const btnFetch = document.getElementById('btn-fetch');
const resultEl = document.getElementById('result');

const priceFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR'
});

btnFetch.addEventListener('click', fetchVols);

function showLoading() {
  btnFetch.disabled = true;
  resultEl.className = 'loading';
  resultEl.replaceChildren();

  const spinner = document.createElement('div');
  spinner.className = 'spinner';

  const label = document.createElement('span');
  label.textContent = 'Chargement des vols…';

  resultEl.append(spinner, label);
}

function showError(title, detail) {
  btnFetch.disabled = false;
  resultEl.className = 'error';

  const heading = document.createElement('strong');
  heading.textContent = title;

  const message = document.createElement('p');
  message.textContent = detail;

  resultEl.replaceChildren(heading, message);
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
  resultEl.className = '';
  resultEl.replaceChildren();

  if (!vols.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Aucun vol disponible.';
    resultEl.append(empty);
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
  resultEl.append(wrapper);
}

async function fetchVols() {
  showLoading();

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      showError('Impossible de récupérer les vols', 'Erreur HTTP ' + response.status);
      return;
    }

    const data = await response.json();
    renderFlights(normalizeVols(data));
  } catch (err) {
    showError('Connexion impossible', 'Vérifiez que l\'API est démarrée sur le port 8080.');
  }
}
