# 🎸 GigRequest — Live Song Request App

A mobile-first web app that lets your audience browse your setlist and request songs during a live gig. You get email notifications and a real-time admin panel to manage the queue.

---

## Features

- **500+ song catalogue** — searchable and sortable by title or artist
- **One-tap requests** — audience enters first name, song goes to the queue
- **Email notifications** — get notified instantly when a song is requested
- **Live queue page** — audience can see what's coming up (auto-refreshes)
- **Admin panel** — mark songs as Now Playing / Up Next / Played, or remove them
- **Anti-spam** — rate limiting (3 requests per 2 minutes per IP) + duplicate detection
- **Mobile-first** — big touch targets, fast, works great on phones

---

## Project Structure

```
song-request-app/
├── client/                  # Frontend (static HTML/CSS/JS)
│   ├── css/
│   │   └── style.css        # All styles — dark stage-light theme
│   ├── js/
│   │   └── app.js           # Song list logic (search, sort, request modal)
│   ├── index.html           # Main song list page
│   ├── queue.html           # Audience-facing live queue
│   └── admin.html           # Admin panel (password-protected)
├── server/
│   ├── index.js             # Express server — API routes & static serving
│   ├── db.js                # SQLite setup, schema, seeding
│   ├── email.js             # Nodemailer email notifications
│   └── songs-data.js        # Song catalogue (~500 songs)
├── .env                     # Your local config (not committed)
├── .env.example             # Template for environment variables
├── .gitignore
├── package.json
└── README.md
```

---

## Quick Start

### Prerequisites

- **Node.js** 18 or newer — [download here](https://nodejs.org/)

### 1. Install dependencies

```bash
cd song-request-app
npm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=you@gmail.com
EMAIL_PASS=your-16-char-app-password
EMAIL_TO=you@gmail.com
ADMIN_PASSWORD=pick-a-strong-password
PORT=3000
```

> **Email is optional.** If you leave `EMAIL_USER` and `EMAIL_PASS` blank, the app runs fine — you just won't get email notifications.

### 3. Run the app

```bash
npm start
```

Open in your browser:

| Page        | URL                          | Who it's for    |
|-------------|------------------------------|-----------------|
| Song List   | `http://localhost:3000`      | Audience        |
| Live Queue  | `http://localhost:3000/queue` | Audience        |
| Admin Panel | `http://localhost:3000/admin` | You (the musician) |

---

## Gmail Setup (Email Notifications)

Gmail requires an **App Password** (not your regular password).

1. Go to [Google Account → Security](https://myaccount.google.com/security)
2. Make sure **2-Step Verification** is turned ON
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Select **Mail** → select your device → click **Generate**
5. Copy the 16-character password
6. Paste it as `EMAIL_PASS` in your `.env` file

Each song request sends an email with the song title, artist, requester name, and timestamp.

---

## API Endpoints

| Method   | Endpoint                   | Description                      |
|----------|----------------------------|----------------------------------|
| `GET`    | `/api/songs`               | Full song catalogue              |
| `POST`   | `/api/request`             | Submit a request `{songId, requester}` |
| `GET`    | `/api/queue`               | Active queue (audience view)     |
| `GET`    | `/api/admin/queue`         | Full queue incl. played (admin)  |
| `PATCH`  | `/api/admin/request/:id`   | Update status `{status}`         |
| `DELETE` | `/api/admin/request/:id`   | Remove a request                 |

Admin endpoints require `x-admin-password` header or `?pw=` query param.

---

## Customizing Your Song List

Edit `server/songs-data.js` — it's a plain JavaScript array:

```js
module.exports = [
  { title: "Song Name", artist: "Artist Name" },
  // ...add your songs here
];
```

After editing, delete the database to re-seed:

```bash
rm server/gig.db
npm start
```

---

## Deployment Suggestions

### Render (recommended for simplicity)

1. Push to GitHub
2. Create a **Web Service** on [render.com](https://render.com)
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add your `.env` variables in the Render dashboard
6. Note: SQLite works on Render with a persistent disk, or switch to Render's PostgreSQL for production

### Railway

1. Connect your GitHub repo at [railway.app](https://railway.app)
2. Add environment variables in Settings
3. Railway auto-detects Node.js and deploys

### Fly.io

```bash
flyctl launch
flyctl secrets set EMAIL_USER=you@gmail.com EMAIL_PASS=xxxx ADMIN_PASSWORD=xxxx
flyctl deploy
```

### VPS / DigitalOcean

```bash
git clone <your-repo> && cd song-request-app
npm install --production
cp .env.example .env  # then edit
npm start
# Use pm2 or systemd to keep it running
```

### Share at a Gig

At the venue, you can:
- Share a **QR code** that links to your app's URL
- Put the URL on a sign or screen near the stage
- Use a short URL service for easy typing

---

## Bonus Features Included

- **Duplicate prevention** — same person can't request the same song within 10 minutes
- **Rate limiting** — max 3 requests per 2 minutes per IP address
- **Now Playing / Up Next** — set from the admin panel, visible on the queue page
- **Admin queue management** — mark as played or remove requests entirely
- **Name memory** — the audience member's name is saved in their browser for faster repeat requests
