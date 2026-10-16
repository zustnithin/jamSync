/* =============================================
   JAMSYNC — Party Room
   Live room: members box, friend invites (10s),
   5-min re-invite block, anyone can start.
   Back / Leave removes you from the party.
============================================= */

const API = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

const me = () => localStorage.getItem('jamsync_user') || '';
const avatarOf = (n) => (n.charAt(0) || 'M').toUpperCase();

let socket = null;
let myFriends = new Set(); // lowercase usernames
let friendDisplay = {};    // lower -> original casing
let blocks = new Map();    // friendLower -> block expiry timestamp
let inviteFrom = '';
let inviteTimerID = null;
let blockTickID = null;


// ─── GUARD + BOOT ──────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  if (!me()) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('me-name').textContent = me();
  document.getElementById('me-avatar').textContent = avatarOf(me());

  await loadMyFriends();
  connect();
});

async function loadMyFriends() {
  try {
    const res = await fetch(`${API}/friends?user=${encodeURIComponent(me())}`);
    const data = await res.json();
    (data.friends || []).forEach((f) => {
      myFriends.add(f.username.toLowerCase());
      friendDisplay[f.username.toLowerCase()] = f.username;
    });
  } catch {
    showToast('📡 Server offline — party needs the backend');
  }
  renderRail();
}


// ─── SOCKET ────────────────────────────────────
function connect() {
  if (typeof io === 'undefined') {
    showToast('📡 Realtime lib missing — check connection');
    return;
  }
  socket = io(SOCKET_URL, { query: { user: me(), name: me() } });

  socket.on('connect', () => {
    socket.emit('party:join', { user: me() });
  });

  socket.on('party:members', ({ members }) => renderMembers(members || []));

  socket.on('party:started', ({ by }) => {
    document.getElementById('party-status').textContent = `🎵 Started by ${by} — jam sync coming soon!`;
    showToast(`🎵 ${by} started the party!`);
  });

  // Invite events (same popup as dashboard)
  socket.on('party:invited', ({ from }) => showInvite(from));
  socket.on('party:invite-expired', () => {
    hideInvite();
    showToast('⌛ Party invite expired');
  });
  socket.on('party:invite-accepted', ({ to }) => {
    showToast(`🎉 ${to} accepted — joining the party!`);
  });
  socket.on('party:invite-declined', ({ to, reason }) => {
    showToast(reason === 'timeout' ? `⌛ ${to} didn't answer` : `✕ ${to} declined`);
    if (to) {
      blocks.set(String(to).toLowerCase(), Date.now() + 5 * 60 * 1000);
      renderRail();
    }
  });
}


// ─── MEMBERS BOX ───────────────────────────────
function renderMembers(members) {
  const grid = document.getElementById('members-grid');
  document.getElementById('member-count').textContent = members.length ? `(${members.length})` : '';
  grid.innerHTML = '';
  if (!members.length) {
    grid.innerHTML = '<p class="pane-hint">Party is empty — invite your friends! 🎉</p>';
    return;
  }
  members.forEach((name) => {
    const isMe = name.toLowerCase() === me().toLowerCase();
    const isFriend = myFriends.has(name.toLowerCase());
    const card = document.createElement('div');
    card.className = 'member-card' + (isMe ? ' me' : '');
    card.innerHTML = `<div class="member-avatar">${avatarOf(name)}</div>
                      <span class="member-name"></span>
                      ${isMe ? '<span class="member-you">YOU</span>' : ''}`;
    card.querySelector('.member-name').textContent = name;

    // + on members who aren't friends → auto friend request
    if (!isMe && !isFriend) {
      const plus = document.createElement('button');
      plus.className = 'member-add';
      plus.textContent = '+';
      plus.title = `Add ${name} as friend`;
      plus.onclick = () => addStranger(name, plus);
      card.appendChild(plus);
    }
    grid.appendChild(card);
  });
}

