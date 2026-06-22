const API_URL = 'http://localhost:8080/api/vol';

const btnFetch = document.getElementById('btn-fetch');
const resultEl = document.getElementById('result');

btnFetch.addEventListener('click', fetchVols);

async function fetchVols() {
  resultEl.textContent = 'Chargement...';

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    const body = await response.text();

    if (!response.ok) {
      resultEl.textContent = 'Erreur HTTP ' + response.status + '\n\n' + body;
      return;
    }

    const vols = JSON.parse(body);
    resultEl.textContent = JSON.stringify(vols, null, 2);
  } catch (err) {
    resultEl.textContent = 'Erreur : ' + err.message
      + '\n\nL\'API injoignable';
  }
}
