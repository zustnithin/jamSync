/* =============================================
   JAMSYNC — Guitar Studio
   Karplus-Strong string synthesis
   6 strings, standard / drop D / open G tunings
   Click fretboard to pluck, drag to strum
============================================= */

const SAMPLE_RATE = 44100;
const STRINGS = 6;
const FRETS = 12;

// Standard tuning: E2 A2 D3 G3 B3 E4 (midi 40,45,50,55,59,64)
// String index 0 = low E (6th string), 5 = high E (1st string)
const TUNINGS = {
  standard: [40, 45, 50, 55, 59, 64],
  dropD:    [38, 45, 50, 55, 59, 64],
  openG:    [38, 43, 47, 50, 55, 59],
};

let currentTuning = 'standard';
let openMidis = TUNINGS.standard.slice();
let volume = 0.8;
let fretLabelsOn = true;
let audioCtx = null;
let isStrumming = false;
let strumStartX = 0;

const fretboardEl = document.getElementById('fretboard');
const nowPlayingEl = document.getElementById('now-playing');
const npDot = document.getElementById('np-dot');

// ─── AUDIO (Karplus-Strong) ──────────────────────────────
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

const PLUCK_BUFFERS = new Map(); // midi -> AudioBuffer (noise burst)

function getPluckBuffer(midi) {
  if (PLUCK_BUFFERS.has(midi)) return PLUCK_BUFFERS.get(midi);
  const len = Math.max(64, Math.floor(SAMPLE_RATE / midiToFreq(midi) * 0.5));
  const buf = audioCtx.createBuffer(1, len, SAMPLE_RATE);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  PLUCK_BUFFERS.set(midi, buf);
  return buf;
}

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
const midiToName = (m) => ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][m % 12] + (Math.floor(m / 12) - 1);

let activeVoices = new Map(); // key (stringIdx-fret) -> { source, bufferSource }

function stopVoice(key) {
  const v = activeVoices.get(key);
  if (!v) return;
  try { v.source.stop(); v.source.disconnect(); } catch {}
  activeVoices.delete(key);
}

