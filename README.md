# EduData Directory Setup

This repo has two apps:

- `admin/`: local admin panel, reports, expenses, payment tracking, JSON management
- `user/`: public React app for end users

The public app can now read data from GitHub Raw, business details are fetched live on click, and the detail payload is cleared from app state when the detail panel closes.

## Folder layout

```text
MAIN/
├── .env.example
├── admin/
│   ├── config/
│   │   └── plan-catalog.json
│   ├── data/
│   │   ├── basic/
│   │   │   └── _cards.json
│   │   ├── detailed/
│   │   ├── expenses.json
│   │   ├── notes.json
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

## 1. Create the env file

Copy the repo env example:

```bash
copy .env.example .env
```

Main settings inside `.env`:

```env
ADMIN_HOST=0.0.0.0
ADMIN_PORT=3000
ADMIN_SERVE_USER_BUILD=true
ADMIN_USER_ROUTE=/user
ADMIN_GIT_REPO_PATH=.
ADMIN_GIT_REMOTE=origin
ADMIN_GIT_DEFAULT_BRANCH=
ADMIN_DB_REPO_PATH=
ADMIN_DB_REMOTE=origin
ADMIN_DB_DEFAULT_BRANCH=
ADMIN_DB_BASIC_TARGET=basic
ADMIN_DB_DETAILED_TARGET=detailed

