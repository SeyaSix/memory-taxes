'use strict';

const DB_NAME = 'budget-urssaf-db';
const DB_VERSION = 1;
const STORE_ENTRIES = 'entries';
const STORE_SETTINGS = 'settings';
const TAUX_PAR_DEFAUT = 0;

let db = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_ENTRIES)) {
        const store = database.createObjectStore(STORE_ENTRIES, { keyPath: 'id', autoIncrement: true });
        store.createIndex('mois', 'mois', { unique: false });
        store.createIndex('client', 'client', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
        database.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

function runTransaction(storeName, mode, callback) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllEntries() {
  return runTransaction(STORE_ENTRIES, 'readonly', (store) => store.getAll());
}

function addEntry(entry) {
  return runTransaction(STORE_ENTRIES, 'readwrite', (store) => store.add(entry));
}

function updateEntry(entry) {
  return runTransaction(STORE_ENTRIES, 'readwrite', (store) => store.put(entry));
}

function deleteEntry(id) {
  return runTransaction(STORE_ENTRIES, 'readwrite', (store) => store.delete(id));
}

function getSetting(key) {
  return runTransaction(STORE_SETTINGS, 'readonly', (store) => store.get(key));
}

function setSetting(key, value) {
  return runTransaction(STORE_SETTINGS, 'readwrite', (store) => store.put({ key, value }));
}

function clearStore(storeName) {
  return runTransaction(storeName, 'readwrite', (store) => store.clear());
}

function putEntryRaw(entry) {
  return runTransaction(STORE_ENTRIES, 'readwrite', (store) => store.put(entry));
}

const formatEuro = (nombre) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(nombre || 0);

const formatMois = (moisStr) => {
  if (!moisStr) return '';
  const [annee, mois] = moisStr.split('-');
  const date = new Date(Number(annee), Number(mois) - 1, 1);
  const libelle = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return libelle.charAt(0).toUpperCase() + libelle.slice(1);
};

const form = document.getElementById('entry-form');
const formTitle = document.getElementById('form-title');
const inputId = document.getElementById('entry-id');
const inputMois = document.getElementById('mois');
const inputClient = document.getElementById('client');
const inputCa = document.getElementById('ca');
const inputTaux = document.getElementById('taux');
const clientsList = document.getElementById('clients-list');
const btnSubmit = document.getElementById('btn-submit');
const btnCancel = document.getElementById('btn-cancel');

const inputTauxDefaut = document.getElementById('taux-defaut');
const btnSaveTaux = document.getElementById('btn-save-taux');
const tauxMsg = document.getElementById('taux-msg');

const btnGear = document.getElementById('btn-gear');
const settingsPanel = document.getElementById('settings-panel');
const settingsBackdrop = document.getElementById('settings-backdrop');
const btnCloseSettings = document.getElementById('btn-close-settings');

const btnExportJson = document.getElementById('btn-export-json');
const btnImportJson = document.getElementById('btn-import-json');
const inputImportJson = document.getElementById('input-import-json');
const importMsg = document.getElementById('import-msg');

const pdfAnneeSelect = document.getElementById('pdf-annee');
const btnExportPdf = document.getElementById('btn-export-pdf');
const printableReport = document.getElementById('printable-report');

const filtreMois = document.getElementById('filtre-mois');
const filtreClient = document.getElementById('filtre-client');

const entriesBody = document.getElementById('entries-body');
const emptyMsg = document.getElementById('empty-msg');
const monthsBody = document.getElementById('months-body');

const totalCaEl = document.getElementById('total-ca');
const totalUrssafEl = document.getElementById('total-urssaf');
const totalNetEl = document.getElementById('total-net');

let toutesLesEntrees = [];

function calculerUrssaf(ca, taux) {
  return (ca * taux) / 100;
}

function calculerNet(ca, taux) {
  return ca - calculerUrssaf(ca, taux);
}

function remplirFiltres(entries) {
  const moisUniques = [...new Set(entries.map((e) => e.mois))].sort().reverse();
  const clientsUniques = [...new Set(entries.map((e) => e.client))].sort();

  const moisSelectionne = filtreMois.value;
  filtreMois.innerHTML = '<option value="">Tous les mois</option>';
  moisUniques.forEach((mois) => {
    const option = document.createElement('option');
    option.value = mois;
    option.textContent = formatMois(mois);
    filtreMois.appendChild(option);
  });
  filtreMois.value = moisUniques.includes(moisSelectionne) ? moisSelectionne : '';

  clientsList.innerHTML = '';
  clientsUniques.forEach((client) => {
    const option = document.createElement('option');
    option.value = client;
    clientsList.appendChild(option);
  });
}

function obtenirEntreesFiltrees() {
  const moisChoisi = filtreMois.value;
  const clientRecherche = filtreClient.value.trim().toLowerCase();

  return toutesLesEntrees.filter((entry) => {
    const okMois = !moisChoisi || entry.mois === moisChoisi;
    const okClient = !clientRecherche || entry.client.toLowerCase().includes(clientRecherche);
    return okMois && okClient;
  });
}

function afficherTableauEntrees() {
  const entries = obtenirEntreesFiltrees()
    .slice()
    .sort((a, b) => (a.mois < b.mois ? 1 : a.mois > b.mois ? -1 : a.client.localeCompare(b.client)));

  entriesBody.innerHTML = '';
  emptyMsg.hidden = entries.length > 0;

  let totalCa = 0;
  let totalUrssaf = 0;

  entries.forEach((entry) => {
    const urssaf = calculerUrssaf(entry.ca, entry.taux);
    const net = entry.ca - urssaf;
    totalCa += entry.ca;
    totalUrssaf += urssaf;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatMois(entry.mois)}</td>
      <td>${escapeHtml(entry.client)}</td>
      <td>${formatEuro(entry.ca)}</td>
      <td>${entry.taux.toFixed(2)} %</td>
      <td>${formatEuro(urssaf)}</td>
      <td>${formatEuro(net)}</td>
      <td>
        <button class="btn-edit" data-id="${entry.id}">Modifier</button>
        <button class="btn-danger" data-id="${entry.id}">Supprimer</button>
      </td>
    `;
    entriesBody.appendChild(tr);
  });

  totalCaEl.textContent = formatEuro(totalCa);
  totalUrssafEl.textContent = formatEuro(totalUrssaf);
  totalNetEl.textContent = formatEuro(totalCa - totalUrssaf);
}

function afficherRecapMois() {
  const parMois = new Map();

  toutesLesEntrees.forEach((entry) => {
    const urssaf = calculerUrssaf(entry.ca, entry.taux);
    const actuel = parMois.get(entry.mois) || { ca: 0, urssaf: 0 };
    actuel.ca += entry.ca;
    actuel.urssaf += urssaf;
    parMois.set(entry.mois, actuel);
  });

  const moisTries = [...parMois.keys()].sort().reverse();

  monthsBody.innerHTML = '';
  moisTries.forEach((mois) => {
    const { ca, urssaf } = parMois.get(mois);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatMois(mois)}</td>
      <td>${formatEuro(ca)}</td>
      <td>${formatEuro(urssaf)}</td>
      <td>${formatEuro(ca - urssaf)}</td>
    `;
    monthsBody.appendChild(tr);
  });
}

function escapeHtml(texte) {
  const div = document.createElement('div');
  div.textContent = texte;
  return div.innerHTML;
}

function remplirSelectAnnees(entries) {
  const anneesUniques = [...new Set(entries.map((e) => e.mois.split('-')[0]))].sort().reverse();
  const anneeSelectionnee = pdfAnneeSelect.value;

  pdfAnneeSelect.innerHTML = '';

  if (anneesUniques.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Aucune donnée';
    pdfAnneeSelect.appendChild(option);
    pdfAnneeSelect.disabled = true;
    btnExportPdf.disabled = true;
    return;
  }

  pdfAnneeSelect.disabled = false;
  btnExportPdf.disabled = false;

  anneesUniques.forEach((annee) => {
    const option = document.createElement('option');
    option.value = annee;
    option.textContent = annee;
    pdfAnneeSelect.appendChild(option);
  });

  pdfAnneeSelect.value = anneesUniques.includes(anneeSelectionnee) ? anneeSelectionnee : anneesUniques[0];
}

async function rafraichirAffichage() {
  toutesLesEntrees = await getAllEntries();
  remplirFiltres(toutesLesEntrees);
  remplirSelectAnnees(toutesLesEntrees);
  afficherTableauEntrees();
  afficherRecapMois();
}

function reinitialiserFormulaire() {
  form.reset();
  inputId.value = '';
  inputTaux.value = inputTauxDefaut.value;
  formTitle.textContent = 'Ajouter une recette';
  btnSubmit.textContent = 'Ajouter';
  btnCancel.hidden = true;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const entry = {
    mois: inputMois.value,
    client: inputClient.value.trim(),
    ca: parseFloat(inputCa.value),
    taux: parseFloat(inputTaux.value),
  };

  if (!entry.client || Number.isNaN(entry.ca) || Number.isNaN(entry.taux)) {
    return;
  }

  if (inputId.value) {
    entry.id = Number(inputId.value);
    await updateEntry(entry);
  } else {
    await addEntry(entry);
  }

  reinitialiserFormulaire();
  await rafraichirAffichage();
});

