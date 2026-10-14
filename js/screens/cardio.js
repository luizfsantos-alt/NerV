// Cardio.
//
// Correções em relação ao original:
//  - "Voltar" não dispara mais o prompt de distância (o bug em que sair da
//    tela sem nunca ter iniciado pedia a distância percorrida);
//  - a distância pode vir do GPS, em vez de ser digitada de cabeça;
//  - o prompt() nativo virou modal do app.

import { state, saveState } from '../state.js';
import { fmtTime, uid, num } from '../util.js';
import { ICON, promptValue, confirmDialog, toast } from '../ui.js';
import { Stopwatch, keepScreenOn } from '../timers.js';
import { mutation, vibrate, setRhythm } from '../fx.js';
import { go, back, setBeforeLeave } from '../router.js';
import { cardioRecords, detectCardioPRs } from '../progress.js';

let watch = null;
let geo = { id: null, dist: 0, last: null, acc: null, erro: null };

export function screenCardio(params, el) {
  el.innerHTML =
    '<div class="back" id="back" role="link" tabindex="0">' + ICON.back + 'Voltar</div>' +
    '<h2>Cardio</h2>' +
    '<div class="timer" id="cardioTimer">00:00</div>' +
    '<div class="timer-sub" id="cardioSub">pronto</div>' +
    '<div class="stat-grid" style="margin:18px 0;">' +
      '<div class="stat-card"><div class="stat-value" id="cDist">0.00</div><div class="stat-label">km</div></div>' +
      '<div class="stat-card"><div class="stat-value" id="cPace">--:--</div><div class="stat-label">pace /km</div></div>' +
    '</div>' +
    recordesHTML() +
    '<div class="hint" id="gpsHint">O GPS mede a distância sozinho. Sem sinal ou na esteira, você informa a distância no fim.</div>' +
    '<button class="btn btn-primary" id="btnStart" type="button">' + ICON.start + 'Iniciar</button>' +
    '<button class="btn" id="btnGps" type="button" style="display:none;">' + ICON.gps + 'Usar GPS</button>' +
    '<button class="btn" id="btnStop" type="button" style="display:none;">Finalizar</button>';

  reset();

  const voltar = el.querySelector('#back');
  voltar.onclick = back;
  voltar.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); back(); } };
  setRhythm(52, 'Organismo em repouso');
  el.querySelector('#btnStart').onclick = () => iniciar(el);
  el.querySelector('#btnGps').onclick = () => toggleGps(el);
  el.querySelector('#btnStop').onclick = () => finalizar(el);

  // Sair da tela nunca deve pedir distância; só confirma se há corrida em curso.
  setBeforeLeave(async () => {
    if (!watch || !watch.running) { limpar(); return true; }
    const ok = await confirmDialog('Sair do cardio?', 'O tempo em andamento será descartado.', 'Sair');
    if (ok) limpar();
    else history.replaceState(null, '', '#/cardio');
    return ok;
  });
}

function reset() {
  limpar();
  watch = new Stopwatch(sec => {
    const t = document.getElementById('cardioTimer');
    if (t) t.textContent = fmtTime(sec);
    pintarPace();
  });
}

function iniciar(el) {
  watch.reset();
  watch.start();
  keepScreenOn(true);
  el.querySelector('#btnStart').style.display = 'none';
  el.querySelector('#btnStop').style.display = 'flex';
  el.querySelector('#btnGps').style.display = 'flex';
  el.querySelector('#cardioSub').textContent = 'correndo';
  setRhythm(120, 'Cardio');
  vibrate(50);
}

