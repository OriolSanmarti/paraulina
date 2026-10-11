"use strict";

const LLETRES = 5, INTENTS = 6, VIDES_PENJAT = 6, VIDES_ANAGRAMA = 3;
const T_GIR = 300; // ms entre casella i casella en revelar una fila
const NOMS_NIVELL = { facil: "Fàcil", mitja: "Mitjà", dificil: "Difícil" };
// Amb ?prova a l'adreça no hi ha límit de partides diàries (per provar el joc)
const PROVA = new URLSearchParams(location.search).has("prova");

// Treu accents i dièresis però manté la ç com a lletra pròpia
const normalitza = w => w.toLowerCase().replace(/ç/g, "#").normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/#/g, "ç");

// Mapa forma normalitzada -> forma amb accents (per mostrar-la bé)
const DICC = new Map();
for (const w of VALIDES) { const n = normalitza(w); if (!DICC.has(n)) DICC.set(n, w); }
for (const k in SOLUCIONS) for (const w of SOLUCIONS[k]) DICC.set(normalitza(w), w);

const $ = id => document.getElementById(id);
const desa = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const llegeix = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const barreja = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ================= Progrés =================
const dataClau = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const avui = () => dataClau(new Date());
const ahir = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dataClau(d); };

const ESTAT_INICIAL = {
  nivell: 1,          // nivell que toca jugar
  estrelles: {},      // nivell -> 1..3
  dia: "", partides: 1, // partides disponibles el dia "dia"
  enCurs: null,       // partida començada (sobreviu a recarregar la pàgina)
  usades: [],         // paraules ja sortides
  ratxaDies: 0, millorRatxa: 0, ultimDia: "",
  dist: [0, 0, 0, 0, 0, 0], // intents de les Paraulines guanyades
};
let estat = { ...ESTAT_INICIAL, ...llegeix("paraulina-v2", {}) };
const desaEstat = () => desa("paraulina-v2", estat);

function renovaDia() {
  if (estat.dia !== avui()) { estat.dia = avui(); estat.partides = 1; desaEstat(); }
}
const tipusNivell = n => n % 10 !== 0 ? "paraulina" : (n / 10) % 2 === 1 ? "penjat" : "anagrama";
const dificultat = n => n <= 30 ? "facil" : n <= 70 ? "mitja" : "dificil";
const totalEstrelles = () => Object.values(estat.estrelles).reduce((a, b) => a + b, 0);

function triaParaula(llista) {
  const lliures = llista.filter(w => !estat.usades.includes(w));
  const pool = lliures.length ? lliures : llista;
  const w = pool[Math.floor(Math.random() * pool.length)];
  estat.usades.push(w);
  return w;
}

// ================= Navegació =================
let teclaActiva = null; // qui rep el teclat físic a la pantalla actual

function mostraPantalla(id) {
  for (const p of document.querySelectorAll(".pantalla")) p.hidden = p.id !== id;
}

function mostraMapa(nouNivell) {
  teclaActiva = null;
  mostraPantalla("pMapa");
  pintaMapa(nouNivell);
}

function entraNivell(n) {
  renovaDia();
  if (n !== estat.nivell) return;
  if (!(estat.enCurs && estat.enCurs.nivell === n)) {
    if (estat.partides <= 0 && !PROVA) return obreTornaDema();
    if (!PROVA) estat.partides--;
    const tipus = tipusNivell(n);
    const paraula = tipus === "paraulina" ? triaParaula(SOLUCIONS[dificultat(n)]) : triaParaula(ESPECIALS[tipus]);
    estat.enCurs = { nivell: n, tipus, paraula, jugades: [] };
    if (estat.ultimDia !== avui()) {
      estat.ratxaDies = estat.ultimDia === ahir() ? estat.ratxaDies + 1 : 1;
      estat.millorRatxa = Math.max(estat.millorRatxa, estat.ratxaDies);
      estat.ultimDia = avui();
    }
    desaEstat();
  }
  const p = estat.enCurs;
  if (p.tipus === "paraulina") iniciaParaulina(p);
  else if (p.tipus === "penjat") iniciaPenjat(p);
  else iniciaAnagrama(p);
}