btnCancel.addEventListener('click', () => {
  reinitialiserFormulaire();
});

entriesBody.addEventListener('click', async (event) => {
  const target = event.target;
  const id = Number(target.dataset.id);
  if (!id) return;

  if (target.classList.contains('btn-danger')) {
    if (confirm('Supprimer cette recette ?')) {
      await deleteEntry(id);
      await rafraichirAffichage();
    }
  }

  if (target.classList.contains('btn-edit')) {
    const entry = toutesLesEntrees.find((e) => e.id === id);
    if (!entry) return;

    inputId.value = entry.id;
    inputMois.value = entry.mois;
    inputClient.value = entry.client;
    inputCa.value = entry.ca;
    inputTaux.value = entry.taux;

    formTitle.textContent = 'Modifier la recette';
    btnSubmit.textContent = 'Enregistrer les modifications';
    btnCancel.hidden = false;

    window.scrollTo({ top: form.offsetTop - 20, behavior: 'smooth' });
  }
});

filtreMois.addEventListener('change', afficherTableauEntrees);
filtreClient.addEventListener('input', afficherTableauEntrees);

btnSaveTaux.addEventListener('click', async () => {
  const valeur = parseFloat(inputTauxDefaut.value);
  if (Number.isNaN(valeur)) return;

  await setSetting('tauxDefaut', valeur);
  inputTaux.value = valeur;

  tauxMsg.textContent = 'Taux enregistré ✓';
  setTimeout(() => (tauxMsg.textContent = ''), 2000);
});

