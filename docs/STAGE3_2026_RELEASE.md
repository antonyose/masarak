# Masarak Stage 3 — 2026 release record

## Official artifacts frozen in the release

- Tansik Stage-2 final cutoffs, new scientific: `https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2026.htm`
- Tansik Stage-2 final cutoffs, new literary: `https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2026.htm`
- Tansik Stage-2 final cutoffs, old scientific: `https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitEO2026.htm`
- Tansik Stage-2 final cutoffs, old literary: `https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitAO2026.htm`
- Ministry Stage-3 new-system scientific vacancy PDF: `https://drive.google.com/file/d/1M2XgbDAwoLGmuLltXDr1ihYWj0YGW8Z6/view`
- Ministry Stage-3 new-system literary vacancy PDF: `https://drive.google.com/file/d/1-LTHaW0QyQwZVQSNKGDP26lo1vfVkCBJ/view`

The source URLs, retrieval timestamps, row counts, and SHA-256 hashes are stored in
`lib/coordination-data/stage3-2026.json`. The raw extracted vacancy rows are stored in
`lib/coordination-data/stage3-2026-raw.json`.

## Reconciled universe

| Branch | Canonical public/public-technological options |
| --- | ---: |
| Science | 323 |
| Mathematics | 313 |
| Literary | 135 |

Reconciliation blockers: zero unresolved public rows and zero ambiguous public rows.
Old-system Stage-3 recommendations fail closed because a separate official old-system
vacancy artifact was not found.

## Model evidence

`stage3-2026-v1` predicts the final cutoff/fit only. Availability is an official fact.
It uses robust 2021–2025 levels, sparse sector shrinkage, and a capped/shrunk same-year
calibration learned from official 2026 Stage-2 results. On 463 leave-one-out Stage-2
observations, MAE moved from 2.5899 percentage points to 1.4240; median absolute error
moved from 2.0827 to 0.8392. This is evidence for calibration, not a claimed Stage-3
probability or guarantee.

## Operational sequence

1. Run `scripts/apply-stage3-migration.ts`.
2. Run `scripts/seed-stage3-2026.ts` without `--activate`.
3. Run `scripts/verify-stage3-2026.ts` and verify 323/313/135, model inactive, and all
   existing 2026 entitlements remain `year_all_stages`.
4. Deploy and test the staged Vercel production build.
5. Run `scripts/seed-stage3-2026.ts --activate` only at the activation gate.
6. Re-run verification and smoke-test free, paid, old-report, and old-system paths.

Stage-2 `prediction_runs` are immutable and are never updated by this release. Existing
2026 seat entitlements unlock the newly inserted Stage-3 report for the same seat with
no second payment.
