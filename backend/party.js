// =============================================
// JamSync — Party (custom room) realtime manager
// One global party room ("main") for v1.
// Live state is in-memory: members, invites (10s), blocks (5min).
// Events (client -> server):
//   party:join { user }            join the room
//   party:leave { user }           leave the room
//   party:invite { from, to, ack } invite a friend (10s to answer)
//   party:invite-respond { from, to, accept }  answer an invite
//   party:start { user }           anyone can start
// Events (server -> client):
//   party:members { members: [...] }
//   party:invited { from }
//   party:invite-expired { from }        (to the invited side)
//   party:invite-declined { to }         (to the inviter side)
//   party:invite-accepted { to }         (to the inviter side)
//   party:invite-blocked { to, remainingSec } (inviter tried during block)
//   party:started { by }
// =============================================

const INVITE_TTL_MS = 10 * 1000;
const BLOCK_MS = 5 * 60 * 1000;

module.exports = function setupParty(io) {
  // usernameLower -> Set(socketId)
  const online = new Map();
  // usernameLower -> display name (latest seen casing)
  const names = new Map();
  // usernameLower -> join count (same user may have 2 tabs open)
  const members = new Map();
  // "fromLower->toLower" -> timeout object (pending invite)
  const pending = new Map();
  // "fromLower->toLower" -> block expiry timestamp
  const blocks = new Map();

  const key = (a, b) => `${a}->${b}`;
  const lower = (s) => String(s || '').trim().toLowerCase();

  const memberList = () => [...members.keys()].map((l) => names.get(l) || l);
  const broadcastMembers = () => io.emit('party:members', { members: memberList() });

  const socketsOf = (userLower) => {
    const ids = online.get(userLower);
    if (!ids) return [];
    return [...ids]
      .map((id) => io.sockets.sockets.get(id))
      .filter(Boolean);
  };

  const clearInvite = (k) => {
    const t = pending.get(k);
    if (t) clearTimeout(t);
    pending.delete(k);
  };

  io.on('connection', (socket) => {
    const userLower = lower(socket.handshake.query.user);
    if (!userLower) {
      socket.disconnect();
      return;
    }
    if (!online.has(userLower)) online.set(userLower, new Set());
    online.get(userLower).add(socket.id);
    socket.data.userLower = userLower;
    // Remember display casing right away (query.user keeps original case)
    const qName = String(socket.handshake.query.name || socket.handshake.query.user || '').trim();
    if (qName) names.set(userLower, qName);

    // ── JOIN ──
    socket.on('party:join', (payload = {}) => {
      const name = String(payload.user || '').trim() || userLower;
      names.set(userLower, name);
      members.set(userLower, (members.get(userLower) || 0) + 1);
      socket.data.inParty = true;
      broadcastMembers();
    });

    const leaveParty = () => {
      if (!socket.data.inParty) return;
      socket.data.inParty = false;
      const n = (members.get(userLower) || 1) - 1;
      if (n <= 0) members.delete(userLower);
      else members.set(userLower, n);
      broadcastMembers();
    };
    socket.on('party:leave', leaveParty);

    // ── INVITE ──
    // from invites to. Callback ack: { ok } or { error, remainingSec }.
    socket.on('party:invite', ({ from, to } = {}, ack) => {
      const fromLower = lower(from);
      const toLower = lower(to);
      const reply = (obj) => typeof ack === 'function' && ack(obj);

      if (!toLower || toLower === fromLower)
        return reply({ error: "You can't invite yourself" });
      if (members.has(toLower))
        return reply({ error: 'They are already in the party' });

      const k = key(fromLower, toLower);
      const blockedUntil = blocks.get(k) || 0;
      if (Date.now() < blockedUntil) {
        return reply({
          error: 'Blocked — try again later',
          remainingSec: Math.ceil((blockedUntil - Date.now()) / 1000),
        });
      }
      if (pending.has(k)) return reply({ ok: true, status: 'already-sent' });

      const targets = socketsOf(toLower);
      if (!targets.length) return reply({ error: 'Friend is offline' });

      const fromName = String(from || '').trim() || fromLower;
      names.set(fromLower, fromName);
      targets.forEach((s) => s.emit('party:invited', { from: fromName }));

      pending.set(
        k,
        setTimeout(() => {
          pending.delete(k);
          blocks.set(k, Date.now() + BLOCK_MS); // timeout counts as decline
          targets.forEach((s) => s.emit('party:invite-expired', { from: fromName }));
          socketsOf(fromLower).forEach((s) =>
            s.emit('party:invite-declined', { to: toLower, reason: 'timeout' })
          );
        }, INVITE_TTL_MS)
      );
      reply({ ok: true, status: 'sent' });
    });

    // ── ANSWER INVITE ──
    // from = inviter, to = me (the invited side)
    socket.on('party:invite-respond', ({ from, to, accept } = {}) => {
      const fromLower = lower(from);
      const toLower = lower(to || userLower);
      const k = key(fromLower, toLower);
      if (!pending.has(k)) return; // already expired/answered
      clearInvite(k);

      const toName = String(to || '').trim() || names.get(toLower) || toLower;
      names.set(toLower, toName);

      if (accept) {
        blocks.delete(k);
        socketsOf(fromLower).forEach((s) =>
          s.emit('party:invite-accepted', { to: names.get(toLower) || toLower })
        );
      } else {
        blocks.set(k, Date.now() + BLOCK_MS);
        socketsOf(fromLower).forEach((s) =>
          s.emit('party:invite-declined', { to: names.get(toLower) || toLower, reason: 'declined' })
        );
      }
    });

    // ── START (anyone can) ──
    socket.on('party:start', (payload = {}) => {
      if (!members.has(userLower)) return;
      io.emit('party:started', { by: String(payload.user || '').trim() || userLower });
    });

    // ── DISCONNECT ──
    socket.on('disconnect', () => {
      const set = online.get(userLower);
      if (set) {
        set.delete(socket.id);
        if (!set.size) online.delete(userLower);
      }
      leaveParty();
    });
  });
};