function ouvrirPanneauReglages() {
  settingsPanel.hidden = false;
  settingsBackdrop.hidden = false;
}

function fermerPanneauReglages() {
  settingsPanel.hidden = true;
  settingsBackdrop.hidden = true;
}

btnGear.addEventListener('click', ouvrirPanneauReglages);
btnCloseSettings.addEventListener('click', fermerPanneauReglages);
settingsBackdrop.addEventListener('click', fermerPanneauReglages);

btnExportJson.addEventListener('click', async () => {
  const entries = await getAllEntries();
  const tauxEnregistre = await getSetting('tauxDefaut');

  const donnees = {
    version: 1,
    exporteLe: new Date().toISOString(),
    tauxDefaut: tauxEnregistre ? tauxEnregistre.value : TAUX_PAR_DEFAUT,
    entries,
  };

  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateFichier = new Date().toISOString().slice(0, 10);

  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `budget-urssaf-export-${dateFichier}.json`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
});

btnImportJson.addEventListener('click', () => {
  inputImportJson.click();
});

inputImportJson.addEventListener('change', async (event) => {
  const fichier = event.target.files[0];
  if (!fichier) return;

  try {
    const texte = await fichier.text();
    const donnees = JSON.parse(texte);

    if (!Array.isArray(donnees.entries)) {
      throw new Error('Format invalide : la clé "entries" est manquante ou invalide.');
    }

    const confirmation = confirm(
      `Importer ${donnees.entries.length} recette(s) ? Cela remplacera toutes les données actuellement enregistrées.`
    );
    if (!confirmation) {
      inputImportJson.value = '';
      return;
    }

    await clearStore(STORE_ENTRIES);
    for (const entry of donnees.entries) {
      await putEntryRaw(entry);
    }

    if (typeof donnees.tauxDefaut === 'number') {
      await setSetting('tauxDefaut', donnees.tauxDefaut);
      inputTauxDefaut.value = donnees.tauxDefaut.toFixed(2);
      inputTaux.value = donnees.tauxDefaut.toFixed(2);
    }

    await rafraichirAffichage();

    importMsg.textContent = 'Import réussi ✓';
    setTimeout(() => (importMsg.textContent = ''), 2500);
  } catch (erreur) {
    alert(`Échec de l'import : ${erreur.message}`);
  } finally {
    inputImportJson.value = '';
  }
});

