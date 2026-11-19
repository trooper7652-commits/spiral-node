# Spiral Node website

The Next.js site for Spiral Node: a product page (`/`), the script gallery (`/scripts`), a devlog (`/devlog`), a press page (`/press`), a company page (`/company`) and `/try`, a simulator that runs the real Spiral OS in the browser (Pyodide in a Web Worker, state kept in this browser's IndexedDB). Design notes live in `design/` (`DESIGN.md`, `device.md`, `content.md`, screenshots).

## Run it

Needs Node 20 or newer.

```
npm install
npm run dev      # http://localhost:3000 (runs scripts/prepare-assets.mjs first)
npm test         # vitest unit tests
npm run e2e      # Playwright, Chromium: builds, serves out/ on :3100, runs tests/e2e
```

`npm run build` writes the static site to `out/`, and `npm start` serves it with Vite's preview server (`next start` does not work with a static export). Set `E2E_PORT=3101` to serve on another port.

## How the OS gets into the page

`scripts/prepare-assets.mjs` runs before `dev` and `build`. It never copies by hand:

- zips `../os/spiral/` and `../os/welcome-messages.txt` into `public/spiral-os.zip` (deterministic, so the demo always matches the OS source);
- copies the pinned Pyodide runtime (`pyodide` 0.29.5 from `node_modules`) into `public/pyodide/`, so nothing loads from a CDN;
- copies the vendored Pillow wheel from `vendor/pyodide/` into `public/pyodide/`, after checking its sha256 against `pyodide-lock.json`. The build fails on a mismatch or an unlisted wheel.

`public/pyodide/` is generated and not committed. `public/spiral-os.zip` is committed, because Vercel may build without `../os`, and `tests/unit/prepare-assets.test.ts` keeps it byte-identical to the OS source. Nothing heavy loads until you ask: the worker and Pyodide start only after "Try it right here" in the home page hero, or "Power on" on `/try`.

## Pixel art

The art is drawn by a script. To regenerate `public/art/`, the link preview images in `public/og/` and the logo in `public/press/`:

```
python art/make_art.py
```

It needs Python with Pillow and is deterministic.

## Privacy

- Search engines: `SITE.indexable` in `lib/site.ts` is the one switch. While it is `false`, every page carries `noindex, nofollow`.
- Vercel Web Analytics only (cookieless, first-party `/_vercel/insights`, loaded only in Vercel builds). No cookies, and the fonts are self-hosted.
- Third-party requests: the home page asks the GitHub API (`api.github.com`) for the star count and contributors, and loads their avatars from `avatars.githubusercontent.com`. The sign-up popup asks the same API for the star count after you subscribe.
- The sign-up form posts the email you type to the newsletter service's form (`SITE.newsletterFormUrl`). The site itself never stores it.
- The sign-up popup remembers, in this browser's localStorage only, when you closed it and whether you subscribed.
- The simulator saves only to this browser (IndexedDB), and "Reset device" erases it.

## Deploying

The Vercel project uses this folder as its root directory. `vercel.json` skips any commit whose message lacks `[deploy]`, so only commits tagged `[deploy]` build.

The site is a static export (`output: "export"`, written to `out/`), because every page is static. Response headers therefore live in `vercel.json`, and a route handler, middleware or any other server-only feature fails the build.

`/pyodide/*` is served with `max-age=0, must-revalidate` (the file names are not versioned, so a Pyodide upgrade must never mix cached old and new files; repeat visits get cheap 304 revalidations). `/spiral-os.zip` keeps its name between builds, so it is always revalidated.
