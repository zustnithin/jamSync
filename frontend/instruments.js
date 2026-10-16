/* =============================================
   JAMSYNC — Instruments Dashboard JavaScript
   Handles: Profile dropdown, logout modal,
   instrument card click, username display,
   friends (find / requests / list)
============================================= */

const FRIEND_API = 'http://localhost:5000/api';

const me = () => localStorage.getItem('jamsync_user') || '';
const avatarOf = (name) => (name.charAt(0) || 'M').toUpperCase();


// ─── ON PAGE LOAD ─────────────────────────────
// Read username from localStorage (set during login)
// and display it in the navbar and dropdown

window.addEventListener('DOMContentLoaded', () => {
  // Get saved username — fallback to "Musician" if not found
  const username = localStorage.getItem('jamsync_user') || 'Musician';

  // Get first letter for avatar
  const initial = username.charAt(0).toUpperCase();

  // Update all username displays
  document.getElementById('profile-name').textContent    = username;
  document.getElementById('avatar-circle').textContent   = initial;
  document.getElementById('avatar-lg').textContent       = initial;
  document.getElementById('dropdown-username').textContent = username;

  // Friends data + badge
  loadFriends();
  refreshBadge();
  setInterval(refreshBadge, 30000); // badge stays fresh
});


// ─── PROFILE DROPDOWN TOGGLE ─────────────────
// Opens and closes the dropdown menu under profile icon

function toggleDropdown() {
  const dropdown = document.getElementById('dropdown');
  const chevron  = document.getElementById('chevron');

  const isOpen = dropdown.classList.contains('open');

  if (isOpen) {
    dropdown.classList.remove('open');
    chevron.classList.remove('open');
  } else {
    dropdown.classList.add('open');
    chevron.classList.add('open');
  }
}

// Close dropdown if user clicks anywhere else on the page
document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('profile-wrapper');

  // If click was outside the profile wrapper — close dropdown
  if (!wrapper.contains(e.target)) {
    document.getElementById('dropdown').classList.remove('open');
    document.getElementById('chevron').classList.remove('open');
  }
});


// ─── DROPDOWN MENU ACTIONS ───────────────────
// These show "coming soon" toasts for now
// Will navigate to real pages when built

function goToProfile() {
  closeDropdown();
  showToast('👤 Profile page coming soon!');
}

function goToSettings() {
  closeDropdown();
  showToast('⚙️ Settings page coming soon!');
}

function goToRooms() {
  closeDropdown();
  showToast('🌐 Live Rooms coming soon!');
}

function closeDropdown() {
  document.getElementById('dropdown').classList.remove('open');
  document.getElementById('chevron').classList.remove('open');
}


// ─── LOGOUT FLOW ─────────────────────────────
// Step 1: User clicks "Log Out" in dropdown
// Step 2: Confirmation modal appears
// Step 3: User confirms → clear data → back to login