btnExportPdf.addEventListener('click', () => {
  const annee = pdfAnneeSelect.value;
  if (!annee) return;

  const entreesAnnee = toutesLesEntrees
    .filter((e) => e.mois.startsWith(annee))
    .slice()
    .sort((a, b) => (a.mois < b.mois ? -1 : a.mois > b.mois ? 1 : a.client.localeCompare(b.client)));

  let totalCa = 0;
  let totalUrssaf = 0;

  const lignes = entreesAnnee.map((entry) => {
    const urssaf = calculerUrssaf(entry.ca, entry.taux);
    const net = entry.ca - urssaf;
    totalCa += entry.ca;
    totalUrssaf += urssaf;

    return `
      <tr>
        <td>${formatMois(entry.mois)}</td>
        <td>${escapeHtml(entry.client)}</td>
        <td>${formatEuro(entry.ca)}</td>
        <td>${entry.taux.toFixed(2)} %</td>
        <td>${formatEuro(urssaf)}</td>
        <td>${formatEuro(net)}</td>
      </tr>
    `;
  }).join('');

  printableReport.innerHTML = `
    <h1>Bilan URSSAF — Année ${annee}</h1>
    <p class="pdf-date">Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
    <table>
      <thead>
        <tr>
          <th>Mois</th>
          <th>Client</th>
          <th>CA (€)</th>
          <th>Taux</th>
          <th>URSSAF (€)</th>
          <th>Net (€)</th>
        </tr>
      </thead>
      <tbody>
        ${lignes || '<tr><td colspan="6">Aucune recette pour cette année.</td></tr>'}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total</td>
          <td>${formatEuro(totalCa)}</td>
          <td></td>
          <td>${formatEuro(totalUrssaf)}</td>
          <td>${formatEuro(totalCa - totalUrssaf)}</td>
        </tr>
      </tfoot>
    </table>
  `;

  window.print();
});

async function init() {
  await openDatabase();

  const tauxEnregistre = await getSetting('tauxDefaut');
  const tauxInitial = tauxEnregistre ? tauxEnregistre.value : TAUX_PAR_DEFAUT;
  inputTauxDefaut.value = tauxInitial.toFixed(2);
  inputTaux.value = tauxInitial.toFixed(2);

  const maintenant = new Date();
  inputMois.value = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;

  await rafraichirAffichage();
}

init();