// ===== GPS =====
function toggleGps(el) {
  if (geo.id != null) { pararGps(el); return; }
  if (!('geolocation' in navigator)) { toast('Este aparelho não expõe GPS ao navegador.'); return; }

  const btn = el.querySelector('#btnGps');
  btn.textContent = 'Buscando sinal…';

  geo.id = navigator.geolocation.watchPosition(
    pos => {
      geo.erro = null;
      geo.acc = pos.coords.accuracy;
      btn.innerHTML = ICON.gps + 'GPS ativo · ±' + Math.round(geo.acc) + 'm';
      const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      if (geo.last) {
        const d = haversine(geo.last, p);
        // Descarta saltos: leitura ruim de GPS gera "teleporte" de centenas
        // de metros, que inflaria a distância.
        if (d > 0.002 && d < 0.25 && geo.acc < 50) geo.dist += d;
      }
      geo.last = p;
      pintarDist();
      pintarPace();
    },
    err => {
      geo.erro = err.message;
      btn.innerHTML = ICON.gps + 'GPS indisponível';
      document.getElementById('gpsHint').textContent =
        'GPS não autorizado ou sem sinal. Você poderá informar a distância no fim.';
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
  );
}

function pararGps(el) {
  if (geo.id != null) navigator.geolocation.clearWatch(geo.id);
  geo.id = null;
  const btn = el && el.querySelector('#btnGps');
  if (btn) btn.innerHTML = ICON.gps + 'Usar GPS';
}

/** Distância entre dois pontos em km. */
function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pintarDist() {
  const el = document.getElementById('cDist');
  if (el) el.textContent = geo.dist.toFixed(2);
}

function pintarPace() {
  const el = document.getElementById('cPace');
  if (!el || !watch) return;
  el.textContent = geo.dist > 0.05 ? calcPace(watch.seconds, geo.dist) : '--:--';
}

export function calcPace(seconds, km) {
  if (!km || km <= 0) return '00:00';
  const perKm = seconds / km;
  const m = Math.floor(perKm / 60);
  const s = Math.floor(perKm % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

async function finalizar(el) {
  watch.stop();
  pararGps(el);
  keepScreenOn(false);
  const segundos = watch.seconds;

  if (segundos < 5) {
    toast('Sessão muito curta para registrar.');
    limpar();
    go('/fichas', { replace: true });
    return;
  }

  let km = geo.dist;
  const viaGps = km > 0.05;

  if (!viaGps) {
    const v = await promptValue({
      title: 'Distância percorrida',
      label: 'Quilômetros',
      type: 'number',
      placeholder: '5.0',
      hint: 'Tempo registrado: ' + fmtTime(segundos) + '. Deixe em branco para salvar só o tempo.',
      okLabel: 'Salvar',
    });
    if (v === null) {   // cancelou o modal — não salva nada e continua na tela
      el.querySelector('#btnStop').style.display = 'none';
      el.querySelector('#btnGps').style.display = 'none';
      el.querySelector('#btnStart').style.display = 'flex';
      el.querySelector('#cardioSub').textContent = 'pronto';
      return;
    }
    km = num(v);
    if (km < 0) km = 0;
  }

  const pace = km > 0 ? calcPace(segundos, km) : '00:00';
  const sessao = {
    id: uid('c'),
    date: new Date().toISOString(),
    distance: km,
    duration: segundos,
    pace,
    source: viaGps ? 'gps' : 'manual',
  };
  // Os recordes saem do histórico ANTERIOR: calculados antes de gravar.
  const prs = detectCardioPRs(sessao);
  state.cardioHistory.push(sessao);
  saveState();

  mostrarPace(km, segundos, pace, () => { limpar(); mutation(prs, () => go('/fichas', { replace: true })); });
}

function mostrarPace(km, segundos, pace, cb) {
  const scr = document.getElementById('paceScreen');
  document.getElementById('paceValue').textContent = km > 0 ? pace + '/km' : fmtTime(segundos);
  document.getElementById('paceDist').textContent = km.toFixed(2) + ' km';
  document.getElementById('paceTime').textContent = fmtTime(segundos);
  scr.classList.add('active');
  vibrate([80, 60, 160]);
  const fechar = () => { scr.classList.remove('active'); scr.removeEventListener('click', fechar); clearTimeout(t); cb(); };
  const t = setTimeout(fechar, 2400);
  scr.addEventListener('click', fechar);
}

function limpar() {
  if (watch) watch.stop();
  pararGps(null);
  geo = { id: null, dist: 0, last: null, acc: null, erro: null };
  keepScreenOn(false);
}

/** Recordes atuais, para saber o que bater. Pace só conta a partir de 1 km. */
function recordesHTML() {
  const r = cardioRecords();
  if (!r.pace && !r.distancia) return '';
  const s = r.pace && Math.round(r.pace);
  return '<div class="lbl" style="text-align:center;margin:-8px 0 16px;">recordes: ' +
    (r.pace ? 'pace <b>' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '/km</b>' : '') +
    (r.pace && r.distancia ? ' · ' : '') +
    (r.distancia ? 'distância <b>' + r.distancia.toFixed(2).replace('.', ',') + ' km</b>' : '') + '</div>';
}
