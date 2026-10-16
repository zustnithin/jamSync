/* =============================================
   JAMSYNC — Piano Studio
   Web Audio API grand piano (no audio files needed)
   2 visible octaves + octave shift (C1–B7 range)
   Mouse drag, multi-touch, computer keyboard
============================================= */

// ─── NOTE MATH ─────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const WHITE_SEMIS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const midiToName = (m) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
const octaveToMidi = (oct) => 12 * (oct + 1); // C4 = 60

// ─── STATE ─────────────────────────────────────
let baseOctave = 4;          // leftmost octave shown (C{base} … B{base+1})
const MIN_OCT = 1, MAX_OCT = 6;
let currentSound = 'grand';
let volume = 0.8;
let sustainOn = false;
let spaceHeld = false;
let labelsOn = true;
let pointerDown = false;

// Computer-keyboard map: key -> semitone offset above C{base}
const KEYMAP = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6,
  g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
  o: 13, l: 14, p: 15, ';': 16,
};
const keyToMidi = {}; // pressed keyboard key -> midi (for keyup)

// ─── SOUND PRESETS ─────────────────────────────
// cutoff: lowpass frequency, harmonics: [fundamental, 2x, 3x] gains,
// decay: seconds to fall to sustain level, sustain: hold level, release: let-ring time
const SOUNDS = {
  grand:    { cutoff: 3800, harmonics: [0.55, 0.22, 0.08], decay: 2.2, sustain: 0.22, release: 0.6,  type: 'triangle' },
  soft:     { cutoff: 1700, harmonics: [0.50, 0.12, 0.04], decay: 2.8, sustain: 0.30, release: 0.9,  type: 'sine' },
  bright:   { cutoff: 6500, harmonics: [0.55, 0.30, 0.14], decay: 1.6, sustain: 0.16, release: 0.45, type: 'triangle' },
  electric: { cutoff: 2400, harmonics: [0.45, 0.28, 0.10], decay: 3.5, sustain: 0.45, release: 1.1,  type: 'sawtooth' },
};

// ─── AUDIO ENGINE ──────────────────────────────
let audioCtx = null;
let masterGain = null;
const activeNotes = new Map(); // midi -> { oscs, gain, filter }

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = volume * volume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playNote(midi) {
  ensureAudio();
  // Retrigger if already held
  if (activeNotes.has(midi)) stopNote(midi, true);

  const preset = SOUNDS[currentSound];
  const freq = midiToFreq(midi);
  // Softer for very high notes, fuller for low notes
  const velocity = midi > 84 ? 0.8 : midi < 48 ? 1.0 : 0.9;

  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = preset.cutoff;
  filter.Q.value = 0.4;

  const now = audioCtx.currentTime;
  const peak = 0.5 * velocity;

  // Fast attack, then exponential fall to sustain level
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(Math.max(preset.sustain * velocity, 0.001), now + preset.decay);

  // Fundamental + 2 harmonics for a piano-like tone
  const oscs = [0, 1, 2].map((i) => {
    const o = audioCtx.createOscillator();
    o.type = i === 0 ? preset.type : 'sine';
    o.frequency.value = freq * (i + 1);
    const g = audioCtx.createGain();
    g.gain.value = preset.harmonics[i] || 0;
    o.connect(g).connect(filter);
    o.start(now);
    return o;
  });

  filter.connect(gain).connect(masterGain);
  activeNotes.set(midi, { oscs, gain, filter });

  lightKey(midi, true);
  updateNowPlaying();
}

function stopNote(midi, hard = false) {
  const note = activeNotes.get(midi);
  if (!note) { lightKey(midi, false); return; }
  activeNotes.delete(midi);

  const preset = SOUNDS[currentSound];
  const now = audioCtx.currentTime;
  const sustainActive = sustainOn || spaceHeld;
  // Sustain pedal / hard retrigger handling
  const releaseTime = hard ? 0.03 : sustainActive ? preset.release + 1.2 : 0.35;

  try {
    note.gain.gain.cancelScheduledValues(now);
    note.gain.gain.setValueAtTime(Math.max(note.gain.gain.value, 0.001), now);
    note.gain.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);
    note.oscs.forEach((o) => o.stop(now + releaseTime + 0.05));
  } catch { /* already stopped */ }

  lightKey(midi, false);
  updateNowPlaying();
}

