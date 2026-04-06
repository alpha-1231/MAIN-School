# Admin Notes

The complete setup guide is in [`README.md`](../README.md).

Admin-specific files:

- Plan rules: [`config/plan-catalog.json`](./config/plan-catalog.json)
- Public card index: [`../basic/_cards.json`](../basic/_cards.json)
- Public detail files: [`../detailed/`](../detailed)
- Payment history: [`data/payments/`](./data/payments)

Set `ADMIN_BUSINESS_DATA_ROOT` in [`admin/.env.example`](./.env.example) if your `basic/` and `detailed/` folders live somewhere else.

Run the admin from this folder:

```bash
copy .env.example .env
npm install
npm start
```

Keep `ADMIN_ALLOW_REMOTE_ACCESS=false` unless you intentionally want the admin desktop and private admin APIs exposed beyond localhost.

Regenerate demo data:

```bash
node scripts/generate-dummy-data.js
```