// Es crida en acabar qualsevol joc
function acabaNivell({ guanyat, estrelles = 0, extra = false, paraula, emoji, titol }) {
  const n = estat.enCurs.nivell;
  estat.enCurs = null;
  if (guanyat) {
    estat.estrelles[n] = Math.max(estat.estrelles[n] || 0, estrelles);
    estat.nivell = n + 1;
    if (extra) estat.partides++;
  }
  desaEstat();
  publicaProgres();

  $("fiEmoji").textContent = emoji;
  $("fiTitol").textContent = titol;
  $("fiEstrelles").innerHTML = guanyat
    ? [1, 2, 3].map(i => `<span class="${i <= estrelles ? "" : "buida"}" style="animation-delay:${.2 + i * .15}s">⭐</span>`).join("")
    : "";
  $("fiSub").textContent = guanyat ? `Nivell ${n} superat · la paraula era` : `Nivell ${n} · la paraula era`;
  $("fiParaula").innerHTML = [...paraula].map(l => `<div class="cel ${guanyat ? "verd" : "gris"}">${l}</div>`).join("");
  const ex = $("fiExtra");
  ex.hidden = false;
  if (guanyat && extra) ex.textContent = "🎟️ Partida extra guanyada! Pots jugar el següent nivell ara mateix.";
  else if (estat.partides > 0 || PROVA) ex.textContent = `🎟️ Encara tens ${PROVA ? "partides il·limitades (mode prova)" : estat.partides === 1 ? "1 partida" : estat.partides + " partides"} per avui.`;
  else ex.textContent = guanyat
    ? "Has fet la partida d'avui. Demà, més! (Encerta en 3 intents o menys per guanyar-ne una d'extra.)"
    : "Demà podràs tornar a provar aquest nivell amb una paraula nova.";
  $("btnContinua").onclick = () => { $("dlgFi").close(); mostraMapa(guanyat ? n + 1 : 0); };
  $("dlgFi").showModal();
}

// ================= Mapa =================
function pintaMapa(nouNivell) {
  renovaDia();
  const cami = $("cami"); cami.innerHTML = "";
  const fins = Math.ceil((estat.nivell + 6) / 10) * 10;
  for (let n = 1; n <= fins; n++) {
    if ((n - 1) % 10 === 0) {
      const s = (n - 1) / 10 + 1, d = dificultat(n);
      const cap = document.createElement("div");
      cap.className = "seccio " + d;
      cap.innerHTML = `<div><b>Secció ${s}</b><small>${NOMS_NIVELL[d]} · nivells ${n}–${n + 9}</small></div><span class="num">${s}</span>`;
      cami.appendChild(cap);
    }
    const tipus = tipusNivell(n), especial = tipus !== "paraulina";
    const o = Math.sin((n - 1) * 0.9);
    const fila = document.createElement("div");
    fila.className = "node-fila" + (especial ? " gran" : "") + (o > 0.35 ? " esquerra" : "");
    fila.style.setProperty("--o", o.toFixed(3));
    const b = document.createElement("button");
    const estatNode = n < estat.nivell ? "fet" : n === estat.nivell ? "actual" : "bloquejat";
    b.className = `node ${estatNode}${especial ? " especial" : ""}${n === nouNivell ? " nou" : ""}`;
    b.textContent = especial ? (tipus === "penjat" ? "🪢" : "🔀") : n;
    b.setAttribute("aria-label", `Nivell ${n}${especial ? (tipus === "penjat" ? ", Penjat" : ", Anagrama") : ""}${estatNode === "fet" ? ", superat" : estatNode === "bloquejat" ? ", bloquejat" : ""}`);
    if (estatNode === "fet") {
      const e = estat.estrelles[n] || 1;
      b.insertAdjacentHTML("beforeend", `<span class="estrelles">${[1, 2, 3].map(i => `<span class="${i <= e ? "" : "buida"}">⭐</span>`).join("")}</span>`);
    }
    if (estatNode === "actual") {
      const continua = estat.enCurs && estat.enCurs.nivell === n;
      b.insertAdjacentHTML("beforeend", `<span class="bombolla">${continua ? "CONTINUA" : especial ? "REPTE!" : "JUGA"}</span>`);
      b.id = "nodeActual";
    }
    b.addEventListener("click", () => {
      if (estatNode === "actual") entraNivell(n);
      else if (estatNode === "bloquejat") avisa(`🔒 Supera el nivell ${estat.nivell} per arribar-hi`);
      else avisa(`Nivell ${n} superat amb ${estat.estrelles[n] || 1} ⭐`);
    });
    fila.appendChild(b);
    const av = document.createElement("div");
    av.className = "avatars"; av.dataset.nivell = n;
    fila.appendChild(av);
    cami.appendChild(fila);
  }
  actualitzaXips();
  pintaAmicsAlMapa();
  requestAnimationFrame(() => {
    const nd = $("nodeActual"); if (!nd) return;
    const sc = $("scrollMapa");
    sc.scrollTop = nd.closest(".node-fila").offsetTop - sc.clientHeight / 2 + 40;
  });
}

