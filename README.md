# Song Guess Party

Real-time multiplayer music guessing game built with Next.js, Express, Socket.IO, and Spotify playlist import.

## Stack

- `client/`: Next.js App Router + Tailwind CSS
- `server/`: Express + Socket.IO + Spotify Web API integration
- In-memory room state, no database

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `server/.env`:

```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
PORT=4000
CLIENT_URL=http://localhost:3000
SPOTIFY_MARKET=IN
SPOTIFY_REDIRECT_URI=http://127.0.0.1:4000/auth/spotify/callback
```

3. Create `client/.env.local`:

```bash
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
```

4. Run the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Notes

- The host connects Spotify with OAuth, then imports playlist tracks into the room.
- Spotify playlist import keeps only tracks with a non-null `preview_url`.
- Default modes also use Spotify search and therefore need Spotify credentials.
- Lyric mode is included as a UI placeholder so you can extend it later with real lyric data.
- Add `http://127.0.0.1:4000/auth/spotify/callback` to your Spotify app Redirect URIs.
