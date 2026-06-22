const btnFetch = document.getElementById('btn-fetch');
const resultEl = document.getElementById('result');

btnFetch.addEventListener('click', fetchVols);

async function fetchVols() {
  const url = document.getElementById('api-url').value.trim();

  resultEl.textContent = 'Chargement...';

  try {
    const response = await fetch(url, {
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
      + '\n\n(L\'API est-elle démarrée ? CORS activé si le front est servi ailleurs ?)';
  }
}
