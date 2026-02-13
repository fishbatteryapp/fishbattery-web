# fishbattery-web

Standalone website for Fishbattery Launcher.

## Pages

- `/` -> simple front page (`index.html`)
- `/download.html` -> latest stable download page from GitHub releases
- `/login.html` -> sign in / create launcher account
- `/account.html` -> account settings (display name/profile picture)
- `/upgrade.html` -> upgrade and billing actions against your auth API

## Run locally

```powershell
cd fishbattery-web
npm run dev
```

Then open:

- `http://localhost:5176/`
- `http://localhost:5176/download.html`
- `http://localhost:5176/login.html`
- `http://localhost:5176/account.html`
- `http://localhost:5176/upgrade.html`

## API configuration

The site is wired to `https://api.fishbattery.app`.

Homepage behavior:
- Primary download button tries to fetch latest stable Windows `.exe` from GitHub releases.
- If fetch fails, it falls back to `/download.html`.

## Deploy

Deploy this folder as a static site (Cloudflare Pages, Netlify, Vercel static, GitHub Pages, etc.).