let tCompte;
function actualitzaXips() {
  renovaDia();
  $("ratxaDies").textContent = estat.ratxaDies && (estat.ultimDia === avui() || estat.ultimDia === ahir()) ? estat.ratxaDies : 0;
  $("totalEstrelles").textContent = totalEstrelles();
  const xp = $("xipPartides");
  clearInterval(tCompte);
  const pinta = () => {
    if (PROVA) { xp.innerHTML = "🎟️ ∞"; return; }
    if (estat.partides > 0 || (estat.enCurs && estat.enCurs.nivell === estat.nivell)) {
      xp.classList.remove("apagat");
      xp.innerHTML = `🎟️ <span>${estat.partides}</span>`;
    } else {
      xp.classList.add("apagat");
      xp.innerHTML = `⏳ <span>${tempsFinsDema()}</span>`;
    }
  };
  pinta();
  tCompte = setInterval(() => { if (estat.dia !== avui()) { renovaDia(); pintaMapa(); } else pinta(); }, 1000);
}
function tempsFinsDema() {
  const ara = new Date(), dema = new Date(ara); dema.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((dema - ara) / 1000));
  return [s / 3600, (s % 3600) / 60, s % 60].map(x => String(Math.floor(x)).padStart(2, "0")).join(":");
}
let tDema;
function obreTornaDema() {
  const pinta = () => { $("compteEnrere").textContent = tempsFinsDema(); };
  pinta(); clearInterval(tDema); tDema = setInterval(pinta, 1000);
  $("dlgDema").showModal();
}

// ================= Teclat compartit =================
const FILES_TECLAT = ["qwertyuiop", "asdfghjklç", "<zxcvbnm>"];
function construeixTeclat(cont, ambControls) {
  cont.innerHTML = "";
  for (const fila of FILES_TECLAT) {
    const f = document.createElement("div"); f.className = "fila-t";
    for (const ch of fila) {
      if ((ch === "<" || ch === ">") && !ambControls) continue;
      const b = document.createElement("button"); b.className = "tecla";
      if (ch === "<") { b.textContent = "Entra"; b.classList.add("ampla", "entra"); b.dataset.k = "Enter"; b.disabled = true; }
      else if (ch === ">") { b.textContent = "⌫"; b.classList.add("ampla"); b.dataset.k = "Backspace"; b.setAttribute("aria-label", "Esborra"); }
      else { b.textContent = ch; b.dataset.k = ch; }
      f.appendChild(b);
    }
    cont.appendChild(f);
  }
  cont.onclick = e => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    b.blur(); teclaActiva?.(b.dataset.k);
  };
}
const tecla = (cont, l) => cont.querySelector(`[data-k="${l}"]`);

// ================= Paraulina =================
const P = {}; // estat de la partida de Paraulina en curs
const paraula = () => P.lletres.join("");
const completa = () => P.lletres.every(l => l);

function iniciaParaulina(partida) {
  Object.assign(P, { partida, sol: partida.paraula, solNorm: normalitza(partida.paraula), fila: 0, acabat: false, historial: [] });
  P.lletres = Array(LLETRES).fill(""); P.cursor = 0;
  const n = partida.nivell;
  $("parTitol").textContent = `Nivell ${n}`;
  $("parSub").textContent = `Paraulina · ${NOMS_NIVELL[dificultat(n)]}`;
  const g = $("graella"); g.innerHTML = "";
  for (let r = 0; r < INTENTS; r++) {
    const f = document.createElement("div"); f.className = "fila";
    for (let c = 0; c < LLETRES; c++) {
      const d = document.createElement("div"); d.className = "cel";
      // Clicar una casella de la fila actual hi posa el cursor
      d.addEventListener("click", () => { if (!P.acabat && r === P.fila) { P.cursor = c; pintaFila(); } });
      f.appendChild(d);
    }
    g.appendChild(f);
  }
  construeixTeclat($("teclatParaulina"), true);
  mostraPantalla("pParaulina");
  // Recupera els intents d'una partida començada abans de recarregar
  for (const intent of partida.jugades) {
    const res = avalua(intent, P.solNorm), cels = g.children[P.fila].children, mostrada = DICC.get(intent) || intent;
    res.forEach((color, i) => { cels[i].textContent = mostrada[i]; cels[i].classList.add(color); pintaTecla(intent[i], color); });
    P.historial.push(res); P.fila++;
  }
  teclaActiva = premParaulina;
  pintaFila();
}

function avalua(intent, sol) {
  const res = Array(LLETRES).fill("gris"), resta = {};
  for (let i = 0; i < LLETRES; i++) {
    if (intent[i] === sol[i]) res[i] = "verd";
    else resta[sol[i]] = (resta[sol[i]] || 0) + 1;
  }
  for (let i = 0; i < LLETRES; i++) {
    if (res[i] !== "verd" && resta[intent[i]] > 0) { res[i] = "groc"; resta[intent[i]]--; }
  }
  return res;
}

function pintaFila() {
  const files = $("graella").children;
  [...files].forEach((f, r) => f.classList.toggle("activa", r === P.fila && !P.acabat));
  const entra = tecla($("teclatParaulina"), "Enter");
  if (P.fila >= INTENTS) { entra.disabled = true; return; }
  const cels = files[P.fila].children;
  const invalida = completa() && !DICC.has(paraula());
  for (let i = 0; i < LLETRES; i++) {
    cels[i].textContent = P.lletres[i];
    cels[i].classList.toggle("plena", !!P.lletres[i]);
    cels[i].classList.toggle("invalida", invalida);
    cels[i].classList.toggle("cursor", i === P.cursor && !P.acabat);
  }
  entra.disabled = P.acabat || !(completa() && DICC.has(paraula()));
}

