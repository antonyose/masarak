# Masarak Prediction V2 Shadow — AntiGravity Handoff

## Status

- Model version: `stage2-2026-v2-shadow`
- Production activation: **blocked / not requested**
- Production V1, immutable prediction snapshots, seat entitlements, and payment logic remain unchanged.
- Migration: `drizzle/0010_prediction_v2_shadow.sql` is generated but **not applied**.
- Shadow writes default to off through `PREDICTION_V2_SHADOW_WRITE_ENABLED=false`.

## Frozen snapshot reconciliation

The committed V2 snapshot is `lib/coordination-data/prediction-v2-2026.json`.

- Raw 2026 Stage-2 mirror rows: 1,029 scientific + 434 literary = 1,463.
- Public university/public technological source rows: 887.
- Branch-specific resolved public vacancy rows: 1,275.
- Public technological source rows: 25.
- Public institute rows: 141, stored only in the separate institute layer.
- Private/higher institute rows: 427, excluded from the core recommendation universe.
- Unclassified rows: 8, failed closed and retained in diagnostics.
- Current unresolved public vacancies: 0.
- Current ambiguous aliases: 0.
- Historical raw official rows, 2021–2025: 8,508.
- Canonical institutions: 38.
- Physical faculty/campus identities: 657.
- Admission options: 1,805.
- Contextual alias records: 2,932.
- Data hash: `8b7628cf43a095502502f5a5cf4b607bead8cbc4ea9d4f1505fa349185be815e`.

The Stage-2 mirror is complete relative to the frozen publisher pages, but it is Tier B. Before any activation, reconcile it row-for-row with an archived official Ministry/Tansik artifact. Also reconcile aptitude flags with the official 2026 aptitude guide. The model enforces both as activation blockers.

## Quality results

| Evaluation | N | MAE | Median AE | P80 | P90 | Interval coverage |
|---|---:|---:|---:|---:|---:|---:|
| Rolling 2024 | 1,450 | 3.1986 | 2.5366 | 5.1720 | 6.2878 | 0.7069 |
| Rolling 2025 | 1,330 | 2.0488 | 1.5377 | 3.2191 | 4.3081 | 0.9526 |
| 2026 Stage-1 validation | 223 | 1.4878 | 1.4714 | 2.1055 | 2.5103 | 0.9238 |

Score-band report metrics for eligible rows:

- all-red report rate: 0
- zero-realistic-option rate: 0
- mean top-5 usefulness: 1
- mean top-10 usefulness: 1

Model-quality and product-quality gates pass. Data-quality and overall activation gates fail closed because the official Stage-2 artifact and 2026 aptitude guide are not yet reconciled.

## Reported 223.5 / 320 regression

For Science, Alexandria, 69.84375%, with aptitude-gated choices excluded:

- exact current public candidates: 526
- modeled candidates: 465
- candidates without exact history: 4 (not predicted)
- aptitude-gated candidates excluded: 57
- realistic Green/Yellow options: 240
- Orange options: 55
- Red options: 170
- Red cards rendered: 5; another 165 remain collapsed
- Stage-3 forecast cards: 10, always labelled `متوقع يظهر في المرحلة الثالثة`

The first options are score-relevant Yellow choices near 69.84%, rather than nearby impossible choices. The coverage warning remains active because the official Stage-2 artifact is not reconciled and four current options have no exact historical identity.

## AntiGravity review/apply sequence

Do not run these against production as part of this handoff.

1. Review `drizzle/0010_prediction_v2_shadow.sql`; confirm it is additive and has no destructive statement.
2. Verify the intended staged Neon connection and backup/recoverability.
3. Re-run validation locally:

   ```powershell
   .\node_modules\.bin\tsx.cmd scripts\build-prediction-v2-data.ts
   .\node_modules\.bin\tsx.cmd scripts\backtest-prediction-v2.ts
   .\node_modules\.bin\tsx.cmd scripts\seed-prediction-v2-shadow.ts --dry-run
   ```

4. Apply the reviewed migration to staged Neon using the repository's approved migration procedure.
5. Seed only the inactive shadow model:

   ```powershell
   .\node_modules\.bin\tsx.cmd scripts\seed-prediction-v2-shadow.ts
   ```

6. Confirm `model_versions.version = 'stage2-2026-v2-shadow'` has `activated_at IS NULL` and that `coordination_cycles.active_model_version_id` still points to V1.
7. In staged Vercel only, set `PREDICTION_V2_SHADOW_WRITE_ENABLED=true` after the migration and inactive seed succeed.
8. Exercise real staged requests and inspect `prediction_shadow_runs`; student responses must remain V1.
9. Use `/api/admin/coordination/v2-shadow` and the admin overview to inspect coverage, regression output, metrics, and blockers.
10. Do not promote or switch the active model until both official-data blockers are cleared and the same committed data hash is re-evaluated.

Year-wide `seat_entitlements` are untouched, so a future official Stage-3 model version can create new immutable prediction snapshots without charging an already entitled 2026 seat again.