function stopAllNotes() {
  [...activeNotes.keys()].forEach((m) => stopNote(m));
}

// ─── PIANO RENDERING ───────────────────────────
const pianoEl = document.getElementById('piano');

function renderPiano() {
  pianoEl.innerHTML = '';
  const startMidi = octaveToMidi(baseOctave);
  const whites = [];

  // 1) White keys (2 octaves = 14 keys)
  for (let oct = 0; oct < 2; oct++) {
    WHITE_SEMIS.forEach((semi) => {
      const midi = startMidi + oct * 12 + semi;
      const key = document.createElement('div');
      key.className = 'key white';
      key.dataset.midi = midi;
      key.innerHTML = `<span class="key-note">${midiToName(midi)}</span>
                       <span class="key-hint">${hintForMidi(midi)}</span>`;
      attachKeyEvents(key);
      pianoEl.appendChild(key);
      whites.push({ midi, el: key });
    });
  }

  // 2) Black keys positioned between whites
  const whiteW = 100 / whites.length;
  const blackW = 5.4; // must match .key.black width in CSS
  let wi = 0;
  for (let oct = 0; oct < 2; oct++) {
    WHITE_SEMIS.forEach((semi) => {
      const isEorB = semi === 4 || semi === 11;
      const midi = startMidi + oct * 12 + semi;
      if (!isEorB) {
        const blackMidi = midi + 1;
        const key = document.createElement('div');
        key.className = 'key black';
        key.dataset.midi = blackMidi;
        key.style.left = `calc(${(wi + 1) * whiteW}% - ${blackW / 2}%)`;
        key.innerHTML = `<span class="key-note">${midiToName(blackMidi)}</span>
                         <span class="key-hint">${hintForMidi(blackMidi)}</span>`;
        attachKeyEvents(key);
        pianoEl.appendChild(key);
      }
      wi++;
    });
  }

  if (!labelsOn) pianoEl.classList.add('hide-labels');

  // Update octave readouts
  document.getElementById('octave-display').textContent = 'C' + baseOctave;
  document.getElementById('octave-tagline').innerHTML =
    `🎼 C${baseOctave} – B${baseOctave + 1} &nbsp;•&nbsp; 2 octaves`;
  document.getElementById('oct-down').disabled = baseOctave <= MIN_OCT;
  document.getElementById('oct-up').disabled = baseOctave >= MAX_OCT;
}

function hintForMidi(midi) {
  const offset = midi - octaveToMidi(baseOctave);
  for (const [k, off] of Object.entries(KEYMAP)) {
    if (off === offset) return k.toUpperCase();
  }
  return '';
}

function lightKey(midi, on) {
  const key = pianoEl.querySelector(`[data-midi="${midi}"]`);
  if (key) key.classList.toggle('active', on);
}

// Pointer (mouse + touch + drag glissando)
function attachKeyEvents(key) {
  const midi = Number(key.dataset.midi);

  key.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointerDown = true;
    playNote(midi);
  });
  key.addEventListener('pointerenter', (e) => {
    if (e.buttons > 0 || pointerDown) playNote(midi);
  });
  key.addEventListener('pointerup', () => stopNote(midi));
  key.addEventListener('pointerleave', () => {
    // End glissando trail; sustain pedal still rings out via release envelope
    if (activeNotes.has(midi)) stopNote(midi);
  });
  key.addEventListener('pointercancel', () => stopNote(midi));
  key.addEventListener('contextmenu', (e) => e.preventDefault());
}

document.addEventListener('pointerup', () => { pointerDown = false; });
document.getElementById('piano').addEventListener('pointerleave', () => { pointerDown = false; });