async function addStranger(name, btn) {
  btn.disabled = true;
  btn.textContent = '⏳';
  try {
    const res = await fetch(`${API}/friends/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: me(), to: name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    btn.textContent = '✓';
    btn.classList.add('sent');
    showToast(data.status === 'friends' ? `🎉 You and ${name} are now friends!` : `📩 Friend request sent to ${name}`);
    if (data.status === 'friends') {
      myFriends.add(name.toLowerCase());
      renderMembersRefresh();
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '+';
    showToast('⚠️ ' + err.message);
  }
}

function renderMembersRefresh() {
  // re-render hook kept simple: rail + members stay live via socket anyway
  renderRail();
}


// ─── FRIENDS RAIL + INVITES ────────────────────
function renderRail() {
  const list = document.getElementById('rail-list');
  document.getElementById('rail-count').textContent = myFriends.size ? myFriends.size : '';
  list.innerHTML = '';
  if (!myFriends.size) {
    list.innerHTML = '<p class="rail-empty">No friends yet</p>';
    return;
  }
  [...myFriends].forEach((l) => {
    const name = friendDisplay[l] || l;
    const wrap = document.createElement('div');
    wrap.className = 'rail-user';
    wrap.innerHTML = `<span class="rail-avatar">${avatarOf(name)}</span><span class="rail-name"></span>`;
    wrap.querySelector('.rail-name').textContent = name;
    const btn = document.createElement('button');
    btn.className = 'rail-invite';
    btn.dataset.friend = l;
    btn.onclick = () => inviteFriend(name, btn);
    wrap.appendChild(btn);
    list.appendChild(wrap);
  });
  paintInviteButtons();

  // one ticker for all block countdowns
  clearInterval(blockTickID);
  blockTickID = setInterval(paintInviteButtons, 1000);
}

function paintInviteButtons() {
  const now = Date.now();
  document.querySelectorAll('.rail-invite').forEach((btn) => {
    if (btn.dataset.busy === '1') return;
    const until = blocks.get(btn.dataset.friend) || 0;
    if (now < until) {
      const s = Math.ceil((until - now) / 1000);
      btn.disabled = true;
      btn.classList.add('blocked');
      btn.textContent = `🚫 ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    } else {
      blocks.delete(btn.dataset.friend);
      btn.disabled = false;
      btn.classList.remove('blocked', 'sent');
      btn.textContent = '+';
    }
  });
}

function inviteFriend(name, btn) {
  if (!socket || !socket.connected) {
    showToast('📡 Party server offline');
    return;
  }
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.textContent = '⏳';
  socket.emit('party:invite', { from: me(), to: name }, (res = {}) => {
    btn.dataset.busy = '';
    if (res.ok) {
      btn.textContent = '✓';
      btn.classList.add('sent');
      showToast(`📩 Invited ${name} (10s to answer)`);
      setTimeout(() => {
        btn.classList.remove('sent');
        paintInviteButtons();
      }, 3000);
    } else {
      paintInviteButtons();
      if (res.remainingSec) {
        blocks.set(name.toLowerCase(), Date.now() + res.remainingSec * 1000);
        paintInviteButtons();
        showToast(`🚫 ${name} blocked for ${Math.ceil(res.remainingSec / 60)} more min`);
      } else {
        showToast('⚠️ ' + (res.error || 'Invite failed'));
      }
    }
  });
}


// ─── INVITE POPUP (10s) ────────────────────────
function showInvite(from) {
  inviteFrom = from;
  document.getElementById('invite-avatar').textContent = avatarOf(from);
  const t = document.getElementById('invite-text');
  t.innerHTML = '';
  t.append('Your friend ');
  const s = document.createElement('strong');
  s.textContent = from;
  t.append(s, ' invited you to the party! 🎉');
  document.getElementById('invite-modal').classList.remove('hidden');

  clearInterval(inviteTimerID);
  let left = 10;
  const fill = document.getElementById('invite-timer-fill');
  const num = document.getElementById('invite-count');
  fill.style.transition = 'none';
  fill.style.width = '100%';
  num.textContent = left + 's';
  requestAnimationFrame(() => { fill.style.transition = 'width 1s linear'; });
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
  // already in this room — just confirm, stay here
  if (socket && inviteFrom) {
    socket.emit('party:invite-respond', { from: inviteFrom, to: me(), accept: true });
  }
  hideInvite();
}

function declineInvite() {
  if (socket && inviteFrom) {
    socket.emit('party:invite-respond', { from: inviteFrom, to: me(), accept: false });
  }
  hideInvite();
}


// ─── START / LEAVE / BACK ──────────────────────
function startParty() {
  if (!socket || !socket.connected) {
    showToast('📡 Party server offline');
    return;
  }
  socket.emit('party:start', { user: me() });
}

function leaveAndBack() {
  try {
    if (socket) {
      socket.emit('party:leave', { user: me() });
      socket.disconnect();
    }
  } catch { /* going back anyway */ }
  window.location.href = 'instruments.html';
}

// Closing the tab also leaves the party (server cleans up on disconnect too)
window.addEventListener('beforeunload', () => {
  try { socket && socket.emit('party:leave', { user: me() }); } catch { /* noop */ }
});


// ─── TOAST ─────────────────────────────────────
let toastTimer = null;
function showToast(message) {
  document.getElementById('toast-msg').textContent = message;
  document.getElementById('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => document.getElementById('toast').classList.add('hidden'), 2500);
}