function playNote(stringIdx, fret) {
  ensureAudio();
  const midi = openMidis[stringIdx] + fret;
  const key = `${stringIdx}-${fret}`;
  stopVoice(key); // retrigger same note

  const gain = audioCtx.createGain();
  const convolver = audioCtx.createConvolver();
  // tiny body resonance from pluck buffer
  convolver.buffer = getPluckBuffer(midi);

  const source = audioCtx.createBufferSource();
  source.buffer = getPluckBuffer(midi);
  source.playbackRate.value = 1;
  source.connect(convolver).connect(gain).connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(volume * 0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
  source.start(now);

  activeVoices.set(key, { source, gain });
  lightString(stringIdx, true);
  updateNowPlaying(stringIdx, fret, midi);
  setTimeout(() => lightString(stringIdx, false), 180);
}

function lightString(idx, on) {
  const s = document.querySelectorAll('.string')[idx];
  if (s) s.classList.toggle('active', on);
}
function stopAll() { activeVoices.forEach((_, k) => stopVoice(k)); }

// ─── FRETBOARD RENDERING ─────────────────────────────────
function renderFretboard() {
  fretboardEl.innerHTML = '';
  const nut = document.createElement('div');
  nut.className = 'fret nut';
  nut.style.left = '3%';
  fretboardEl.appendChild(nut);

  const firstFretLeft = 7.5;   // % from left where string starts (after nut)
  const lastFretLeft = 94;     // % at last fret
  const span = lastFretLeft - firstFretLeft;
  // exponential fret placement (rule of 18 approx)
  const fretX = [];
  for (let f = 0; f <= FRETS; f++) {
    const x = firstFretLeft + span * (1 - Math.pow(2, -f / 12));
    fretX.push(x);
  }

  // Frets
  for (let f = 1; f <= FRETS; f++) {
    const div = document.createElement('div');
    div.className = 'fret';
    div.style.left = fretX[f] + '%';
    fretboardEl.appendChild(div);
    if (fretLabelsOn) {
      const lbl = document.createElement('div');
      lbl.className = 'fret-label';
      lbl.textContent = f;
      lbl.style.left = (fretX[f] - 6) + '%';
      if ([3, 5, 7, 9, 12].includes(f)) lbl.style.fontWeight = '800';
      fretboardEl.appendChild(lbl);
    }
  }

  // Strings (6)
  const stringCount = STRINGS;
  const top = 14; // % from top
  const bottom = 78; // % from top
  const step = (bottom - top) / (stringCount - 1);
  for (let i = 0; i < stringCount; i++) {
    const y = top + i * step;
    const str = document.createElement('div');
    str.className = 'string';
    str.style.top = y + '%';
    str.dataset.string = i;
    attachStringEvents(str, i);
    fretboardEl.appendChild(str);
  }

  document.getElementById('tuning-tagline').textContent = '🎸 ' + tuningName(currentTuning);
}

function tuningName(t) {
  return { standard: 'Standard E A D G B E', dropD: 'Drop D D A D G B E', openG: 'Open G D G D G B D' }[t];
}

function attachStringEvents(el, stringIdx) {
  // Click / tap to pluck at nearest fret
  const pluck = (clientX) => {
    const rect = fretboardEl.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const fret = nearestFret(x);
    playNote(stringIdx, fret);
  };

  el.addEventListener('mousedown', (e) => { isStrumming = true; strumStartX = e.clientX; pluck(e.clientX); });
  el.addEventListener('touchstart', (e) => { e.preventDefault(); isStrumming = true; strumStartX = e.touches[0].clientX; pluck(e.touches[0].clientX); }, { passive: false });

  // Drag = strum across strings
  const move = (clientX) => {
    if (!isStrumming) return;
    const rect = fretboardEl.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const fret = nearestFret(x);
    // strum: play adjacent string slightly delayed based on drag direction
    const dx = clientX - strumStartX;
    if (Math.abs(dx) > 20) {
      const dir = dx > 0 ? 1 : -1; // low to high or high to low
      const order = dir > 0 ? [0,1,2,3,4,5] : [5,4,3,2,1,0];
      order.forEach((si, i) => {
        setTimeout(() => playNote(si, fret), i * 25);
      });
      isStrumming = false;
    }
  };
  const end = () => { isStrumming = false; };

  document.addEventListener('mousemove', (e) => move(e.clientX));
  document.addEventListener('mouseup', end);
  document.addEventListener('touchmove', (e) => { e.preventDefault(); move(e.touches[0].clientX); }, { passive: false });
  document.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
}

function nearestFret(xPercent) {
  // find fret whose center is closest
  let best = 0, bestDist = Infinity;
  // sample fret centers: use fretX from render — approximate here
  const first = 7.5, last = 94, span = last - first;
  for (let f = 0; f <= FRETS; f++) {
    const x = first + span * (1 - Math.pow(2, -f / 12));
    const d = Math.abs(xPercent - x);
    if (d < bestDist) { bestDist = d; best = f; }
  }
  return best;
}

// ─── CONTROLS ────────────────────────────────────────────
function setTuning(name) {
  currentTuning = name;
  openMidis = TUNINGS[name].slice();
  stopAll();
  renderFretboard();
  document.querySelectorAll('.sound-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tuning === name)
  );
  showToast(`🎸 Tuning: ${tuningName(name)}`);
}

function setVolume(v) { volume = v / 100; }

function toggleFretLabels() {
  fretLabelsOn = !fretLabelsOn;
  document.getElementById('fret-labels-btn').classList.toggle('on', fretLabelsOn);
  document.getElementById('fret-labels-state').textContent = fretLabelsOn ? 'On' : 'Off';
  renderFretboard();
}

// ─── UI ──────────────────────────────────────────────────
function updateNowPlaying(stringIdx, fret, midi) {
  const stringLabel = ['6th (E)','5th (A)','4th (D)','3rd (G)','2nd (B)','1st (E)'][stringIdx];
  const note = fret === 0 ? 'open ' + stringLabel : `${midiToName(midi)} (fret ${fret})`;
  document.getElementById('now-playing').innerHTML = `Plucking <strong>${note}</strong>`;
  npDot.classList.add('live');
  setTimeout(() => npDot.classList.remove('live'), 400);
}

function showToast(msg) {
  // reuse toast if exists
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast hidden';
    t.innerHTML = '<span class="toast-icon">🎸</span><span class="toast-msg"></span>';
    document.body.appendChild(t);
  }
  t.querySelector('.toast-msg').textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t.dataset.timer);
  t.dataset.timer = setTimeout(() => t.classList.add('hidden'), 2000);
}

function goBack() { window.location.href = 'instruments.html'; }

// ─── BOOT ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const user = localStorage.getItem('jamsync_user') || 'Musician';
  document.getElementById('me-name').textContent = user;
  document.getElementById('me-avatar').textContent = (user.charAt(0) || 'M').toUpperCase();
  renderFretboard();
});
