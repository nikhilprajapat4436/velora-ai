# Velora AI

A full-stack AI assistant with a React/Vite frontend and an Express/MongoDB backend. It supports streamed chat responses, tool use, uploaded-PDF search, image analysis, and persistent chat history.

## Features

- Email/password and Google sign-in
- Streaming AI chat and conversation history
- Image analysis
- Image generation with Cloudflare Workers AI (Stable Diffusion XL)
- PDF upload, text extraction, embeddings, and document search
- Web search through a SearXNG instance
- Calculator, unit and currency conversion, weather, date/time, and developer tools
- Long-term memory management
- Syntax-highlighted code blocks

## Requirements

- Node.js and npm
- A MongoDB connection string
- A Groq API key
- Optional: a SearXNG instance for web search
- Optional: a Google OAuth web client for Google sign-in

## Setup

1. Install dependencies from the project root:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```dotenv
   PORT=5000
   VITE_API_URL=http://localhost:5000
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
   JWT_SECRET=replace-with-a-long-random-secret
   GROQ_API_KEY=your-groq-api-key
   SEARXNG_URL=http://localhost:8080
   GOOGLE_CLIENT_ID=your-google-oauth-client-id
   CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
   CLOUDFLARE_API_TOKEN=your-workers-ai-api-token
   ```

  `PORT` defaults to `5000`; `SEARXNG_URL` defaults to `http://localhost:8080`. Google sign-in requires the OAuth client ID configured in `src/main.jsx` to match the backend value and the authorized origins in Google Cloud.

   For a deployed frontend, set `VITE_API_URL` to the backend's public base URL (for example, `https://api.example.com`) and rebuild the frontend.

3. Start the backend from the project root:

   ```bash
   node server/server.js
   ```

4. In a second terminal, start the frontend:

   ```bash
   npm run dev
   ```

5. Open the local URL printed by Vite.

The backend at `http://localhost:5000/` is an API status endpoint; it is not the chat interface. Open the frontend URL printed by `npm run dev` (usually `http://localhost:5173/`). The local backend allows that Vite origin by default.

Web search requires SearXNG to be running at `SEARXNG_URL` with JSON search responses enabled. The MongoDB Atlas vector index should be named `vector_index` and index `chunks.embedding` for indexed document search; the server also has a local similarity fallback.

Image generation requires a Cloudflare account ID and an API token with Workers AI permission. Add them to the server `.env` and restart the backend. The API token is only used by the server; the frontend never receives it. The app uses `@cf/stabilityai/stable-diffusion-xl-base-1.0` by default. Set `CLOUDFLARE_IMAGE_MODEL` in `.env` if you later switch models.

## Production deployment

The Express server can serve both the built React app and the API from one Node service:

1. Set `NODE_ENV=production` in the hosting dashboard.
2. Build with `npm ci && npm run build`.
3. Start with `node server/server.js` (the host supplies `PORT`).
4. Configure `MONGODB_URI`, a strong unique `JWT_SECRET`, `GROQ_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` as server-side environment secrets. Never put provider tokens in `VITE_*` variables.
5. If the frontend and API use different domains, set `CORS_ORIGINS` to the exact frontend origin(s), comma-separated. For a single-origin deployment, leave it unset.

The repository also includes a multi-stage `Dockerfile` for container hosts. Build with `docker build -t velora-ai .`, then run with the required environment variables supplied by the host (never copy `.env` into the image). Map the host port to container port `5000`; the server reads the platform-provided `PORT`.

When the frontend is served by this same Express process, it uses same-origin `/api` requests and needs no `VITE_API_URL`. For separate frontend hosting, set `VITE_API_URL` at build time and configure `CORS_ORIGINS` on the backend. `CORS_ORIGINS` is empty by default for a single-origin web deployment; the Render Blueprint explicitly allows `https://localhost` for the Capacitor Android app.

Production startup refuses to run if the database/provider secrets are missing or `JWT_SECRET` is shorter than 32 characters. Generate a new secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and add it directly to the hosting secret settings.

Image generation is limited to five requests per authenticated account per 15 minutes per server process to protect the provider quota. If deploying multiple backend instances, use a shared rate-limit store at the hosting layer. Keep database network access restricted to the backend host and configure Google OAuth with the deployed frontend origin if Google sign-in is enabled.

## Android APK

The Android app uses Capacitor to package the built React interface. Its API requests go to the deployed Render backend configured in `.env.android`; this file contains only the public API URL, never credentials. The Render service must allow the Capacitor WebView origin `https://localhost` through `CORS_ORIGINS`.

Requirements for a local APK build: Node.js 22 or newer, Android Studio 2025.2.1 or newer, and an Android SDK (API 24 or newer). Then run:

```bash
npm install
npm run build:android
npm run android:open
```

In Android Studio, build the APK from **Build → Build Bundle(s) / APK(s) → Build APK(s)**. The website shows an Android-only download banner; its link points to the latest `VeloraAI.apk` GitHub Release. The `Build Android APK` workflow creates that installable debug-signed test APK on pushes to `main` and can also be started manually from GitHub Actions. The GitHub repository must be public for anyone to download the release. Android may ask users to allow installs from their browser. This debug build is for testing, not Google Play distribution; a release signing key is needed for a production release. Re-run `npm run build:android` after web app changes so the Android project receives the updated build.

### Render test deployment

The root `render.yaml` is a free-tier Docker Web Service blueprint for testing. Connect the Git repository containing this project to Render, select the blueprint, and provide the prompted values. Use the same Google OAuth client ID for `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`; add the deployed `onrender.com` origin to that OAuth client's authorized JavaScript origins. `SEARXNG_URL` must point to a reachable SearXNG instance if web search should work; the app's local `localhost:8080` default is not reachable from Render. For SearXNG's local Docker Compose setup, copy `searxng/.env.example` to `searxng/.env` and set a private `SEARXNG_SECRET`; do not commit that `.env` file.

The app stores account and chat data in MongoDB, so the Render service's ephemeral filesystem does not hold user records. Free Render web services sleep after 15 minutes without traffic and can take about a minute to wake up; this is suitable for testing, but can make the first request feel slow. See [Render's free plan limitations](https://render.com/docs/free).

## Scripts

- `npm run dev` — start the Vite frontend
- `npm run build` — create a production frontend build in `dist/`
- `npm run preview` — preview the production frontend build
- `npm run lint` — run ESLint

Start the Express backend separately with `node server/server.js`.

## Security

- Keep `.env` private; it is excluded by `.gitignore`.
- `.env.example` lists required and optional variables without containing real credentials.
- Use a unique, long `JWT_SECRET` and protect your MongoDB and Groq credentials.
- Google OAuth client IDs are public identifiers; restrict allowed origins in Google Cloud.
