/* =============================================
   JAMSYNC — Guitar Studio
   Fixed: master gain, audio context resume on click,
   oscillator-based string synthesis (reliable sound)
============================================= */

const STRINGS = 6;
const FRETS = 12;

// String 0 = low E (6th string), String 5 = high E (1st string)
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
let masterGain = null;

const fretboardEl = document.getElementById('fretboard');
const nowPlayingEl = document.getElementById('now-playing');
const npDot = document.getElementById('np-dot');

// ─── AUDIO ───────────────────────────────────────────────
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const midiToName = (m) => ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][m % 12] + (Math.floor(m / 12) - 1);

let activeVoices = new Map(); // key -> { osc, gain, filter }

function stopVoice(key) {
  const v = activeVoices.get(key);
  if (!v) return;
  try {
    v.gain.gain.cancelScheduledValues(audioCtx.currentTime);
    v.gain.gain.setValueAtTime(v.gain.gain.value, audioCtx.currentTime);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
    v.osc.stop(audioCtx.currentTime + 0.15);
  } catch {}
  activeVoices.delete(key);
}

function playNote(stringIdx, fret) {
  ensureAudio();
  const midi = openMidis[stringIdx] + fret;
  const key = `${stringIdx}-${fret}`;
  stopVoice(key); // retrigger same note

  const freq = midiToFreq(midi);
  const now = audioCtx.currentTime;

  // Gain for this note
  const gain = audioCtx.createGain();
  const peak = 0.35 * volume;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.08 * volume, 0.001), now + 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

  // Filter for warmer guitar tone
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200 + midi * 15;
  filter.Q.value = 0.7;

  // Fundamental + harmonics (guitar-like)
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = freq;

  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = freq * 2;

  const osc3 = audioCtx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.value = freq * 3;

  osc1.connect(filter).connect(gain).connect(masterGain);
  osc2.connect(filter).connect(gain).connect(masterGain);
  osc3.connect(filter).connect(gain).connect(masterGain);

  osc1.start(now);
  osc2.start(now);
  osc3.start(now);

  osc1.stop(now + 2.6);
  osc2.stop(now + 2.6);
  osc3.stop(now + 2.6);

  activeVoices.set(key, { osc: osc1, gain, filter });
  // Also track osc2/osc3 under same key conceptually — they stop together

  lightString(stringIdx, true);
  updateNowPlaying(stringIdx, fret, midi);
  setTimeout(() => lightString(stringIdx, false), 200);
}

function lightString(idx, on) {
  const s = document.querySelectorAll('.string')[idx];
  if (s) s.classList.toggle('active', on);
}
function stopAll() {
  activeVoices.forEach((_, k) => stopVoice(k));
}

// ─── FRETBOARD ───────────────────────────────────────────
function renderFretboard() {
  fretboardEl.innerHTML = '';

  const nut = document.createElement('div');
  nut.className = 'fret nut';
  nut.style.left = '3%';
  fretboardEl.appendChild(nut);

  const firstFretLeft = 7.5;
  const lastFretLeft = 94;
  const span = lastFretLeft - firstFretLeft;
  const fretX = [];
  for (let f = 0; f <= FRETS; f++) {
    fretX.push(firstFretLeft + span * (1 - Math.pow(2, -f / 12)));
  }

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

  const top = 14;
  const bottom = 78;
  const step = (bottom - top) / (STRINGS - 1);
  for (let i = 0; i < STRINGS; i++) {
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
  const pluck = (clientX) => {
    const rect = fretboardEl.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const fret = nearestFret(x);
    playNote(stringIdx, fret);
  };

  let isStrumming = false;
  let strumStartX = 0;

  const start = (cx) => {
    isStrumming = true;
    strumStartX = cx;
    pluck(cx);
  };
  const move = (cx) => {
    if (!isStrumming) return;
    const rect = fretboardEl.getBoundingClientRect();
    const x = ((cx - rect.left) / rect.width) * 100;
    const fret = nearestFret(x);
    const dx = cx - strumStartX;
    if (Math.abs(dx) > 25) {
      const dir = dx > 0 ? 1 : -1;
      const order = dir > 0 ? [0,1,2,3,4,5] : [5,4,3,2,1,0];
      order.forEach((si, i) => {
        setTimeout(() => playNote(si, fret), i * 30);
      });
      isStrumming = false;
    }
  };
  const end = () => { isStrumming = false; };

  el.addEventListener('mousedown', (e) => start(e.clientX));
  el.addEventListener('touchstart', (e) => { e.preventDefault(); start(e.touches[0].clientX); }, { passive: false });
  document.addEventListener('mousemove', (e) => move(e.clientX));
  document.addEventListener('touchmove', (e) => { e.preventDefault(); move(e.touches[0].clientX); }, { passive: false });
  document.addEventListener('mouseup', end);
  document.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
}

function nearestFret(xPercent) {
  const first = 7.5, last = 94, span = last - first;
  let best = 0, bestDist = Infinity;
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

function setVolume(v) {
  volume = v / 100;
  if (masterGain) masterGain.gain.value = volume;
}

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
  nowPlayingEl.innerHTML = `Plucking <strong>${note}</strong>`;
  npDot.classList.add('live');
  setTimeout(() => npDot.classList.remove('live'), 350);
}

function showToast(msg) {
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
