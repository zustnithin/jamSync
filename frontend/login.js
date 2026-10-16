/* =============================================
   JAMSYNC — Login Page JavaScript
   Login:  username + password (MongoDB API + demo account)
   Signup: username + password + confirm password (no OTP)
   Primary DB: MongoDB via backend API (http://localhost:5000/api)
   Fallback: browser localStorage key "jamsync_users" when backend is down
   Demo account always works offline: nithin / demo1234
============================================= */


// ─── CONFIG ────────────────────────────────────
const API_BASE = window.API_BASE || 'http://localhost:5000/api';
const USERS_KEY = 'jamsync_users';
const DEMO_USER = 'nithin';
const DEMO_PASS = 'demo1234';

// POST JSON to the API with a 5s timeout. Throws on network failure.
async function apiPost(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}


// ─── OFFLINE FALLBACK (localStorage) ───────────
// Used only when the backend is unreachable, so the app still works.
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function findUserKey(users, username) {
  // case-insensitive lookup so "Nithin" and "nithin" don't collide
  const target = username.toLowerCase();
  return Object.keys(users).find((k) => k.toLowerCase() === target) || null;
}

function mirrorToLocal(username, password) {
  const users = getUsers();
  if (!findUserKey(users, username)) {
    users[username] = password;
    saveUsers(users);
  }
}

function loginSuccess(username, token) {
  localStorage.setItem('jamsync_user', username);
  localStorage.setItem('jamsync_token', token);
  showMsg('login-msg', '✅ Login successful! Redirecting...', 'success');
  setTimeout(() => {
    window.location.href = 'instruments.html';
  }, 1000);
}

function clearSignupForm() {
  // Clear signup fields so no details stay in the inputs
  document.getElementById('signup-username').value = '';
  document.getElementById('signup-password').value = '';
  document.getElementById('signup-confirm').value = '';
  const fill = document.getElementById('strength-fill');
  const strengthLabel = document.getElementById('strength-label');
  const matchLabel = document.getElementById('match-label');
  if (fill) { fill.style.width = '0%'; fill.style.background = 'transparent'; }
  if (strengthLabel) strengthLabel.textContent = '';
  if (matchLabel) matchLabel.textContent = '';
}


// ─── TAB SWITCHING ───────────────────────────
function switchTab(tab) {
  const loginForm  = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabLogin   = document.getElementById('tab-login');
  const tabSignup  = document.getElementById('tab-signup');
  const slider     = document.getElementById('tab-slider');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    slider.classList.remove('right');
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
    slider.classList.add('right');
  }

  clearMsg('login-msg');
  clearMsg('signup-msg');
}


// ─── PASSWORD TOGGLE ─────────────────────────
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}


// ─── PASSWORD STRENGTH METER ─────────────────
const signupPasswordInput = document.getElementById('signup-password');
if (signupPasswordInput) {
  signupPasswordInput.addEventListener('input', function () {
    const val   = this.value;
    const fill  = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');

    let score = 0;
    if (val.length >= 8)           score++;
    if (/[A-Z]/.test(val))         score++;
    if (/[0-9]/.test(val))         score++;
    if (/[^A-Za-z0-9]/.test(val))  score++;

    const levels = [
      { pct: '0%',   color: 'transparent', text: '' },
      { pct: '25%',  color: '#ef4444',     text: '🔴 Weak' },
      { pct: '50%',  color: '#f97316',     text: '🟠 Fair' },
      { pct: '75%',  color: '#eab308',     text: '🟡 Good' },
      { pct: '100%', color: '#22c55e',     text: '🟢 Strong' },
    ];

    const level = val.length === 0 ? levels[0] : levels[score];
    fill.style.width      = level.pct;
    fill.style.background = level.color;
    label.textContent     = level.text;

    // Also check confirm password match live
    checkPasswordMatch();
  });
}


// ─── CONFIRM PASSWORD MATCH CHECK ────────────
// Runs whenever confirm password is typed
const confirmInput = document.getElementById('signup-confirm');
if (confirmInput) {
  confirmInput.addEventListener('input', checkPasswordMatch);
}

function checkPasswordMatch() {
  const pass    = document.getElementById('signup-password')?.value || '';
  const confirm = document.getElementById('signup-confirm')?.value  || '';
  const label   = document.getElementById('match-label');

  if (!label) return;

  if (confirm.length === 0) {
    label.textContent = '';
    return;
  }

  if (pass === confirm) {
    label.textContent = '✅ Passwords match';
    label.style.color = '#22c55e';
  } else {
    label.textContent = '❌ Passwords do not match';
    label.style.color = '#ef4444';
  }
}


// ─── MESSAGE HELPERS ─────────────────────────
function showMsg(id, text, type) {
  const box = document.getElementById(id);
  box.textContent = text;
  box.className = `msg-box ${type} show`;
}

function clearMsg(id) {
  const box = document.getElementById(id);
  if (box) {
    box.className  = 'msg-box';
    box.textContent = '';
  }
}