const PRIORITAT = { gris: 1, groc: 2, verd: 3 };
function pintaTecla(lletra, color) {
  const k = tecla($("teclatParaulina"), lletra); if (!k) return;
  const ara = ["verd", "groc", "gris"].find(c => k.classList.contains(c));
  if (!ara || PRIORITAT[color] > PRIORITAT[ara]) { k.classList.remove("verd", "groc", "gris"); k.classList.add(color); }
}

function premParaulina(k) {
  if (P.acabat) return;
  if (k === "Enter") return enviaParaulina();
  if (k === "ArrowLeft") { P.cursor = Math.max(0, P.cursor - 1); return pintaFila(); }
  if (k === "ArrowRight") { P.cursor = Math.min(LLETRES - 1, P.cursor + 1); return pintaFila(); }
  if (k === "Backspace") {
    // Si la casella té lletra l'esborra; si és buida, esborra la de l'esquerra
    if (!P.lletres[P.cursor] && P.cursor > 0) P.cursor--;
    P.lletres[P.cursor] = "";
    return pintaFila();
  }
  const l = normalitza(k);
  if (/^[a-zç]$/.test(l)) {
    P.lletres[P.cursor] = l;
    // Salta a la següent casella buida de la dreta (o a la següent, si no n'hi ha)
    const buida = P.lletres.findIndex((x, i) => i > P.cursor && !x);
    P.cursor = buida !== -1 ? buida : Math.min(LLETRES - 1, P.cursor + 1);
    pintaFila();
  }
}

function enviaParaulina() {
  const filaEl = $("graella").children[P.fila];
  const intent = paraula();
  if (!completa()) return avisa("Falten lletres", filaEl);
  if (!DICC.has(intent)) return avisa("No és al diccionari", filaEl);

  const res = avalua(intent, P.solNorm);
  const mostrada = intent === P.solNorm ? P.sol : DICC.get(intent);
  const cels = filaEl.children;
  for (const c of cels) c.classList.remove("cursor", "plena");
  // Cada casella gira i canvia de color just quan està de cantell
  res.forEach((color, i) => {
    setTimeout(() => cels[i].classList.add("revela"), i * T_GIR);
    setTimeout(() => { cels[i].textContent = mostrada[i]; cels[i].classList.add(color); }, i * T_GIR + T_GIR);
    setTimeout(() => pintaTecla(intent[i], color), i * T_GIR + 2 * T_GIR);
  });
  P.historial.push(res);
  P.partida.jugades.push(intent); desaEstat();
  const guanyat = intent === P.solNorm;
  P.fila++; P.lletres = Array(LLETRES).fill(""); P.cursor = 0;
  const fiRevelat = (LLETRES + 1) * T_GIR + 100;
  if (guanyat || P.fila === INTENTS) {
    P.acabat = true;
    pintaFila();
    const intents = P.fila;
    if (guanyat) estat.dist[intents - 1]++;
    setTimeout(() => {
      if (guanyat) {
        avisa(["Increïble! 🤯", "Magnífic! ✨", "Molt bé! 🎉", "Bona! 👏", "Per poc! 😅", "Uf, ja hi és! 😮‍💨"][intents - 1]);
        [...cels].forEach((c, i) => setTimeout(() => c.classList.add("salta"), i * 100));
        confeti();
      }
      setTimeout(() => acabaNivell({
        guanyat, paraula: P.sol,
        estrelles: intents <= 2 ? 3 : intents <= 4 ? 2 : 1,
        extra: guanyat && intents <= 3,
        emoji: guanyat ? ["🤯", "🏆", "🎉", "😎", "😅", "😮‍💨"][intents - 1] : "🙈",
        titol: guanyat ? `Encertada en ${intents}/${INTENTS}!` : "Aquesta vegada no...",
      }), guanyat ? 1800 : 600);
    }, fiRevelat);
  } else setTimeout(pintaFila, 0);
}

