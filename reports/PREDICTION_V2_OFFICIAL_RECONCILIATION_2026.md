# Masarak Prediction V2 — Official 2026 Reconciliation

Verified on 2026-08-12. This artifact records the evidence used by the frozen
`stage2-2026-v2-shadow` snapshot; it does not activate or promote the model.

## Stage 2 vacancies

- Scientific official artifact: Ministry of Higher Education and Scientific
  Research verified Facebook post
  <https://www.facebook.com/MOHESREGYPT/posts/1593853608764134/>.
- Literary official artifact: Ministry of Higher Education and Scientific
  Research verified Facebook post
  <https://www.facebook.com/MOHESREGYPT/posts/1593854832097345/>.
- Reconciliation result: scientific 1,029/1,029; literary 434/434.
- Method: ordered row extraction followed by Arabic/Unicode-safe normalization.
  Both branches had zero missing, extra, or duplicated normalized rows compared
  with the frozen transport snapshot.
- Meaningful source difference: one named HTML entity (`&ndash;`) in the mirror
  transport was decoded to the official dash character. There was no semantic
  faculty or institute change.

The generator retains the stable mirror pages as reproducible transports, but
the source records point to the authoritative Ministry artifacts and fail if the
reconciled row counts change.

## Aptitude requirements

- Official artifact: Supreme Council of Universities, *Student Guide to
  Aptitude Tests 2026*
  <https://scu.eg/en/download/student-guide-to-aptitude-tests-2026/>.
- Verified families: Fine Arts (Arts), Fine Arts (Architecture), Applied Arts,
  Art Education, Music Education, and Sports Sciences.
- The V2 predicate covers the guide's official Arabic families: `فنون جميلة`,
  `فنون تطبيقية`, `تربية فنية`, `تربية موسيقية`, and both current/legacy sports
  labels (`علوم الرياضة` / `تربية رياضية`).

## Frozen result

- Raw official Stage-2 rows: 1,463.
- Public faculty/technological source rows: 887 (25 technological rows).
- Resolved branch-specific public vacancies: 1,275.
- Unresolved public vacancies: 0.
- Public institutes kept separate: 141 source rows.
- Private/higher institutes excluded: 427 source rows.
- Unknown rows failed closed: 8.
- Data hash: `22a58e294598b2d787290bd9723f99d236bcbc442791b9f82a5938e87dae68e3`.

## Staging boundary

Migration `drizzle/0010_prediction_v2_shadow.sql` is additive-only. It was not
applied during this verification because the Vercel project exposes the same
Neon/Postgres integration variables to Production and Preview; no independently
identifiable staged Neon branch was available. Applying the migration would
therefore violate the explicit prohibition on production data changes.
