// =============================================
// JamSync API — Express + MongoDB (Mongoose)
// Endpoints:
//   GET  /api/health
//   POST /api/signup  { username, password }
//   POST /api/login   { username, password }
// Passwords are stored as bcrypt hashes, never plain text.
// =============================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

// Realtime layer for party rooms (see party.js for the protocol)
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
require('./party')(io);

const DEMO_USER = 'nithin';
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

mongoose
  .connect(process.env.MONGODB_URI, { dbName: process.env.DB_NAME || 'jamsync' })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ─── SIGNUP ───
app.post('/api/signup', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (username.length < 3)
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (!USERNAME_RE.test(username))
      return res
        .status(400)
        .json({ error: 'Username can only have letters, numbers, and underscores' });
    if (username.toLowerCase() === DEMO_USER)
      return res.status(409).json({ error: 'Username already taken. Try another one.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const exists = await User.findOne({ usernameLower: username.toLowerCase() });
    if (exists)
      return res.status(409).json({ error: 'Username already taken. Try another one.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      usernameLower: username.toLowerCase(),
      passwordHash,
    });

    return res.status(201).json({ ok: true, username: user.username });
  } catch (err) {
    // Race between two simultaneous signups with the same name
    if (err.code === 11000)
      return res.status(409).json({ error: 'Username already taken. Try another one.' });
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
});

// ─── LOGIN ───
app.post('/api/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });

    const user = await User.findOne({ usernameLower: username.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Wrong username or password.' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Wrong username or password.' });

    return res.json({ ok: true, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
});

app.use('/api', require('./routes/friends'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🎵 JamSync API + Party socket on http://localhost:${PORT}`));