// ================= Penjat =================
const H = {};
function iniciaPenjat(partida) {
  Object.assign(H, { partida, sol: partida.paraula, solNorm: normalitza(partida.paraula), acabat: false });
  $("penTitol").textContent = `Nivell ${partida.nivell}`;
  $("penForats").innerHTML = [...H.sol].map(() => `<div class="forat"></div>`).join("");
  construeixTeclat($("teclatPenjat"), false);
  for (const l of partida.jugades) marcaLletraPenjat(l);
  mostraPantalla("pPenjat");
  pintaPenjat();
  teclaActiva = premPenjat;
}
const errorsPenjat = () => H.partida.jugades.filter(l => !H.solNorm.includes(l)).length;
function marcaLletraPenjat(l) {
  const k = tecla($("teclatPenjat"), l);
  if (k) { k.classList.add(H.solNorm.includes(l) ? "verd" : "gris"); k.disabled = true; }
}
function pintaPenjat(perdut) {
  const errors = errorsPenjat();
  document.querySelectorAll("#pPenjat .forca .part").forEach((p, i) => p.classList.toggle("visible", i < errors));
  $("penVides").innerHTML = Array.from({ length: VIDES_PENJAT }, (_, i) => `<span class="${i < VIDES_PENJAT - errors ? "" : "perduda"}">❤️</span>`).join("");
  [...$("penForats").children].forEach((f, i) => {
    const encertada = H.partida.jugades.includes(H.solNorm[i]);
    f.textContent = encertada || perdut ? H.sol[i] : "";
    f.classList.toggle("ple", encertada);
    f.classList.toggle("perdut", !!perdut && !encertada);
  });
}
function premPenjat(k) {
  if (H.acabat) return;
  const l = normalitza(k);
  if (!/^[a-zç]$/.test(l) || H.partida.jugades.includes(l)) return;
  H.partida.jugades.push(l); desaEstat();
  marcaLletraPenjat(l);
  const errors = errorsPenjat();
  const guanyat = [...H.solNorm].every(c => H.partida.jugades.includes(c));
  const perdut = errors >= VIDES_PENJAT;
  pintaPenjat(perdut);
  if (!H.solNorm.includes(l)) $("penForats").classList.remove("tremola"), void $("penForats").offsetWidth, $("penForats").classList.add("tremola");
  if (guanyat || perdut) {
    H.acabat = true;
    if (guanyat) confeti();
    setTimeout(() => acabaNivell({
      guanyat, paraula: H.sol,
      estrelles: errors <= 1 ? 3 : errors <= 3 ? 2 : 1,
      extra: guanyat,
      emoji: guanyat ? "🦸" : "🪦",
      titol: guanyat ? (errors === 0 ? "Sense cap error!" : "T'has salvat!") : "T'han penjat...",
    }), guanyat ? 1500 : 1200);
  }
}

// ================= Anagrama =================
const A = {};
function iniciaAnagrama(partida) {
  const solNorm = normalitza(partida.paraula);
  // L'ordre barrejat es guarda perquè no canviï en recarregar
  if (!partida.ordre) {
    let o; do { o = barreja([...solNorm]); } while (o.join("") === solNorm);
    partida.ordre = o; partida.errors = 0; desaEstat();
  }
  Object.assign(A, { partida, sol: partida.paraula, solNorm, ranures: [], acabat: false });
  $("anaTitol").textContent = `Nivell ${partida.nivell}`;
  $("anaRanures").classList.remove("be");
  pintaAnagrama();
  mostraPantalla("pAnagrama");
  teclaActiva = premAnagrama;
}
function pintaAnagrama() {
  const lletres = A.partida.ordre;
  $("anaFitxes").innerHTML = lletres.map((l, i) =>
    `<button class="fitxa${A.ranures.includes(i) ? " usada" : ""}" data-i="${i}" aria-label="Lletra ${l}">${l}</button>`).join("");
  $("anaRanures").innerHTML = lletres.map((_, i) => {
    const idx = A.ranures[i];
    return `<div class="ranura${idx !== undefined ? " plena" : ""}" data-r="${i}">${idx !== undefined ? lletres[idx] : ""}</div>`;
  }).join("");
  $("anaVides").innerHTML = Array.from({ length: VIDES_ANAGRAMA }, (_, i) => `<span class="${i < VIDES_ANAGRAMA - A.partida.errors ? "" : "perduda"}">❤️</span>`).join("");
  $("anaComprova").disabled = A.ranures.length !== lletres.length || A.acabat;
}
$("anaFitxes").addEventListener("click", e => {
  const b = e.target.closest(".fitxa"); if (!b || A.acabat) return;
  A.ranures.push(+b.dataset.i); pintaAnagrama();
});
$("anaRanures").addEventListener("click", e => {
  const r = e.target.closest(".ranura"); if (!r || A.acabat) return;
  const i = +r.dataset.r; if (i < A.ranures.length) { A.ranures.splice(i, 1); pintaAnagrama(); }
});
$("anaBarreja").addEventListener("click", () => {
  if (A.acabat) return;
  A.partida.ordre = barreja(A.partida.ordre); A.ranures = []; desaEstat(); pintaAnagrama();
});
$("anaEsborra").addEventListener("click", () => { if (!A.acabat) { A.ranures.pop(); pintaAnagrama(); } });
$("anaComprova").addEventListener("click", comprovaAnagrama);
function premAnagrama(k) {
  if (A.acabat) return;
  if (k === "Enter") return comprovaAnagrama();
  if (k === "Backspace") { A.ranures.pop(); return pintaAnagrama(); }
  const l = normalitza(k);
  const i = A.partida.ordre.findIndex((x, j) => x === l && !A.ranures.includes(j));
  if (i !== -1) { A.ranures.push(i); pintaAnagrama(); }
}
function comprovaAnagrama() {
  if (A.acabat || A.ranures.length !== A.partida.ordre.length) return;
  const intent = A.ranures.map(i => A.partida.ordre[i]).join("");
  const valides = (ESPECIALS.anagramesValids[A.sol] || []);
  const guanyat = intent === A.solNorm || valides.includes(intent);
  if (!guanyat) {
    A.partida.errors++; desaEstat();
    const perdut = A.partida.errors >= VIDES_ANAGRAMA;
    avisa(perdut ? "Sense vides!" : "No és aquesta. Torna-hi!", $("anaRanures"));
    A.ranures = [];
    if (perdut) A.acabat = true;
    pintaAnagrama();
    if (perdut) setTimeout(() => acabaNivell({ guanyat: false, paraula: A.sol, emoji: "🌀", titol: "Quin embolic!" }), 900);
    return;
  }
  A.acabat = true;
  pintaAnagrama();
  $("anaRanures").classList.add("be");
  confeti();
  const errors = A.partida.errors;
  const alternativa = intent !== A.solNorm;
  setTimeout(() => acabaNivell({
    guanyat: true, paraula: alternativa ? (DICC.get(intent) || intent) : A.sol,
    estrelles: 3 - errors, extra: true,
    emoji: "🧠", titol: alternativa ? "Aquesta també val!" : errors === 0 ? "A la primera!" : "Desembolicat!",
  }), 1500);
}