// ─── COMPUTER KEYBOARD ─────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();

  // Sustain pedal on Space
  if (e.code === 'Space' || k === ' ') {
    e.preventDefault();
    spaceHeld = true;
    return;
  }
  // Octave shift
  if (k === '[' || k === 'z' || k === 'arrowleft') { shiftOctave(-1); return; }
  if (k === ']' || k === 'x' || k === 'arrowright') { shiftOctave(1); return; }

  if (k in KEYMAP) {
    const midi = octaveToMidi(baseOctave) + KEYMAP[k];
    keyToMidi[k] = midi;
    playNote(midi);
  }
});

document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (e.code === 'Space' || k === ' ') { spaceHeld = false; return; }
  if (k in keyToMidi) {
    stopNote(keyToMidi[k]);
    delete keyToMidi[k];
  }
});

// ─── CONTROLS ──────────────────────────────────
function shiftOctave(dir) {
  const next = baseOctave + dir;
  if (next < MIN_OCT || next > MAX_OCT) return;
  // Release held notes before re-rendering (midi numbers change)
  stopAllNotes();
  Object.keys(keyToMidi).forEach((k) => delete keyToMidi[k]);
  baseOctave = next;
  renderPiano();
}

function setSound(name) {
  currentSound = name;
  document.querySelectorAll('.sound-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.sound === name)
  );
  showToast(`🎹 Sound: ${name.charAt(0).toUpperCase() + name.slice(1)}`);
}

function setVolume(v) {
  volume = v / 100;
  if (masterGain) masterGain.gain.value = volume * volume;
}

function toggleSustain() {
  sustainOn = !sustainOn;
  const btn = document.getElementById('sustain-btn');
  btn.classList.toggle('on', sustainOn);
  document.getElementById('sustain-state').textContent = sustainOn ? 'On' : 'Off';
  if (!sustainOn) updateNowPlaying();
  showToast(sustainOn ? '🦶 Sustain pedal down' : '🦶 Sustain off');
}

function toggleLabels() {
  labelsOn = !labelsOn;
  pianoEl.classList.toggle('hide-labels', !labelsOn);
  const btn = document.getElementById('labels-btn');
  btn.classList.toggle('on', labelsOn);
  document.getElementById('labels-state').textContent = labelsOn ? 'On' : 'Off';
}

// ─── NOW PLAYING ───────────────────────────────
function updateNowPlaying() {
  const el = document.getElementById('now-playing');
  const dot = document.getElementById('np-dot');
  if (activeNotes.size === 0) {
    el.textContent = sustainOn ? 'Sustain on — notes ringing…' : 'Press a key or click the piano…';
    dot.classList.remove('live');
  } else {
    const names = [...activeNotes.keys()].sort((a, b) => a - b).map(midiToName);
    el.innerHTML = `Playing <strong>${names.join(' + ')}</strong>`;
    dot.classList.add('live');
  }
}

// ─── NAV / PROFILE (same pattern as dashboard) ─
window.addEventListener('DOMContentLoaded', () => {
  const username = localStorage.getItem('jamsync_user') || 'Musician';
  const initial = (username.charAt(0) || 'M').toUpperCase();
  document.getElementById('profile-name').textContent = username;
  document.getElementById('avatar-circle').textContent = initial;
  document.getElementById('avatar-lg').textContent = initial;
  document.getElementById('dropdown-username').textContent = username;
  renderPiano();
});

function toggleDropdown() {
  document.getElementById('dropdown').classList.toggle('open');
  document.getElementById('chevron').classList.toggle('open');
}
document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('profile-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    document.getElementById('dropdown').classList.remove('open');
    document.getElementById('chevron').classList.remove('open');
  }
});

function goBack() { window.location.href = 'instruments.html'; }
function goToInstruments() { window.location.href = 'instruments.html'; }
function logout() { document.getElementById('logout-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('logout-modal').classList.add('hidden'); }
function confirmLogout() {
  localStorage.removeItem('jamsync_user');
  localStorage.removeItem('jamsync_token');
  closeModal();
  showToast('👋 Logged out. See you soon!');
  setTimeout(() => { window.location.href = 'index.html'; }, 1000);
}
document.getElementById('logout-modal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
}
