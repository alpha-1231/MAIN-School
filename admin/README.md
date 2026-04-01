# Admin Notes

The complete setup guide is in [`README.md`](../README.md).

Admin-specific files:

- Plan rules: [`config/plan-catalog.json`](./config/plan-catalog.json)
- Card index: [`data/basic/_cards.json`](./data/basic/_cards.json)
- Detail files: [`data/detailed/`](./data/detailed)
- Payment history: [`data/payments/`](./data/payments)

Run the admin from this folder:

```bash
npm install
npm start
```

Regenerate demo data:

```bash
node scripts/generate-dummy-data.js
```