// ================= Avisos i confeti =================
let tAvis;
function avisa(text, el) {
  const a = $("avis"); a.textContent = text; a.classList.add("visible");
  clearTimeout(tAvis); tAvis = setTimeout(() => a.classList.remove("visible"), 1800);
  if (el) { el.classList.remove("tremola"); void el.offsetWidth; el.classList.add("tremola"); }
}

function confeti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = $("confeti"), ctx = cv.getContext("2d");
  const dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(document.documentElement);
  const colors = ["--verd", "--groc", "--accent", "--lila"].map(v => css.getPropertyValue(v).trim());
  const ps = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .35,
    vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
    r: Math.random() * 6, vr: (Math.random() - .5) * .3,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const inici = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (t - inici < 3200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(inici);
}

// ================= Estadístiques =================
function obreStats() {
  const guanyades = estat.dist.reduce((a, b) => a + b, 0), max = Math.max(1, ...estat.dist);
  $("statsCos").innerHTML = `<div class="stats">
      <div><b>${estat.nivell - 1}</b><small>Nivells</small></div>
      <div><b>${totalEstrelles()}</b><small>Estrelles</small></div>
      <div><b>${$("ratxaDies").textContent}</b><small>Ratxa dies</small></div>
      <div><b>${estat.millorRatxa}</b><small>Millor ratxa</small></div>
    </div>
    <h3>Paraulines encertades (${guanyades}) per intents</h3>
    <div class="dist">${estat.dist.map((v, i) => `<div>${i + 1}<span style="width:${8 + 82 * v / max}%">${v}</span></div>`).join("")}</div>`;
  $("dlgStats").showModal();
}

// ================= Amics =================
// Dos connectors possibles amb la mateixa forma:
//  - Firebase, quan el joc és a GitHub Pages (cal omplir firebase-config.js)
//  - la base de dades de claude.ai, quan el joc està publicat com a artifact
// Cada jugador desa el seu progrés a jugadors/<id> i tothom llegeix la col·lecció.
const amics = { con: null, llista: [], publicat: null };
const nomJugador = () => llegeix("paraulina-nom", "");

