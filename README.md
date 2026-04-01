# EduData Directory Setup

This project has two parts:

- `admin/`: local admin panel and JSON data manager
- `user/`: public React app that reads `basic` and `detailed` JSON data

The public app is now ready to fetch data directly from GitHub Raw.
Business detail data is fetched live only when a card is opened, and it is cleared from app state when the detail panel is closed.

## Folder layout

```text
MAIN/
├── admin/
│   ├── config/
│   │   └── plan-catalog.json
│   ├── data/
│   │   ├── basic/
│   │   │   └── _cards.json
│   │   ├── detailed/
│   │   └── payments/
│   ├── public/
│   ├── scripts/
│   ├── package.json
│   └── server.js
├── user/
│   ├── .env.example
│   ├── src/
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Pricing and plans

Plans are controlled from [`admin/config/plan-catalog.json`](./admin/config/plan-catalog.json).

Current setup:

- `Annual`: 12 months, rate `100` per month, total `1200`
- `Yearly`: 12 months, `10%` discount, total `1080`
- `6 Months`: 6 months, `5%` discount, total `570`

If you want to change plan names, durations, discounts, or base rate later, edit only that file and restart the admin server.

## Admin setup

From [`admin/`](./admin):

```bash
npm install
npm start
```

Admin runs on:

```text
http://localhost:3000
```

What the admin does:

- edits the `basic`, `detailed`, and `payments` JSON files
- calculates subscription expiry from the selected plan
- auto-fills plan amount from the plan catalog
- exposes `/api/meta/plans` so the admin UI stays in sync with the server pricing rules

If you want to regenerate the demo dataset:

```bash
node scripts/generate-dummy-data.js
```

## Public user app setup

From [`user/`](./user):

```bash
npm install
npm run dev
```

Local dev runs on:

```text
http://localhost:5173
```

For production build:

```bash
npm run build
```

## GitHub Raw data setup

If you created a separate GitHub repository for public data, upload:

- `basic/`
- `detailed/`

You do not need to upload `payments/` for the public app.

### Option A: repo root contains `basic` and `detailed`

Example repo structure:

```text
your-data-repo/
├── basic/
│   └── _cards.json
└── detailed/
    ├── test-1.json
    └── test-2.json
```

Then create `user/.env` with:

```env
VITE_PUBLIC_DATA_ROOT=https://raw.githubusercontent.com/<github-username>/<repo-name>/<branch>
```

### Option B: repo root contains `data/basic` and `data/detailed`

Example repo structure:

```text
your-data-repo/
└── data/
    ├── basic/
    │   └── _cards.json
    └── detailed/
        ├── test-1.json
        └── test-2.json
```

Then use:

```env
VITE_PUBLIC_DATA_ROOT=https://raw.githubusercontent.com/<github-username>/<repo-name>/<branch>/data
```

After changing `.env`, restart the Vite dev server or rebuild the app.

## How the public app fetches data now

- Card list: `basic/_cards.json`
- Card detail on click: `detailed/<slug>.json`
- Detail fetch mode: live, `no-store`
- Detail persistence after close: not kept in cache
- Saved businesses: still stored locally in browser local storage

Only active subscriptions are shown in the public app.

## How to modify data later

### Change business data

Use the admin panel, then commit and push the updated JSON files from:

- [`admin/data/basic/_cards.json`](./admin/data/basic/_cards.json)
- [`admin/data/detailed/`](./admin/data/detailed)

If your public app reads from a separate data repo, copy or push those updated folders to that repo.

### Change plans

Edit:

- [`admin/config/plan-catalog.json`](./admin/config/plan-catalog.json)

Then restart the admin server.

### Change public data source

Edit:

- `user/.env`

Change `VITE_PUBLIC_DATA_ROOT` to the new GitHub Raw base URL, then restart `npm run dev` or rebuild.

### Change public fetch logic

Edit:

- [`user/src/data-source.js`](./user/src/data-source.js)

This file controls:

- local API mode
- GitHub Raw mode
- public record filtering
- raw path building

## Recommended publish flow

1. Update data in the admin panel.
2. Verify the files inside `admin/data/basic` and `admin/data/detailed`.
3. Push those public folders to your separate GitHub data repo.
4. Build the user app.
5. Deploy the user app.

## Important notes

- The public app does not read `payments/` from GitHub Raw.
- The admin app still uses local `payments/` for internal tracking and reports.
- If you deploy the user app outside `/user/`, you may also want to adjust [`user/vite.config.js`](./user/vite.config.js).