function logout() {
  closeDropdown();
  // Show the confirmation modal
  document.getElementById('logout-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('logout-modal').classList.add('hidden');
}

function confirmLogout() {
  // Clear saved login data
  localStorage.removeItem('jamsync_user');
  localStorage.removeItem('jamsync_token');

  // Close modal
  closeModal();

  // Show toast briefly then redirect to login
  showToast('👋 Logged out. See you soon!');

  setTimeout(() => {
    window.location.href = 'index.html';  // back to login page
  }, 1200);
}

// Close modal if overlay (background) is clicked
document.getElementById('logout-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});


// ─── INSTRUMENT CARD CLICK ───────────────────
// When a card is clicked, open that instrument's page
// For now: Piano navigates to piano.html
// Others show "coming soon" toast

function openInstrument(name) {
  // Add a click "press" animation to the card
  const card = document.getElementById(`card-${name}`);
  card.style.transform = 'scale(0.97)';
  setTimeout(() => card.style.transform = '', 200);

  // Decide what to do
  if (name === 'piano') {
    setTimeout(() => {
      window.location.href = 'piano.html';   // we build this next!
    }, 250);

  } else {
    // Other instruments → coming soon
    const labels = {
      violin: '🎻 Violin',
      drums:  '🥁 Drums',
      guitar: '🎸 Guitar',
    };
    showToast(`${labels[name]} studio coming soon!`);
  }
}


// ─── TOAST NOTIFICATION ──────────────────────
// Small popup message at the bottom of the screen
// Appears for 2.5 seconds then disappears

let toastTimer = null;

function showToast(message) {
  const toast   = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');

  // Set message
  toastMsg.textContent = message;

  // Show toast
  toast.classList.remove('hidden');

  // Clear any existing timer
  clearTimeout(toastTimer);

  // Auto-hide after 2.5 seconds
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}


// ─── FRIENDS ───────────────────────────────────
// Big box with Find + Requests tabs, plus dashboard friends list.
// Server: backend/routes/friends.js (MongoDB).

async function friendGet(path) {
  const res = await fetch(FRIEND_API + path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
}

async function friendPost(path, body) {
  const res = await fetch(FRIEND_API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
}

function openFriends(tab = 'find') {
  document.getElementById('friends-modal').classList.remove('hidden');
  switchFriendTab(tab);
  if (tab === 'find') {
    document.getElementById('find-input').value = '';
    document.getElementById('find-results').innerHTML =
      '<p class="pane-hint">Type a username to find musicians 🎤</p>';
    setTimeout(() => document.getElementById('find-input').focus(), 100);
  } else {
    loadRequests();
  }
  refreshBadge();
}

function closeFriends() {
  document.getElementById('friends-modal').classList.add('hidden');
}

function switchFriendTab(tab) {
  const isFind = tab === 'find';
  document.getElementById('pane-find').classList.toggle('hidden', !isFind);
  document.getElementById('pane-requests').classList.toggle('hidden', isFind);
  document.getElementById('ftab-find').classList.toggle('active', isFind);
  document.getElementById('ftab-requests').classList.toggle('active', !isFind);
  if (!isFind) loadRequests();
}

// Close box when clicking the dark background
document.getElementById('friends-modal').addEventListener('click', function (e) {
  if (e.target === this) closeFriends();
});

// ─── FIND: live username search ───
let searchTimer = null;

function searchUsers() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 300); // wait until typing pauses
}

async function runSearch() {
  const q = document.getElementById('find-input').value.trim();
  const box = document.getElementById('find-results');
  if (q.length < 1) {
    box.innerHTML = '<p class="pane-hint">Type a username to find musicians 🎤</p>';
    return;
  }
  box.innerHTML = '<p class="pane-hint">Searching… 🔍</p>';
  try {
    const data = await friendGet(`/users/search?q=${encodeURIComponent(q)}&me=${encodeURIComponent(me())}`);
    if (!data.users.length) {
      box.innerHTML = '<p class="pane-hint">No user found with that name 😕</p>';
      return;
    }
    box.innerHTML = '';
    data.users.forEach((u) => box.appendChild(findRow(u)));
  } catch (err) {
    box.innerHTML = `<p class="pane-hint">${err.message} 📡</p>`;
  }
}

// One search result row: avatar + name + action button (+ → ⏳ → ✓)
function findRow(u) {
  const row = document.createElement('div');
  row.className = 'user-row';
  row.innerHTML = `<div class="avatar">${avatarOf(u.username)}</div>
                   <span class="user-name"></span>`;
  row.querySelector('.user-name').textContent = u.username;

  const btn = document.createElement('button');
  btn.className = 'add-btn';

  if (u.relation === 'friends') {
    btn.textContent = '✓';
    btn.classList.add('done');
    btn.disabled = true;
    btn.title = 'Already friends';
  } else if (u.relation === 'requested') {
    btn.textContent = '✓';
    btn.classList.add('sent');
    btn.disabled = true;
    btn.title = 'Request sent';
  } else if (u.relation === 'incoming') {
    btn.textContent = '📩';
    btn.title = 'They requested you — check Requests tab';
    btn.onclick = () => switchFriendTab('requests');
  } else {
    btn.textContent = '+';
    btn.title = 'Send friend request';
    btn.onclick = () => sendRequest(u.username, btn);
  }

  row.appendChild(btn);
  return row;
}

async function sendRequest(username, btn) {
  btn.disabled = true;
  btn.textContent = '⏳';
  btn.classList.add('loading');
  try {
    const data = await friendPost('/friends/request', { from: me(), to: username });
    btn.classList.remove('loading');
    btn.textContent = '✓';
    if (data.status === 'friends') {
      btn.classList.add('done');
      btn.title = 'You are now friends! 🎉';
      showToast(`🎉 You and ${username} are now friends!`);
      loadFriends();
    } else {
      btn.classList.add('sent');
      btn.title = 'Request sent';
      showToast(`📩 Request sent to ${username}`);
    }
  } catch (err) {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.textContent = '+';
    showToast('⚠️ ' + err.message);
  }
}

// ─── REQUESTS: incoming list with ✓ / ✕ ───
async function loadRequests() {
  const box = document.getElementById('requests-list');
  box.innerHTML = '<p class="pane-hint">Loading… 📩</p>';
  try {
    const data = await friendGet(`/friends/requests?user=${encodeURIComponent(me())}`);
    if (!data.requests.length) {
      box.innerHTML = '<p class="pane-hint">No friend requests 📭</p>';
      return;
    }
    box.innerHTML = '';
    data.requests.forEach((r) => box.appendChild(requestRow(r.from)));
    refreshBadge();
  } catch (err) {
    box.innerHTML = `<p class="pane-hint">${err.message} 📡</p>`;
  }
}

function requestRow(username) {
  const row = document.createElement('div');
  row.className = 'user-row';
  row.innerHTML = `<div class="avatar">${avatarOf(username)}</div>
                   <span class="user-name"></span>
                   <div class="req-actions">
                     <button class="accept-btn" title="Accept">✓</button>
                     <button class="reject-btn" title="Reject">✕</button>
                   </div>`;
  row.querySelector('.user-name').textContent = username;

  const [okBtn, noBtn] = row.querySelectorAll('button');
  okBtn.onclick = () => respondRequest(username, true, row);
  noBtn.onclick = () => respondRequest(username, false, row);
  return row;
}

async function respondRequest(username, accept, row) {
  row.querySelectorAll('button').forEach((b) => (b.disabled = true));
  try {
    await friendPost('/friends/respond', { user: me(), from: username, accept });
    row.remove();
    if (accept) {
      showToast(`🎉 You and ${username} are now friends!`);
      loadFriends();
    } else {
      showToast(`Request from ${username} removed`);
    }
    const box = document.getElementById('requests-list');
    if (!box.children.length) box.innerHTML = '<p class="pane-hint">No friend requests 📭</p>';
    refreshBadge();
  } catch (err) {
    row.querySelectorAll('button').forEach((b) => (b.disabled = false));
    showToast('⚠️ ' + err.message);
  }
}

// ─── BADGE: pending request count on navbar icon ───
async function refreshBadge() {
  const badge = document.getElementById('friend-badge');
  const reqBadge = document.getElementById('req-badge');
  try {
    const data = await friendGet(`/friends/requests?user=${encodeURIComponent(me())}`);
    const n = data.requests.length;
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
    reqBadge.textContent = n;
    reqBadge.classList.toggle('hidden', n === 0);
  } catch {
    badge.classList.add('hidden'); // server offline — hide quietly
  }
}

// ─── FRIENDS RAIL on dashboard (vertical bar, Free Fire style) ───
async function loadFriends() {
  const list = document.getElementById('rail-list');
  const count = document.getElementById('rail-count');
  try {
    const data = await friendGet(`/friends?user=${encodeURIComponent(me())}`);
    list.innerHTML = '';
    count.textContent = data.friends.length ? data.friends.length : '';
    if (!data.friends.length) {
      list.innerHTML = '<p class="rail-empty">No friends yet</p>';
      return;
    }
    data.friends.forEach((f) => {
      const b = document.createElement('button');
      b.className = 'rail-user';
      b.title = f.username;
      b.onclick = () => openFriends('find');
      b.innerHTML = `<span class="rail-dot"></span>
                     <span class="rail-avatar">${avatarOf(f.username)}</span>
                     <span class="rail-name"></span>`;
      b.querySelector('.rail-name').textContent = f.username;
      list.appendChild(b);
    });
  } catch {
    list.innerHTML = '<p class="rail-empty">Offline 📡</p>';
  }
}

function openParty() {
  window.open('party.html', '_blank');
}


// ─── PARTY SOCKET + INVITE POPUP ───────────────
// Same invite popup works from every page with a socket.
let partySocket = null;
let inviteFrom = '';
let inviteTimerID = null;

function connectPartySocket() {
  if (partySocket || typeof io === 'undefined') return;
  try {
    partySocket = io('http://localhost:5000', { query: { user: me(), name: me() } });
  } catch {
    return; // server offline — party features sleep quietly
  }

  partySocket.on('party:invited', ({ from }) => showInvite(from));
  partySocket.on('party:invite-expired', () => {
    hideInvite();
    showToast('⌛ Party invite expired');
  });
}

function showInvite(from) {
  inviteFrom = from;
  document.getElementById('invite-avatar').textContent = avatarOf(from);
  document.getElementById('invite-text').innerHTML = '';
  const t = document.getElementById('invite-text');
  t.append('Your friend ');
  const s = document.createElement('strong');
  s.textContent = from;
  t.append(s, ' invited you to the party! 🎉');
  document.getElementById('invite-modal').classList.remove('hidden');

  // 10s countdown bar
  clearInterval(inviteTimerID);
  let left = 10;
  const fill = document.getElementById('invite-timer-fill');
  const num = document.getElementById('invite-count');
  fill.style.transition = 'none';
  fill.style.width = '100%';
  num.textContent = left + 's';
  requestAnimationFrame(() => {
    fill.style.transition = 'width 1s linear';
  });
  inviteTimerID = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(inviteTimerID);
      hideInvite();
      return;
    }
    fill.style.width = left * 10 + '%';
    num.textContent = left + 's';
  }, 1000);
}

function hideInvite() {
  clearInterval(inviteTimerID);
  inviteFrom = '';
  document.getElementById('invite-modal').classList.add('hidden');
}

function acceptInvite() {
  const from = inviteFrom;
  if (partySocket && from) {
    partySocket.emit('party:invite-respond', { from, to: me(), accept: true });
  }
  hideInvite();
  window.open('party.html', '_blank');
}

function declineInvite() {
  const from = inviteFrom;
  if (partySocket && from) {
    partySocket.emit('party:invite-respond', { from, to: me(), accept: false });
  }
  hideInvite();
}

// connect after username is known
window.addEventListener('DOMContentLoaded', () => {
  connectPartySocket();
});