function avatarInicial(nom, id) {
  const colors = ["#2fae74", "#e9a21f", "#ff6b5b", "#8a6cf0", "#3fa7e0", "#e06bb0"];
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const lletra = ([...nom.trim()][0] || "?").toUpperCase().replace(/[<>&"']/g, "?");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${colors[h % colors.length]}"/>` +
    `<text x="20" y="27" font-family="Arial,sans-serif" font-size="19" font-weight="700" fill="#fff" text-anchor="middle">${lletra}</text></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

async function connectaFirebase() {
  if (typeof FIREBASE_CONFIG === "undefined" || !FIREBASE_CONFIG) return null;
  const V = "https://www.gstatic.com/firebasejs/10.12.2/";
  const [{ initializeApp }, fa, fs] = await Promise.all([
    import(V + "firebase-app.js"), import(V + "firebase-auth.js"), import(V + "firebase-firestore.js"),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = fa.getAuth(app);
  // Es comença amb un compte anònim (el navegador recorda el jugador sense registrar-se);
  // més tard es pot connectar amb Google per no perdre el progrés i jugar des d'altres dispositius.
  let usuari = await new Promise(r => { const atura = fa.onAuthStateChanged(auth, u => { atura(); r(u); }); });
  if (!usuari) usuari = (await fa.signInAnonymously(auth)).user;
  const db = fs.getFirestore(app);
  const docMeu = () => fs.doc(db, "jugadors", con.id);
  const con = {
    id: usuari.uid, necessitaNom: true, potGoogle: true,
    google: () => auth.currentUser?.providerData.find(p => p.providerId === "google.com") || null,
    llegeixMeu: async () => { const s = await fs.getDoc(docMeu()); return s.exists() ? s.data() : null; },
    desa: dades => fs.setDoc(docMeu(), dades),
    escolta: cb => fs.onSnapshot(
      fs.query(fs.collection(db, "jugadors"), fs.orderBy("nivell", "desc"), fs.limit(200)),
      s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {}),
    perfils: async ids => Object.fromEntries(ids.map(i => {
      const j = amics.llista.find(x => x.id === i);
      const nom = j?.nom || (i === con.id ? nomJugador() : "") || "Jugador";
      // Només fotos de perfil de Google: una adreça qualsevol podria servir per espiar qui mira el mapa
      const foto = typeof j?.foto === "string" && /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//.test(j.foto) ? j.foto : "";
      return [i, { name: nom, avatarUrl: foto || avatarInicial(nom, i) }];
    })),
    // Retorna true si s'ha canviat a un altre jugador (el Google ja tenia progrés en un altre dispositiu)
    connectaGoogle: async () => {
      const proveidor = new fa.GoogleAuthProvider();
      try {
        await fa.linkWithPopup(auth.currentUser, proveidor);
        return false;
      } catch (e) {
        if (e.code !== "auth/credential-already-in-use") throw e;
        // Aquest Google ja és un jugador: s'esborra el jugador anònim d'aquest navegador i s'entra amb el de Google
        const credencial = fa.GoogleAuthProvider.credentialFromError(e);
        await fs.deleteDoc(docMeu()).catch(() => {});
        const anonim = auth.currentUser;
        const nou = (await fa.signInWithCredential(auth, credencial)).user;
        await fa.deleteUser(anonim).catch(() => {});
        con.id = nou.uid;
        return true;
      }
    },
  };
  return con;
}

async function connectaArtifact() {
  if (!window.claude?.use) return null;
  const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
  if (!db || !user) return null;
  const id = await user.id();
  if (!id) return null;
  return {
    id, necessitaNom: false,
    llegeixMeu: async () => { const s = await db.doc("jugadors/" + id).get(); return s.exists ? s.data() : null; },
    desa: dades => db.doc("jugadors/" + id).set(dades),
    escolta: cb => db.collection("jugadors").onSnapshot(s => cb(s.docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() }))), () => {}),
    perfils: ids => user.profiles(ids),
  };
}

async function iniciaAmics() {
  const con = await connectaFirebase().catch(e => { console.warn("Firebase no disponible:", e); return null; })
    || await connectaArtifact().catch(() => null);
  if (!con) return;
  amics.con = con;
  await recuperaProgres();
  $("btnAmics").hidden = false;
  $("btnCanviaNom").hidden = !con.necessitaNom;
  con.escolta(llista => {
    amics.llista = llista;
    pintaAmicsAlMapa();
    if ($("dlgAmics").open) pintaLlistaAmics();
  });
  if (con.necessitaNom && !nomJugador()) demanaNom();
  publicaProgres();
}

// Si en aquest navegador no hi ha progrés però al núvol sí (un altre dispositiu), el recupera
async function recuperaProgres() {
  const dades = await amics.con.llegeixMeu().catch(() => null);
  if (dades && dades.nivell > estat.nivell && !estat.enCurs) {
    estat.nivell = dades.nivell;
    estat.estrelles = { ...(dades.estrelles || {}), ...estat.estrelles };
    desaEstat();
    if (!$("pMapa").hidden) pintaMapa();
  }
  if (dades?.nom && (!nomJugador() || amics.con.google())) desa("paraulina-nom", dades.nom);
}

function pintaEstatGoogle() {
  const con = amics.con, g = con?.google?.();
  $("zonaGoogle").hidden = !con?.potGoogle;
  $("btnGoogle").hidden = !!g;
  $("textGoogle").textContent = g
    ? `Connectat amb Google${g.email ? " (" + g.email + ")" : ""}. El teu progrés es guarda al compte.`
    : "Connecta't amb Google per no perdre el progrés i jugar des de qualsevol dispositiu.";
}

async function connectaGoogle() {
  const con = amics.con;
  try {
    const canviat = await con.connectaGoogle();
    const g = con.google();
    if (canviat) { amics.publicat = null; await recuperaProgres(); }
    if (!nomJugador() && g?.displayName) desa("paraulina-nom", g.displayName.split(" ")[0].slice(0, 20));
    amics.publicat = null;
    await publicaProgres();
    pintaEstatGoogle(); pintaLlistaAmics(); pintaAmicsAlMapa();
    avisa(canviat ? "Has recuperat el teu progrés de Google 🎉" : "Connectat amb Google ✅");
  } catch (e) {
    console.warn("Error connectant amb Google:", e);
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
    avisa(["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(e.code)
      ? "Obre el joc a Chrome o Safari per connectar amb Google"
      : "No s'ha pogut connectar amb Google. Torna-ho a provar.");
  }
}

function demanaNom() {
  const obre = () => { $("inputNom").value = nomJugador(); $("dlgNom").showModal(); };
  const oberta = document.querySelector("dialog[open]");
  if (oberta) oberta.addEventListener("close", obre, { once: true }); else obre();
}
$("formNom").addEventListener("submit", e => {
  e.preventDefault();
  const nom = $("inputNom").value.trim().slice(0, 20);
  if (!nom) return;
  desa("paraulina-nom", nom);
  $("dlgNom").close();
  amics.publicat = null;
  publicaProgres();
});

async function publicaProgres() {
  const con = amics.con;
  if (!con || (con.necessitaNom && !nomJugador())) return;
  const dades = { nivell: estat.nivell, estrelles: estat.estrelles, total: totalEstrelles(), actualitzat: Date.now() };
  if (con.necessitaNom) dades.nom = nomJugador();
  const foto = con.google?.()?.photoURL;
  if (foto && foto.length <= 500 && /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//.test(foto)) dades.foto = foto;
  const clau = [con.id, dades.nivell, dades.total, dades.nom, dades.foto].join("|");
  if (amics.publicat === clau) return;
  amics.publicat = clau;
  try { await con.desa(dades); } catch (e) { console.warn("No s'ha pogut desar el progrés:", e); amics.publicat = null; }
}

async function pintaAmicsAlMapa() {
  if (!amics.con) return;
  const altres = amics.llista.filter(a => a.id !== amics.con.id && typeof a.nivell === "number");
  const ps = altres.length ? await amics.con.perfils(altres.map(a => a.id)) : {};
  for (const av of document.querySelectorAll(".avatars")) {
    const aqui = altres.filter(a => a.nivell === +av.dataset.nivell);
    av.replaceChildren();
    for (const a of aqui.slice(0, 3)) {
      const img = document.createElement("img");
      img.src = ps[a.id]?.avatarUrl || avatarInicial("?", a.id);
      img.alt = img.title = ps[a.id]?.name || "Un amic";
      av.appendChild(img);
    }
    if (aqui.length > 3) { const s = document.createElement("span"); s.textContent = "+" + (aqui.length - 3); av.appendChild(s); }
  }
}

async function pintaLlistaAmics() {
  const tots = amics.llista.filter(a => typeof a.nivell === "number").sort((a, b) => b.nivell - a.nivell || (b.total || 0) - (a.total || 0));
  const ps = tots.length ? await amics.con.perfils(tots.map(a => a.id)) : {};
  const ul = $("llistaAmics"); ul.replaceChildren();
  for (const a of tots) {
    const jo = a.id === amics.con.id;
    const li = document.createElement("li");
    if (jo) li.className = "jo";
    const img = document.createElement("img"); img.src = ps[a.id]?.avatarUrl || avatarInicial("?", a.id); img.alt = "";
    const nom = document.createElement("span"); nom.className = "nom";
    nom.textContent = (ps[a.id]?.name || (jo ? "Tu" : "Un amic")) + (jo ? " (tu)" : "");
    const niv = document.createElement("span"); niv.className = "niv";
    niv.textContent = `Nivell ${a.nivell} · ⭐ ${a.total || 0}`;
    li.append(img, nom, niv); ul.appendChild(li);
  }
  $("amicsBuit").hidden = tots.some(a => a.id !== amics.con.id);
}

// ================= Esdeveniments =================
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]") || !teclaActiva) return;
  if (["Enter", "Backspace", "ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); teclaActiva(e.key); }
  else if (e.key.length === 1) teclaActiva(e.key);
});
document.querySelectorAll(".tornar").forEach(b => b.addEventListener("click", () => mostraMapa()));
$("btnAjuda").addEventListener("click", () => $("dlgAjuda").showModal());
$("btnStats").addEventListener("click", obreStats);
$("btnAmics").addEventListener("click", () => { pintaLlistaAmics(); pintaEstatGoogle(); $("dlgAmics").showModal(); });
$("btnCanviaNom").addEventListener("click", () => { $("dlgAmics").close(); demanaNom(); });
$("btnGoogle").addEventListener("click", connectaGoogle);
$("btnReinicia").addEventListener("click", () => { $("dlgStats").close(); $("dlgReinicia").showModal(); });
$("btnReiniciaSi").addEventListener("click", () => {
  estat = { ...ESTAT_INICIAL, estrelles: {}, usades: [], dist: [0, 0, 0, 0, 0, 0] };
  renovaDia(); desaEstat(); publicaProgres();
  $("dlgReinicia").close(); mostraMapa();
});
document.querySelectorAll("[data-tanca]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
$("dlgDema").addEventListener("close", () => clearInterval(tDema));
// Tancar els diàlegs clicant fora (excepte el de final de partida)
document.querySelectorAll("dialog:not(#dlgFi)").forEach(d => d.addEventListener("click", e => {
  const r = d.getBoundingClientRect();
  if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) d.close();
}));
$("dlgFi").addEventListener("cancel", e => e.preventDefault());

// ================= Inici =================
renovaDia();
mostraMapa();
if (!llegeix("paraulina-vist-ajuda", false)) { $("dlgAjuda").showModal(); desa("paraulina-vist-ajuda", true); }
iniciaAmics();
