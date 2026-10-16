# JamSync Backend

Express + MongoDB (Mongoose) API for JamSync auth.

## Setup

1. Copy `.env.example` to `.env` and fill in your MongoDB Atlas connection string.
2. Install deps and start:

```bash
npm install
npm start
```

Server runs on `http://localhost:5000` (or `PORT` from `.env`).

## Endpoints

| Method | Path          | Body                     | Success        |
| ------ | ------------- | ------------------------ | -------------- |
| GET    | `/api/health` | —                        | `{ ok: true }` |
| POST   | `/api/signup` | `{ username, password }` | `201`          |
| POST   | `/api/login`  | `{ username, password }` | `200`          |

- Usernames: min 3 chars, letters/numbers/underscores only, case-insensitive unique.
- `nithin` is reserved for the offline demo account.
- Passwords stored as bcrypt hashes, never plain text.

> `.env` (with your real password) is git-ignored and never pushed to GitHub.
