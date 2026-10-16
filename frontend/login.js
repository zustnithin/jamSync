/* =============================================
   JAMSYNC — Login Page JavaScript
   Login:  username + password (checks localStorage DB + demo account)
   Signup: username + password + confirm password (no OTP)
   DB: browser localStorage key "jamsync_users" -> { username: password }
   Demo account always works: nithin / demo1234
   NOTE: plain-text storage is for learning only, not production.
============================================= */


// ─── MINI DATABASE (localStorage) ────────────
const USERS_KEY = 'jamsync_users';
const DEMO_USER = 'nithin';
const DEMO_PASS = 'demo1234';

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
// Checks: 1) demo account, 2) localStorage user DB

function handleLogin(event) {
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

  setLoading('login-btn', true, 'Login to JamSync');

  setTimeout(() => {
    setLoading('login-btn', false, 'Login to JamSync');

    // 1) DEMO account — always kept working
    if (username === DEMO_USER && password === DEMO_PASS) {
      localStorage.setItem('jamsync_user', username);
      localStorage.setItem('jamsync_token', 'demo-token-123');

      showMsg('login-msg', '✅ Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = 'instruments.html';
      }, 1000);
      return;
    }

    // 2) Check signed-up users in localStorage DB
    const users = getUsers();
    const key = findUserKey(users, username);

    if (key && users[key] === password) {
      // Keep original casing of stored username for display
      localStorage.setItem('jamsync_user', key);
      localStorage.setItem('jamsync_token', 'user-token-' + Date.now());

      showMsg('login-msg', '✅ Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = 'instruments.html';
      }, 1000);
    } else {
      showMsg('login-msg', '❌ Wrong username or password.', 'error');
      shakeCard();
    }
  }, 800);
}


// ─── HANDLE SIGNUP ────────────────────────────
// Signup: username + password + confirm password (no OTP)
// Stores user in localStorage DB

function handleSignup(event) {
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

  // 2. Username already taken (DB + demo name)
  const users = getUsers();
  if (username.toLowerCase() === DEMO_USER.toLowerCase() || findUserKey(users, username)) {
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

  setTimeout(() => {
    setLoading('signup-btn', false, 'Create Account');

    // Save to mini DB
    const fresh = getUsers();
    // re-check race (double submit)
    if (findUserKey(fresh, username)) {
      showMsg('signup-msg', '⚠️ Username already taken. Try another one.', 'error');
      return;
    }
    fresh[username] = password;
    saveUsers(fresh);

    showMsg('signup-msg', `🎉 Account created! Welcome, ${username}! Please log in.`, 'success');

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

    // Auto switch to login tab after 1.5s
    setTimeout(() => {
      switchTab('login');
      document.getElementById('login-username').value = username;
    }, 1500);
  }, 800);
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
