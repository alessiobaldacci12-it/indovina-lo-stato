let databaseStati = [];
let statoTarget = null;
let tentativiEffettuati = new Set();
let maxTentativi = 10;
let modalitaCorrente = 'daily';
let giocoConcluso = false;

document.addEventListener("DOMContentLoaded", () => {
  inizializzaEventi();
  inizializzaGioco();
});

function inizializzaEventi() {
  document.getElementById("btnInvia").addEventListener("click", inviaTentativo);
  document.getElementById("btnArrendo").addEventListener("click", miArrendo);
  document.getElementById("inputStato").addEventListener("keypress", (e) => {
    if (e.key === "Enter") inviaTentativo();
  });

  const modalRegole = document.getElementById("modalRegole");
  document.getElementById("btnRegole").onclick = () => modalRegole.style.display = "block";
  document.getElementById("closeRegole").onclick = () => modalRegole.style.display = "none";

  const modalStats = document.getElementById("modalStats");
  document.getElementById("btnStats").onclick = () => {
    aggiornaUIStatistiche();
    modalStats.style.display = "block";
  };
  document.getElementById("closeStats").onclick = () => modalStats.style.display = "none";

  window.onclick = (e) => {
    if (e.target === modalRegole) modalRegole.style.display = "none";
    if (e.target === modalStats) modalStats.style.display = "none";
  };

  document.getElementById("btnModeDaily").onclick = () => cambiaModalita('daily');
  document.getElementById("btnModeInfinite").onclick = () => cambiaModalita('infinite');
}

async function inizializzaGioco() {
  try {
    if (!databaseStati.length) {
      const response = await fetch("stati.json");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      databaseStati = await response.json();

      const datalist = document.getElementById("listaStati");
      datalist.innerHTML = "";
      databaseStati.forEach(s => {
        const option = document.createElement("option");
        option.value = s.nome;
        datalist.appendChild(option);
      });
    }

    resetStatoPartita();

    if (modalitaCorrente === 'daily') {
      const oggi = new Date().toISOString().slice(0, 10);
      const seed = generaSeedDaStringa(oggi);
      const indiceTarget = Math.abs(seed) % databaseStati.length;
      statoTarget = databaseStati[indiceTarget];
    } else {
      const indiceCasuale = Math.floor(Math.random() * databaseStati.length);
      statoTarget = databaseStati[indiceCasuale];
    }

  } catch (error) {
    console.error("Errore durante l'inizializzazione:", error);
    alert("Impossibile caricare stati.json. Assicurati che il file sia servito correttamente tramite web server.");
  }
}

function resetStatoPartita() {
  tentativiEffettuati.clear();
  giocoConcluso = false;
  document.getElementById("tabellaTentativi").querySelector("tbody").innerHTML = "";
  document.getElementById("attemptsLeft").textContent = maxTentativi;
  document.getElementById("inputStato").disabled = false;
  document.getElementById("btnInvia").disabled = false;
  document.getElementById("btnArrendo").disabled = false;
}

function cambiaModalita(mode) {
  if (modalitaCorrente === mode) return;
  modalitaCorrente = mode;
  document.getElementById("btnModeDaily").classList.toggle("active", mode === 'daily');
  document.getElementById("btnModeInfinite").classList.toggle("active", mode === 'infinite');
  inizializzaGioco();
}

