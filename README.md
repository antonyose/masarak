# مسارك

Arabic RTL MVP for Egyptian Thanaweya Amma result lookup and deterministic faculty prediction.

## What is implemented

- Polished responsive homepage with exactly two primary tools.
- Score/percentage conversion across the configured 320 and 410 scales.
- POST-only result search with exact seat-number and normalized Arabic-name flows.
- Raw nationwide rank for each live 2026 result, calculated from all available scores.
- Direct transfer from a found result into faculty prediction.
- Deterministic prediction categories and explicit confidence/disclaimer states.
- Optional selection of all 27 governorates with nearby-first and all-governorates views.
- Expanded catalog of 101 primary government options using official 2025 Tansik cutoffs.
- Likelihood-first recommendations that hide distant options until the student requests them.
- Original “مسارك” logo, favicon, manifest, and optimized responsive hero artwork.
- Drizzle/PostgreSQL schema with exact-seat, score, and trigram-search indexes.
- Re-runnable spreadsheet inspection, validation, import, and distribution scripts.
- Static faculty, methodology, data source, privacy, terms, and disclaimer routes.
- Vitest unit coverage and Playwright mobile/desktop journey coverage.

## Local development

```bash
pnpm install
pnpm index:results:local
pnpm dev
```

`index:results:local` verifies the inspected 2026 workbook and builds a private
SQLite search index under `data/private/`. When `DATABASE_URL` is absent, the
server automatically uses that index for real name and seat-number searches.
If neither data source exists, the UI falls back to a small synthetic preview
dataset and clearly labels it as a preview.

## Data workflow

```bash
pnpm inspect:sheets
pnpm validate:results
pnpm index:results:local
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
pnpm import:results
pnpm calculate:distributions
```

The source workbooks stay in `sheets/` and are excluded from Git. Inspection
reports redact names and mask seat numbers. The optional local index stays in
the ignored `data/private/` directory. Personal data is never written under
`public/`.

## Environment

Copy `.env.example` to `.env.local` and provide a Neon or PostgreSQL connection string:

```dotenv
DATABASE_URL=postgresql://...
```

## Important data finding

The current four workbooks contain 3,229,828 rows, but none includes branch data. The 2025 workbook also contains 3,595 scores above the stated new-system maximum of 320. Those records remain unknown until an explicit system discriminator or authoritative mapping is supplied; the app does not invent one.