// ─── BUTTON LOADING STATE ────────────────────
function setLoading(btnId, isLoading, defaultText) {
  const btn = document.getElementById(btnId);
  if (isLoading) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.querySelector('.btn-text').textContent = 'Please wait';
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.querySelector('.btn-text').textContent = defaultText;
  }
}


// ─── HANDLE LOGIN ─────────────────────────────
// Login: username + password only
// Checks: 1) demo account (offline), 2) MongoDB API, 3) localStorage fallback

async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  clearMsg('login-msg');

  // Validate username
  if (username.length < 3) {
    showMsg('login-msg', '⚠️ Enter a valid username (min 3 characters)', 'error');
    return;
  }

  // Validate password
  if (password.length < 1) {
    showMsg('login-msg', '⚠️ Please enter your password', 'error');
    return;
  }

  // 1) DEMO account — always kept working, no server needed
  if (username === DEMO_USER && password === DEMO_PASS) {
    loginSuccess(username, 'demo-token-123');
    return;
  }

  setLoading('login-btn', true, 'Login to JamSync');

  try {
    // 2) MongoDB via backend API
    const { status, data } = await apiPost('/login', { username, password });
    setLoading('login-btn', false, 'Login to JamSync');

    if (status === 200 && data.ok) {
      mirrorToLocal(data.username, password); // keep offline login working
      loginSuccess(data.username, 'mongo-token-' + Date.now());
    } else {
      showMsg('login-msg', '❌ ' + (data.error || 'Wrong username or password.'), 'error');
      shakeCard();
    }
  } catch {
    // 3) Backend unreachable — fall back to localStorage
    setLoading('login-btn', false, 'Login to JamSync');
    const users = getUsers();
    const key = findUserKey(users, username);

    if (key && users[key] === password) {
      // Keep original casing of stored username for display
      loginSuccess(key, 'user-token-' + Date.now());
    } else {
      showMsg('login-msg', '❌ Wrong username or password. (Server offline, checked local accounts)', 'error');
      shakeCard();
    }
  }
}


// ─── HANDLE SIGNUP ────────────────────────────
// Signup: username + password + confirm password (no OTP)
// Stores user in MongoDB via backend API (localStorage fallback if offline)

async function handleSignup(event) {
  event.preventDefault();

  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;

  clearMsg('signup-msg');

  // ── Validations ──

  // 1. Username
  if (username.length < 3) {
    showMsg('signup-msg', '⚠️ Username must be at least 3 characters', 'error');
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    showMsg('signup-msg', '⚠️ Username can only have letters, numbers, and underscores', 'error');
    return;
  }

  // 2. Demo name is reserved
  if (username.toLowerCase() === DEMO_USER.toLowerCase()) {
    showMsg('signup-msg', '⚠️ Username already taken. Try another one.', 'error');
    return;
  }

  // 3. Password strength
  if (password.length < 8) {
    showMsg('signup-msg', '⚠️ Password must be at least 8 characters', 'error');
    return;
  }

  // 4. Passwords match
  if (password !== confirm) {
    showMsg('signup-msg', '❌ Passwords do not match', 'error');
    return;
  }

  setLoading('signup-btn', true, 'Create Account');

  const signupDone = (savedName, offline) => {
    setLoading('signup-btn', false, 'Create Account');
    showMsg(
      'signup-msg',
      offline
        ? `🎉 Account created on this device! Welcome, ${savedName}! (Server offline — will sync when online)`
        : `🎉 Account created! Welcome, ${savedName}! Please log in.`,
      'success'
    );
    clearSignupForm();
    // Auto switch to login tab after 1.5s
    setTimeout(() => {
      switchTab('login');
      document.getElementById('login-username').value = savedName;
    }, 1500);
  };

  try {
    const { status, data } = await apiPost('/signup', { username, password });

    if (status === 201 && data.ok) {
      mirrorToLocal(data.username, password); // keep offline login working
      signupDone(data.username, false);
    } else {
      setLoading('signup-btn', false, 'Create Account');
      showMsg('signup-msg', '⚠️ ' + (data.error || 'Signup failed. Try again.'), 'error');
    }
  } catch {
    // Backend unreachable — save locally so signup still works offline
    const fresh = getUsers();
    if (findUserKey(fresh, username)) {
      setLoading('signup-btn', false, 'Create Account');
      showMsg('signup-msg', '⚠️ Username already taken. Try another one.', 'error');
      return;
    }
    fresh[username] = password;
    saveUsers(fresh);
    signupDone(username, true);
  }
}


// ─── SHAKE ANIMATION ─────────────────────────
function shakeCard() {
  const card = document.querySelector('.auth-card');
  card.style.animation = 'shake 0.4s ease';
  setTimeout(() => card.style.animation = '', 400);
}

// Inject shake keyframe
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-8px); }
    40%       { transform: translateX(8px); }
    60%       { transform: translateX(-5px); }
    80%       { transform: translateX(5px); }
  }
`;
document.head.appendChild(shakeStyle);