function generaSeedDaStringa(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function formattaFusoOrario(fuso) {
  if (fuso === 0) return "UTC";
  const segno = fuso > 0 ? "+" : "";
  return `UTC${segno}${fuso}`;
}

function valutaTentativo(statoGuess, statoTarget) {
  const continenteOk = statoGuess.continente === statoTarget.continente;
  const governoOk = statoGuess.governo === statoTarget.governo;

  const coloriOk = statoGuess.colori_bandiera === statoTarget.colori_bandiera;
  const frecciaColori = coloriOk ? "" : (statoTarget.colori_bandiera > statoGuess.colori_bandiera ? " ⬆️" : " ⬇️");

  const fusoOk = statoGuess.fuso_orario === statoTarget.fuso_orario;
  const frecciaFuso = fusoOk ? "" : (statoTarget.fuso_orario > statoGuess.fuso_orario ? " ➡️" : " ⬅️");

  const confiniOk = statoGuess.confini === statoTarget.confini;
  const frecciaConfini = confiniOk ? "" : (statoTarget.confini > statoGuess.confini ? " ⬆️" : " ⬇️");

  const mareOk = statoGuess.sbocco_mare === statoTarget.sbocco_mare;

  return {
    nome: statoGuess.nome,
    continente: { valore: statoGuess.continente, esito: continenteOk ? "verde" : "rosso" },
    governo: { valore: statoGuess.governo, esito: governoOk ? "verde" : "rosso" },
    colori_bandiera: { valore: `${statoGuess.colori_bandiera}${frecciaColori}`, esito: coloriOk ? "verde" : "rosso" },
    fuso_orario: { valore: `${formattaFusoOrario(statoGuess.fuso_orario)}${frecciaFuso}`, esito: fusoOk ? "verde" : "rosso" },
    confini: { valore: `${statoGuess.confini}${frecciaConfini}`, esito: confiniOk ? "verde" : "rosso" },
    sbocco_mare: { valore: statoGuess.sbocco_mare ? "Sì" : "No", esito: mareOk ? "verde" : "rosso" }
  };
}

function inviaTentativo() {
  if (giocoConcluso || !databaseStati.length) return;

  const input = document.getElementById("inputStato");
  const nomeStato = input.value.trim();
  const statoGuess = databaseStati.find(s => s.nome.toLowerCase() === nomeStato.toLowerCase());

  if (!statoGuess) {
    alert("Stato non trovato! Seleziona un paese valido dalla lista.");
    return;
  }

  if (tentativiEffettuati.has(statoGuess.id)) {
    alert("Hai già provato questo stato!");
    input.value = "";
    return;
  }

  tentativiEffettuati.add(statoGuess.id);
  const risultato = valutaTentativo(statoGuess, statoTarget);

  input.value = "";
  const rimanenti = maxTentativi - tentativiEffettuati.size;
  document.getElementById("attemptsLeft").textContent = rimanenti;

  aggiungiRigaTabellaProgressiva(risultato, () => {
    if (statoGuess.id === statoTarget.id) {
      concludiPartita(true);
    } else if (rimanenti <= 0) {
      concludiPartita(false);
    }
  });
}

function aggiungiRigaTabellaProgressiva(res, onComplete) {
  const tbody = document.getElementById("tabellaTentativi").querySelector("tbody");
  const tr = document.createElement("tr");

  const celleData = [
    { testo: `<strong>${res.nome}</strong>`, esito: "" },
    { testo: res.continente.valore, esito: res.continente.esito },
    { testo: res.governo.valore, esito: res.governo.esito },
    { testo: res.colori_bandiera.valore, esito: res.colori_bandiera.esito },
    { testo: res.fuso_orario.valore, esito: res.fuso_orario.esito },
    { testo: res.confini.valore, esito: res.confini.esito },
    { testo: res.sbocco_mare.valore, esito: res.sbocco_mare.esito }
  ];

  celleData.forEach((item) => {
    const td = document.createElement("td");
    td.innerHTML = item.testo;
    if (item.esito) td.classList.add(item.esito);
    td.classList.add("cell-flip");
    tr.appendChild(td);
  });

  tbody.insertBefore(tr, tbody.firstChild);

  const tdList = tr.querySelectorAll("td");
  const ritardoTraCelle = 200;

  tdList.forEach((td, index) => {
    td.style.animationDelay = `${index * ritardoTraCelle}ms`;
  });

  const tempoTotale = (tdList.length * ritardoTraCelle) + 400;
  setTimeout(() => {
    if (onComplete) onComplete();
  }, tempoTotale);
}

function miArrendo() {
  if (giocoConcluso) return;
  if (confirm("Sei sicuro di volerti arrendere?")) {
    concludiPartita(false, true);
  }
}

function lanciaCoriandoli() {
  if (typeof confetti === "function") {
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }
}

function concludiPartita(vittoria, arreso = false) {
  giocoConcluso = true;
  document.getElementById("inputStato").disabled = true;
  document.getElementById("btnInvia").disabled = true;
  document.getElementById("btnArrendo").disabled = true;

  aggiornaStatisticheLS(vittoria);

  if (vittoria) {
    lanciaCoriandoli();
    setTimeout(() => {
      alert(`Complimenti! Hai indovinato lo stato (${statoTarget.nome}) in ${tentativiEffettuati.size} tentativi!`);
    }, 500);
  } else {
    setTimeout(() => {
      alert(`${arreso ? 'Ti sei arreso.' : 'Tentativi esauriti!'} Lo stato segreto era: ${statoTarget.nome}.`);
    }, 200);
  }
}

function aggiornaStatisticheLS(vittoria) {
  let stats = JSON.parse(localStorage.getItem("letterando_stats")) || { giocate: 0, vinte: 0, striscia: 0 };
  stats.giocate += 1;
  if (vittoria) {
    stats.vinte += 1;
    stats.striscia += 1;
  } else {
    stats.striscia = 0;
  }
  localStorage.setItem("letterando_stats", JSON.stringify(stats));
}

function aggiornaUIStatistiche() {
  const stats = JSON.parse(localStorage.getItem("letterando_stats")) || { giocate: 0, vinte: 0, striscia: 0 };
  document.getElementById("statPlayed").textContent = stats.giocate;
  document.getElementById("statWon").textContent = stats.vinte;
  document.getElementById("statStreak").textContent = stats.striscia;
}