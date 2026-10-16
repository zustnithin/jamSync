// =============================================
// JamSync API — Friends routes
//   GET  /api/users/search?q=&me=
//   POST /api/friends/request  { from, to }
//   GET  /api/friends/requests?user=
//   POST /api/friends/respond  { user, from, accept }
//   GET  /api/friends?user=
// Identity: "me"/"from"/"user" is the logged-in username (frontend sends it).
// Only real signed-up accounts can use friends (demo account excluded).
// =============================================

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const Friendship = require('../models/Friendship');

const DEMO_USER = 'nithin';

const lower = (s) => String(s || '').trim().toLowerCase();
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function realUserOrError(usernameLower, res) {
  if (!usernameLower) {
    res.status(400).json({ error: 'Login required' });
    return null;
  }
  if (usernameLower === DEMO_USER) {
    res.status(403).json({ error: 'Friends need a real account — sign up first.' });
    return null;
  }
  const user = await User.findOne({ usernameLower });
  if (!user) {
    res.status(404).json({ error: 'Account not found. Sign up first.' });
    return null;
  }
  return user;
}

const pairOf = (a, b) => [a, b].sort();

// ─── SEARCH USERS ───
// Prefix match, excludes self. Each result carries its relation to me:
// none | requested (I sent) | incoming (they sent) | friends
router.get('/users/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const me = await realUserOrError(lower(req.query.me), res);
    if (!me) return;
    if (q.length < 1) return res.json({ users: [] });

    const found = await User.find({
      usernameLower: { $regex: '^' + escapeRegExp(q.toLowerCase()) },
    })
      .limit(8)
      .lean();

    const results = [];
    for (const u of found) {
      if (u.usernameLower === me.usernameLower) continue;
      let relation = 'none';
      const [a, b] = pairOf(me.usernameLower, u.usernameLower);
      if (await Friendship.findOne({ pair: [a, b] }).lean()) {
        relation = 'friends';
      } else if (
        await FriendRequest.findOne({ fromLower: u.usernameLower, toLower: me.usernameLower }).lean()
      ) {
        relation = 'incoming';
      } else if (
        await FriendRequest.findOne({ fromLower: me.usernameLower, toLower: u.usernameLower }).lean()
      ) {
        relation = 'requested';
      }
      results.push({ username: u.username, relation });
    }
    return res.json({ users: results });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
});

// ─── SEND REQUEST ───
// If they already requested me, accept instantly and become friends.
router.post('/friends/request', async (req, res) => {
  try {
    const from = await realUserOrError(lower(req.body.from), res);
    if (!from) return;
    const toLower = lower(req.body.to);
    if (!toLower) return res.status(400).json({ error: 'Pick a user first' });
    if (toLower === from.usernameLower)
      return res.status(400).json({ error: "You can't add yourself" });

    const to = await User.findOne({ usernameLower: toLower });
    if (!to) return res.status(404).json({ error: 'User not found' });

    const [a, b] = pairOf(from.usernameLower, toLower);
    if (await Friendship.findOne({ pair: [a, b] }).lean())
      return res.json({ ok: true, status: 'friends', username: to.username });

    // They already asked me → accept on the spot
    const reverse = await FriendRequest.findOne({ fromLower: toLower, toLower: from.usernameLower });
    if (reverse) {
      await Friendship.create({ pair: [a, b] });
      await reverse.deleteOne();
      return res.json({ ok: true, status: 'friends', username: to.username });
    }

    if (await FriendRequest.findOne({ fromLower: from.usernameLower, toLower }).lean())
      return res.json({ ok: true, status: 'requested', username: to.username });

    await FriendRequest.create({
      fromLower: from.usernameLower,
      fromName: from.username,
      toLower,
      toName: to.username,
    });
    return res.status(201).json({ ok: true, status: 'requested', username: to.username });
  } catch (err) {
    if (err.code === 11000)
      return res.json({ ok: true, status: 'requested' });
    console.error('Request error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
});

// ─── INCOMING REQUESTS ───
router.get('/friends/requests', async (req, res) => {
  try {
    const me = await realUserOrError(lower(req.query.user), res);
    if (!me) return;
    const incoming = await FriendRequest.find({ toLower: me.usernameLower })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({
      requests: incoming.map((r) => ({ from: r.fromName })),
    });
  } catch (err) {
    console.error('Requests error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
});

// ─── ACCEPT / REJECT ───
router.post('/friends/respond', async (req, res) => {
  try {
    const me = await realUserOrError(lower(req.body.user), res);
    if (!me) return;
    const fromLower = lower(req.body.from);
    const accept = req.body.accept === true;

    const pending = await FriendRequest.findOne({ fromLower, toLower: me.usernameLower });
    if (!pending) return res.status(404).json({ error: 'Request not found' });

    if (accept) {
      const [a, b] = pairOf(fromLower, me.usernameLower);
      await Friendship.create({ pair: [a, b] });
    }
    await pending.deleteOne();
    return res.json({ ok: true, accepted: accept, username: pending.fromName });
  } catch (err) {
    if (err.code === 11000) {
      await FriendRequest.deleteOne({ fromLower: lower(req.body.from), toLower: lower(req.body.user) });
      return res.json({ ok: true, accepted: true });
    }
    console.error('Respond error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
});

// ─── MY FRIENDS ───
router.get('/friends', async (req, res) => {
  try {
    const me = await realUserOrError(lower(req.query.user), res);
    if (!me) return;
    const docs = await Friendship.find({ pair: me.usernameLower }).lean();
    const lowers = docs.map((d) => d.pair.find((x) => x !== me.usernameLower));
    const users = await User.find({ usernameLower: { $in: lowers } }).lean();
    const nameOf = Object.fromEntries(users.map((u) => [u.usernameLower, u.username]));
    return res.json({
      friends: lowers.map((l) => ({ username: nameOf[l] || l })),
    });
  } catch (err) {
    console.error('Friends error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
});

module.exports = router;