VITE_DEV_HOST=0.0.0.0
VITE_DEV_PORT=5173
VITE_ADMIN_API_ORIGIN=http://localhost:3000
VITE_USER_BASE=/user/
VITE_PUBLIC_DATA_ROOT=
```

What these do:

- `ADMIN_PORT`: admin server port
- `ADMIN_USER_ROUTE`: where the built user app is served from the admin server
- `ADMIN_GIT_*`: repo settings used by the Source App
- `ADMIN_DB_*`: repo settings used by the DB Manager to mirror `admin/data/basic` and `admin/data/detailed`
- `VITE_ADMIN_API_ORIGIN`: API target for the user app in local dev
- `VITE_USER_BASE`: build base path for the deployed user app
- `VITE_PUBLIC_DATA_ROOT`: GitHub Raw base URL for public content

`user/.env.example` is kept only for app-only overrides. The repo root `.env` is the preferred shared setup.

## 2. Install and run the admin app

From `admin/`:

```bash
npm install
npm start
```

Default URL:

```text
http://localhost:3000
```

The admin app manages:

- `basic/_cards.json`
- `detailed/*.json`
- `payments/<slug>/*.json`
- `expenses.json`
- `notes.json`

## 3. Install and run the user app

From `user/`:

```bash
npm install
npm run dev
```

Default local URL:

```text
http://localhost:5173
```

Production build:

```bash
npm run build
```

If `ADMIN_SERVE_USER_BUILD=true`, the admin server will also serve the built user app from:

```text
http://localhost:3000/user
```

## 4. Plans and future price changes

Plans are controlled from:

- `admin/config/plan-catalog.json`

Current catalog:

- `Annual`: 12 months at the standard monthly rate
- `Yearly`: 12 months, 10% discount
- `6 Months`: 6 months, 5% discount

Current base monthly rate:

- `base_monthly_rate: 100`

### How to change the rate later

If you later change:

```json
"base_monthly_rate": 100
```

to:

```json
"base_monthly_rate": 200
```

then the behavior is now:

- old paid records stay unchanged in `admin/data/payments/<slug>/*.json`
- the current active subscription amount stays as it was until the next renewal cycle
- the next new renewal uses the latest catalog amount by default
- editing an old payment record keeps that old stored amount unless you manually change it

This means past payments do not conflict with future pricing.

### Where the old amount is preserved

Historical payment snapshots are stored per payment file:

- `admin/data/payments/<business-slug>/<payment-id>.json`

So reports always read the real paid amount from the saved payment history.

## 5. Reports, analytics, and expenses

The Reports app now includes:

- monthly, quarterly, and yearly views
- year-first filtering for monthly and quarterly reports
- bar graph comparison for revenue, expenses, and net
- add / edit / delete expense management
- CSV export with report-friendly structure

Expense storage file:

- `admin/data/expenses.json`

Every expense record contains:

- title
- category
- amount
- currency
- incurred date
- notes

Use the Reports window to:

- choose a year first, then inspect months or quarters inside that year
- add a new expense
- edit an existing expense
- delete an expense
- export the current report as CSV

Yearly CSV export now includes:

- the selected year summary
- a monthly breakdown for that same year
- all 12 months even when a month has no data

## 6. GitHub Raw and DB mirror setup

If you created another GitHub repo for public data, upload only:

- `basic/`
- `detailed/`

You do not need to upload:

- `payments/`
- `expenses.json`
- `notes.json`

### Public data repo structure

Option A:

```text
your-data-repo/
├── basic/
│   └── _cards.json
└── detailed/
    ├── business-1.json
    └── business-2.json
```

Then in `.env`:

```env
VITE_PUBLIC_DATA_ROOT=https://raw.githubusercontent.com/<github-username>/<repo-name>/<branch>
```

Option B:

```text
your-data-repo/
└── data/
    ├── basic/
    │   └── _cards.json
    └── detailed/
        ├── business-1.json
        └── business-2.json
```

Then in `.env`:

```env
VITE_PUBLIC_DATA_ROOT=https://raw.githubusercontent.com/<github-username>/<repo-name>/<branch>/data
```

After changing `.env`, restart the admin server and the user dev server, or rebuild the user app.

### DB Manager env setup

Use the admin home `DB Manager` app to mirror business files into a second repository.

Recommended `.env` values:

```env
ADMIN_DB_REPO_PATH=../your-public-data-repo
ADMIN_DB_REMOTE=origin
ADMIN_DB_DEFAULT_BRANCH=main
ADMIN_DB_BASIC_TARGET=basic
ADMIN_DB_DETAILED_TARGET=detailed
```

What DB Manager does:

- mirrors `admin/data/basic/*.json` into the target repo `basic/`
- mirrors `admin/data/detailed/*.json` into the target repo `detailed/`
- stages, commits, pulls, and pushes from the GUI
- keeps `payments`, `expenses`, and `notes` out of the public data repo

Typical DB Manager flow:

1. Set `ADMIN_DB_REPO_PATH` to the cloned public data repository on your PC.
2. Open `DB Manager` from the admin desktop.
3. Click `Mirror Data`.
4. Click `Stage All`, `Commit`, and `Push`, or use `Quick Publish`.

## 7. Public app behavior

The public app now works like this:

- list page fetch: `basic/_cards.json`
- detail fetch on click: `detailed/<slug>.json`
- fetch mode: live with `no-store`
- detail close behavior: detail data is removed from state and fetched again next time
- saved businesses: stored only in browser local storage

Only businesses with active subscriptions are shown publicly.

## 8. Featured businesses

Featured businesses are controlled by:

- `is_featured` on each business record

You can change that from the admin form.

Public app behavior:

- when a district filter is selected, a featured section appears
- if that district has featured businesses, a `View featured` button opens a popup
- inside the popup, users can:
  - see all featured businesses in that district
  - open live details
  - save or unsave them

## 9. How to modify things later

### Change plan prices, duration, or discount

Edit:

- `admin/config/plan-catalog.json`

### Change business content

Use the admin panel, or directly edit:

- `admin/data/basic/_cards.json`
- `admin/data/detailed/*.json`

### Change payment history

Edit payment files inside:

- `admin/data/payments/<slug>/`

### Change expenses

Use the Reports expense manager, or edit:

- `admin/data/expenses.json`

### Change the GitHub Raw source

Edit:

- `.env`

Then change:

- `VITE_PUBLIC_DATA_ROOT`

### Change the DB mirror target repo or folders

Edit:

- `.env`

Then change:

- `ADMIN_DB_REPO_PATH`
- `ADMIN_DB_BASIC_TARGET`
- `ADMIN_DB_DETAILED_TARGET`

### Change where the user build is served

Edit:

- `.env`

Then change:

- `ADMIN_USER_ROUTE`
- `VITE_USER_BASE`

## 10. Recommended workflow

1. Update businesses in the admin app.
2. Renew subscriptions in Payment Center.
3. Add expenses in Reports.
4. Use `DB Manager` to mirror and push only `basic/` and `detailed/` to the public data repo.
5. Build and deploy the user app.

## 11. Demo data

If you want to regenerate the sample data after changing the plan catalog:

```bash
cd admin
node scripts/generate-dummy-data.js
```

Do this only for demo/sample data, because it overwrites the generated dummy dataset.

The dummy-data generator now marks generated businesses as featured so the public featured section is easy to test.
