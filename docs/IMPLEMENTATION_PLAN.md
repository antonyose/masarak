# Masarak 2026 Stage-2 Implementation Plan

This document is the authoritative implementation plan for the next Masarak production upgrade. It is planning only: no schema migration, deployment, production promotion, or application change is performed by this document.

Implementation generated the reviewed additive migrations `drizzle/0002_stage2_launch.sql`, `drizzle/0003_stage2_indexes.sql`, and the idempotent schema-alignment migration `drizzle/0004_schema_alignment.sql`; it also generated `scripts/seed-stage2.ts` and the audited owner resolver `scripts/promote-owner-admin.ts`. Applying them remains an AntiGravity/owner action.

# 1. Current Codebase Findings

- The repository is a Next.js 15 App Router application using React 19, TypeScript, Drizzle ORM, Neon PostgreSQL, Better Auth, Cairo typography, and an established Arabic RTL design system.
- Google OAuth is complete. `lib/auth.ts`, `lib/auth-client.ts`, and `app/api/auth/[...all]/route.ts` already implement Better Auth against Neon. This work must extend that configuration, not replace it.
- `lib/prediction.ts` contains a hardcoded catalog of 101 government options. It derives 2026 ranges from 2025 cutoffs with fixed offsets, estimates national rank from a synthetic 730,000-student curve, and has no Stage-1 fact or Stage-2 vacancy state.
- `app/api/predict/route.ts` returns the complete personalized recommendation array to every client. `components/tool-experience.tsx` hides that array with Instagram/localStorage UI, which is not authorization.
- `app/api/result-search/route.ts` currently chooses Neon, local SQLite, or demo rows. There is no committed Turso client. Production must instead use Turso exclusively for the 919,396-row result dataset.
- The verified 2026 result data has `education_system=new` and `branch=unknown` for all 919,396 rows. It contains a national rank but no verified Science/Math/Literary distribution, so it cannot support branch percentile mode.
- The Neon schema already contains faculty/catalog concepts, historical cutoff placeholders, analytics, rate limits, and Better Auth tables. Historical 2023/2024 cutoffs are not imported or used; 2025 values exist only in the TypeScript catalog.
- The current admin route uses `ADMIN_PASSWORD`, an insecure fallback password, and a fixed cookie value. It must be removed in favor of Better Auth session and database role checks.
- No Vercel Blob client is committed. The private Blob store and credentials exist outside the repository.
- `lib/analytics.ts` creates its table/index at runtime. New application schema must use explicit reviewed Drizzle migrations rather than runtime DDL.
- Baseline checks passed before planning: 15 Vitest tests and TypeScript compilation. Existing tests describe the legacy 2025 engine and will require focused replacement.
- Preserve unrelated worktree state: `tsconfig.tsbuildinfo` is modified, while `.vercelignore` and `TANSIK_2026_STAGE2_RESEARCH_CONTEXT.md` are untracked.

# 2. Target Architecture

- **Next.js:** renders public, account, payment, and admin UI; Route Handlers provide all data boundaries. Client components never receive secrets, Blob credentials, or unauthorized premium payloads.
- **Better Auth + Neon:** authenticates Google and email/password users. Neon stores users, roles, saved Turso snapshots, coordination/model data, prediction snapshots, settings, payments, ledger, entitlements, rate limits, and audit logs.
- **Turso:** remains the sole production source for `student_results`, `result_metadata`, and `student_results_fts`. It is read-only from application request paths.
- **Private Vercel Blob:** stores receipt evidence only. Neon stores the random Blob key and receipt hash, never a public receipt URL.
- **Prediction service:** a deterministic server-only module loads the active coordination cycle/model from Neon, applies hard-fact and vacancy rules, calculates predictions, and produces a serializable immutable report snapshot. No LLM participates in threshold calculation.
- **Authorization service:** central helpers enforce session, ownership, admin role, and all-2026 entitlement checks. Every protected route uses these helpers rather than client state.
- Add `@libsql/client` and `@vercel/blob` during implementation. Keep `db/client.ts` as the Neon boundary and add separate server-only Turso and Blob modules.

API boundaries:

- Public: `POST /api/result-search`, `POST /api/predictions/preview`.
- Authenticated: saved-student CRUD limited to owned records, immutable prediction creation/history, account summaries, payment creation/upload/status.
- Premium: full prediction retrieval by ID after session, ownership, student relationship, and entitlement verification.
- Admin: payment list/detail/review, private receipt proxy, settings, coordination/model state, role management, and audit history.

# 3. Database Schema Changes

All changes are additive Neon migrations. Use UUID primary keys for new transactional tables, timezone-aware timestamps, explicit foreign keys, and stable enums. Do not recreate Better Auth tables or alter Turso through Drizzle.

## Existing `user`

- Add `phone text NULL` and `role user_role NOT NULL DEFAULT 'user'`.
- Normalize Egyptian phones before storage; do not make phone globally unique because family members may share one.
- `user_role`: `user`, `admin`.
- Better Auth email signup requires phone at the application boundary. Google users may remain phone-null until payment.
- Index `role`; only an audited owner-promotion script or an existing admin may change it.

## `coordination_sources`

- Purpose: provenance and idempotency for official/mirrored imports.
- Columns: `id`, `source_tier`, `publisher`, `url`, `published_at`, `retrieved_at`, `content_hash`, `notes`, `created_at`.
- Tier enum: `A`, `B`, `C`; unique `content_hash`; index publisher/date.

## Existing `faculties` and `faculty_aliases`

- Keep a faculty as the physical normalized entity; branch/system/stage variants belong in cutoff/vacancy rows.
- Add `requires_aptitude_test boolean NOT NULL DEFAULT false` if it is not already represented.
- Preserve `name_original` on aliases. Imports may insert aliases only after deterministic review; an ambiguous normalized alias fails the import.

## `coordination_cycles`

- Columns: `id`, `year`, `current_stage`, `registration_opens_at`, `registration_closes_at`, `active_model_version_id`, `created_at`, `updated_at`.
- Unique `year`; stage is an integer constrained to 1–3. The active model FK is nullable until a validated version is activated.

## `coordination_stage_rules`

- Columns: `id`, `cycle_id`, `year`, `stage`, `education_system`, `branch`, `minimum_score`, `maximum_score`, `minimum_percentage`, `student_count`, `source_id`, `created_at`.
- FK to cycle/source; unique `(year, stage, education_system, branch)`; index current lookup fields.

## `official_cutoffs`

- Columns: `id`, `year`, `stage`, `education_system`, `branch`, `faculty_id`, `official_name_ar`, `minimum_score`, `maximum_score`, `minimum_percentage`, `cutoff_rank_percentile`, `source_id`, `created_at`.
- Unique `(year, stage, education_system, branch, faculty_id)`; indexes by stage/branch and faculty/year.
- Rows are treated as immutable official facts after import.

## `stage_vacancies`

- Columns: `id`, `year`, `stage`, `education_system`, `branch`, `faculty_id`, `official_name_ar`, `is_available`, `requires_aptitude_test`, `source_id`, `created_at`.
- Unique `(year, stage, education_system, branch, faculty_id)`; index the active-stage availability lookup.
- Exact branch variants remain separate even when they reference the same faculty.

## `model_versions`

- Columns: `id`, `year`, `stage`, `version`, `mode`, `configuration_json`, `data_hash`, `calibration_metrics_json`, `backtest_metrics_json`, `created_by`, `created_at`, `activated_at`.
- Mode enum: `rank_percentile`, `normalized_percentage`.
- Unique `(year, stage, version)` and `data_hash`; immutable after creation. Activation updates only `coordination_cycles.active_model_version_id` in an audited transaction.

## `saved_students`

- Columns: `id`, `user_id`, `year`, `seat_number`, `student_name_snapshot`, `education_system`, `score_snapshot`, `max_score_snapshot`, `percentage_snapshot`, `branch`, `branch_source`, `result_status_snapshot`, `result_snapshot_json`, `created_at`.
- `branch_source`: `dataset`, `user_provided`, `official`. For 2026 it will normally be `user_provided` and must be labeled unverified.
- FK to user; unique `(user_id, year, seat_number)`. Do not create a global seat-number ownership constraint.
- A saved row is immutable. Re-saving returns the existing owned record when the snapshot identity matches; conflicting source data requires an explicit new reconciliation path rather than silent mutation.

## `prediction_runs`

- Columns: `id`, `user_id`, `saved_student_id`, `year`, `coordination_stage`, `model_version_id`, `model_mode`, `score`, `percentage`, `branch`, `governorate`, `input_hash`, `free_recommendation_count_snapshot`, `result_snapshot_json`, `created_at`.
- FK to user/student/model; index user/date, student/date, stage/model.
- Unique `(user_id, saved_student_id, model_version_id, input_hash)` prevents accidental duplicate recomputation while allowing a new model version to create a new immutable report.
- The full report remains server-side in Neon; authorization controls retrieval.

## `payment_settings`

- Singleton row with `id`, `full_report_price_egp numeric(10,2)`, recipient fields and enabled flags for Vodafone Cash, Orange Cash, and InstaPay, `vodafone_deep_link`, `payment_instructions`, `support_contact`, `free_recommendation_count`, `homepage_stage_message`, `updated_by`, `updated_at`.
- Seed: EGP 99; Vodafone `01001014231` and `http://vf.eg/vfcash?id=mt&qrId=hpSxBH`; Orange `01276101944`; InstaPay `01276101944`; all enabled; free count 1; current WhatsApp contact for support.
- The current coordination stage remains authoritative in `coordination_cycles`, avoiding two conflicting stage fields.

## `payment_submissions`

- Columns: `id`, `user_id`, `saved_student_id`, `prediction_id`, `method`, `expected_amount`, `currency`, `price_snapshot_json`, `sender_identifier`, `transaction_reference`, `receipt_blob_key`, `receipt_sha256`, `status`, `created_at`, `submitted_at`, `reviewed_at`, `reviewed_by`, `rejection_reason`, `client_idempotency_key`.
- Methods: `vodafone_cash`, `orange_cash`, `instapay`. Statuses: `pending`, `approved`, `rejected`, `cancelled`.
- FK ownership chain to user/student/prediction and reviewer; unique receipt hash and client idempotency key; indexes `(status, submitted_at)`, user/date, student/date.
- Create the row with the server price snapshot; `submitted_at` remains null until a valid private receipt is attached. Admin queues include only submitted rows.

## `credit_ledger`

- Columns: `id`, `user_id`, `saved_student_id`, `prediction_id`, `payment_id`, `event_type`, `units`, `idempotency_key`, `metadata_json`, `created_by`, `created_at`.
- Events: `grant`, `consume`, `refund`, `admin_adjustment`.
- Unique idempotency key and `(payment_id, event_type)` where applicable. Application code exposes inserts only; it never updates/deletes ledger rows.

## `prediction_entitlements`

- Columns: `id`, `user_id`, `saved_student_id`, `year`, `origin_prediction_id`, `payment_id`, `scope`, `unlocked_at`.
- Unique `(user_id, saved_student_id, year)` and unique payment ID.
- Scope is `year_all_stages`; approval in 2026 authorizes every Stage-2/Stage-3 model-version report for that saved student while preserving each report snapshot.

## `admin_audit_logs`

- Columns: `id`, `actor_user_id`, `action`, `target_type`, `target_id`, `before_json`, `after_json`, `request_id`, `created_at`.
- Actions include payment approval/rejection, price/recipient/stage/model changes, credit adjustment, and admin-role change. Index actor/date and target.

## General rate limiting

- Replace or extend `search_rate_limits` into a scope-aware table with hashed key, scope, window start, count, and expiry.
- Unique `(scope, key)`; never persist raw IP addresses. Cover auth attempts, result search, prediction preview, payment creation, and receipt upload.

# 4. Tansik Data Import Strategy

- Treat `TANSIK_2026_STAGE2_RESEARCH_CONTEXT.md` as the frozen 2026 Stage-2 source. Convert its reviewed facts into committed machine-readable seed files during implementation; never parse Markdown during a request.
- Import sources first with tier, URL, retrieval timestamp, and SHA-256 content hash. Source A wins conflicts, then B; C never overrides A/B.
- Normalize Arabic only for matching. Preserve the exact official label on every cutoff/vacancy record.
- Maintain an explicit reviewed alias map from official labels to `faculty_id`. The importer prints unmatched/ambiguous rows and exits non-zero; it never silently fuzzy-matches.
- Keep Science, Mathematics, Literary, new, and old systems explicit. Labels such as `حاسبات ... علوم` and `حاسبات ... رياضة` map to one faculty but separate branch records.
- Import 2026 Stage-1 cutoffs, Stage-2 thresholds, and the frozen public/government vacancy subset using natural-key upserts in a transaction.
- Import missing 2023–2025 historical cutoffs from the direct official Tansik URLs in the research context. This is targeted source retrieval, not exploratory research.
- Old-system faculty-level facts absent from verified inputs remain unknown. Do not activate a confident old-system report until direct official data is imported and mapped.
- Idempotency: source content hash prevents duplicate source versions; record natural keys prevent duplicate facts; a dry-run reports inserts/updates/conflicts before the actual seed command.

# 5. Prediction Engine Implementation

Define `FacultyStageStatus` as `officially_closed_stage_1`, `available_stage_2`, `availability_unknown`, or `not_eligible_current_stage`.

1. Load the active cycle, stage rules, model version, exact branch/system facts, and vacancies.
2. If the student is below the active Stage-2 minimum, return `not_eligible_current_stage` and no normal recommendations.
3. An exact Stage-2 vacancy makes that exact variant eligible for prediction. A Stage-1 cutoff without an exact vacancy becomes a deterministic closed fact. Missing trusted records become unknown and are not recommendations.
4. Enforce aptitude-test caveats and never infer official geographic eligibility from governorate.
5. Use rank percentile only when a verified same-year/system/branch distribution exists. The current 2026 Turso dataset does not qualify, so user-provided branch reports use normalized percentage with reduced confidence.
6. Historical baseline starts with weights 2025/2024/2023 = 0.50/0.30/0.20. Normalize incompatible score totals before comparison.
7. Compute 2026 calibration as a robust median residual grouped by branch and sector. Do not base a sector shift on one faculty.
8. Uncertainty is the maximum of a configured floor, `1.4826 * historical MAD`, and the selected backtest residual band, plus explicit data-quality penalties.
9. Classify safe/target/reach/unlikely using versioned uncertainty-relative margins. Use insufficient-data when the model cannot support a defensible estimate.
10. Store mode, confidence, range, explanation, fact/vacancy source, model configuration, and complete output in the immutable snapshot.

Backtests required before activation:

- Train on 2023–2024 and predict 2025.
- Predict known 2026 Stage-1 results using only pre-result inputs.
- Record MAE, median absolute error, interval coverage, error by branch/sector, sample size, and alias failures. Activation is blocked when required metrics or mappings are missing.

# 6. Result Search Integration

- Add a server-only Turso client using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- Exact seat lookup uses the verified `(year, seat_number)` index. Arabic name search uses `student_results_fts`, returns at most 20 ranked matches, and reports total count/has-more without returning unrelated rows.
- Map only the existing Turso columns. Do not claim school, governorate, or branch when null/unknown.
- Production must fail safely with a service-unavailable response if Turso is misconfigured; it must never fall back to demo, local SQLite, or Neon PII.
- Retain local SQLite behind an explicit development/test-only adapter. Remove demo rows from production code paths. Retire Neon `student_results` request usage without destructively dropping its legacy schema in this release.
- Keep `private, no-store`, `noindex`, validation, normalized input, hashed rate limiting, and generic error responses.

# 7. Authentication / Account Extension

- Enable Better Auth email/password alongside the existing Google provider. Email signup accepts name, email, normalized phone, and password and leaves the user logged in after success.
- Launch without SMS OTP or mandatory email verification. Use Better Auth password hashing/session behavior rather than custom credentials code.
- Add login/register UI while preserving Google login and regression behavior.
- Google users can save a Turso result with phone null; payment creation redirects to account completion until a valid phone is stored.
- Account routes: `/account`, `/account/results`, `/account/predictions`, `/account/payments`. Server layouts/actions require a Better Auth session.
- Role checks are server-side. No public admin signup exists.

# 8. Saved Student Implementation

- A save request contains year, seat number, and explicit branch selection. The server re-queries Turso and creates the Neon snapshot from Turso values; it never trusts client-supplied name/score/percentage.
- For 2026, store branch with `branch_source=user_provided` and show that it is not verified by the result dataset.
- Same user/year/seat returns the existing record idempotently. Different users may save the same seat number.
- Manual-score previews cannot be saved, purchased, or retained; the UI asks the student to find a Turso seat-number result first.
- Every get/update-related route checks `saved_students.user_id === session.user.id`. Snapshots are immutable.

# 9. Prediction History

- After authentication and saving, the server recomputes from the saved snapshot and active model; it does not trust the anonymous browser response.
- Store each stage/model result as an immutable `prediction_runs` record. Stage-2 reports remain labeled Stage 2 after Stage 3 begins.
- A newer model creates a new run. The account shows the original creation context and an update-available action; it never overwrites the older JSON.
- The all-2026 entitlement authorizes later runs for the same saved student/year, but does not merge or mutate their contents.

# 10. Free vs Premium Flow

Free output includes result facts, score, percentage, active-stage eligibility, official public facts, one personalized recommendation, and an integer locked count.

- `POST /api/predictions/preview` computes the full report on the server but serializes only `recommendations.slice(0, freeCount)` plus public states and locked count.
- It must not return premium faculty names, ranges, explanations, IDs that reveal ordering, or a hidden full array.
- Authenticated creation stores the full report in Neon. A normal report endpoint still returns the free projection unless entitlement passes.
- Premium retrieval requires Better Auth session, prediction ownership, saved-student ownership, matching relationship, and `(user, saved_student, year)` entitlement.
- Remove Instagram UI, `masarak_unlocked`, blurred secret content, and donation-support gating. CSS redaction may remain only as visual preview and must contain no real premium content.

# 11. Payment Implementation

1. User selects unlock from a saved 2026 Turso student report.
2. Server verifies session, ownership, completed phone, report relationship, and absence of an existing entitlement.
3. Server reads active settings, snapshots EGP 99 plus enabled recipients/instructions, and creates an idempotent payment row.
4. UI offers Vodafone Cash, Orange Cash, and InstaPay. Vodafone preserves the existing direct link; Orange/InstaPay provide copyable identifiers and instructions.
5. Upload endpoint checks `Content-Length`, authentication, ownership, pending state, MIME signature/type, and maximum 5 MB. Allow JPEG, PNG, and WebP only.
6. Read bytes server-side, calculate SHA-256, reject an existing hash generically, generate a random non-PII Blob key, and upload privately. If the DB update fails, delete the orphan Blob best-effort.
7. Set `submitted_at` and show pending UX. Poll status every 5–10 seconds while the page is open.
8. Admin receipt access goes through an admin-authenticated server route; never persist or return an anonymous public URL.
9. Reject records a reason and creates no entitlement. Resubmission creates a new payment record, preserving the rejected history.
10. Approval transaction conditionally changes pending to approved, creates ledger events, creates entitlement, and writes audit history.

# 12. Ledger / Entitlement Implementation

- Approval creates a `grant +1` and `consume -1` pair for the purchased annual student entitlement, followed by the unique entitlement row in the same transaction.
- Unique `(payment_id,event_type)`, ledger idempotency keys, unique payment entitlement, and unique `(user,saved_student,year)` make retries/double-clicks safe.
- Conditional update `WHERE status='pending'` ensures only one reviewer wins. A retry returns the existing approved outcome rather than inserting again.
- Refund/admin adjustment events append compensating rows; historical rows are never edited.
- UI exposes only “فتح التقرير الكامل” and entitlement status, not credit mechanics.

# 13. Admin Implementation

- Replace the password page and cookie endpoints with Better Auth session plus `user.role=admin` checks in the admin layout and every admin API.
- Provide `/admin`, `/admin/payments`, `/admin/settings`, `/admin/coordination`, and `/admin/model`.
- Payment review shows user, saved student, seat number, expected amount, method, sender/reference, private receipt, submission time, and status. Approve/reject actions require confirmation and display idempotent results.
- Settings edit price, recipients, method flags, instructions, support contact, free count, and homepage message. Coordination/model screens update active stage/model separately and atomically.
- Owner promotion uses `pnpm admin:promote-owner` as a dry run and `pnpm admin:promote-owner -- --apply` after it resolves the single existing Google account. If Neon contains multiple Google accounts, append `--email=<exact-existing-email>`. It inserts an audit event and is run by the owner/AntiGravity—not by a public route or migration.
- Audit events are readable by admins. Role changes require an existing admin or the owner script.

# 14. Security Model

- Centralize `requireSession`, `requireAdmin`, `requireOwnedStudent`, `requireOwnedPrediction`, and `requireEntitlement` helpers.
- Validate every payload with Zod and reject unknown fields. Treat IDs, amounts, method, status, snapshot data, and Blob keys as server-controlled.
- Use Better Auth secure/httpOnly/same-site cookies. Mutating custom routes require same-origin `Origin`/`Host` validation in addition to session cookies; rely on Better Auth protections for its own routes.
- Apply hashed, scoped rate limits to auth, search, preview, payment creation, and receipt upload. Never store raw IPs.
- Store no secrets or private Blob tokens in client bundles. Add security headers and `no-store` on personal/payment/admin responses.
- Analytics records coarse event types only—no seat number, name, phone, receipt data, prediction payload, or raw IP.
- Free endpoints never serialize premium data. Ownership is checked before existence-sensitive responses to reduce cross-user enumeration.
- Remove legacy admin password/cookie logic and Instagram/localStorage authorization completely.

# 15. UI/UX Changes

- Update homepage and metadata to “توقعات تنسيق المرحلة الثانية 2026” and “محدثة بعد ظهور نتيجة المرحلة الأولى رسميًا”, driven by settings/cycle data.
- Preserve Cairo, RTL, teal/navy/gold tokens, 48px controls, existing responsive structure, and calm factual tone. Do not redesign unrelated content.
- Result flow adds branch confirmation with an explicit “مقدم من الطالب” label before saving/prediction.
- Prediction distinguishes official facts, available predictions, unknown availability, below-minimum state, confidence, uncertainty, and aptitude caveats without relying on color alone.
- Show one useful recommendation and a truthful `+N` locked summary. Unlock action leads through auth/save/payment progressively.
- Add email signup/login, four account pages, payment method selection, private upload progress, pending polling, rejection recovery, and persistent premium reports.
- Admin screens use conventional tables/forms and the existing component vocabulary; mobile receipt review must remain usable.

# 16. File-Level Implementation Map

- **Coordination/prediction:** replace `lib/prediction.ts`; add server-only coordination repositories/model modules, reviewed seed data, import/backtest scripts, and focused Vitest tests.
- **Result search:** refactor `app/api/result-search/route.ts`; add a Turso client/adapter; retain `lib/local-results.ts` only for development/test.
- **Auth/account:** extend `lib/auth.ts`, `lib/auth-client.ts`, `db/schema.ts`, and auth UI; add account layouts/pages and protected account APIs/actions.
- **Payments/storage:** add settings/payment/ledger services, private Blob adapter, upload/status routes, and payment UI.
- **Admin:** replace legacy admin login/stat authorization; add role-protected payment/settings/coordination/model/audit routes and pages.
- **API authorization:** add shared session, RBAC, ownership, entitlement, origin, validation, and rate-limit helpers.
- **UI:** refactor `components/tool-experience.tsx`, header/account navigation, metadata/messaging, and relevant styles while preserving design tokens.
- **Migrations/scripts:** additive Drizzle migration(s), coordination importer/dry-run, backtest/model creation, settings seed, and owner-promotion script.
- **Documentation:** create `docs/TANSIK_PHASE_PLAYBOOK.md` during implementation and update auth/release documentation only where behavior changes. Do not add Playwright/E2E implementation work.

# 17. Migration and Data Sequence

1. Update Drizzle schema and generate additive SQL without running it.
2. Manually review SQL for destructive statements, Better Auth duplication, FK order, partial/unique indexes, money types, and defaults.
3. AntiGravity/owner backs up or confirms recoverability, then applies the reviewed migration to staged Neon.
4. Dry-run coordination import; resolve every unmatched alias; import sources, catalog aliases, historical cutoffs, 2026 facts, rules, and vacancies.
5. Run backtests and create an inactive Stage-2 model version.
6. Seed EGP 99 and the three payment methods/settings.
7. Activate the model and Stage 2 in an audited transaction only after metrics/data checks pass.
8. Run the owner-promotion script with the owner-supplied email.
9. Verify counts, constraints, settings, and role before browser testing. No migration or seed action is performed during this planning task.

# 18. Implementation Phases

1. **Foundations:** dependencies, server clients, validation/auth helpers. Output: testable infrastructure boundaries.
2. **Additive schema:** schema, migration, settings/owner scripts. Depends on foundations; output: reviewed unapplied SQL.
3. **Coordination data:** normalized seeds/importer/aliases/history. Output: idempotent Stage-2 data load and reconciliation report.
4. **Model:** deterministic status engine, calibration, uncertainty, backtests, versions. Output: inactive validated model.
5. **Turso search:** production Turso route and isolated local adapter. Output: no production PII fallback.
6. **Accounts/history:** email auth, saved Turso snapshots, account pages, immutable runs. Output: owned report history.
7. **Paywall/payments:** free projection, premium authorization, settings, three payment methods, private receipts, ledger/annual entitlement. Output: idempotent unlock flow.
8. **Admin/UI:** RBAC replacement, review/settings/model screens, Stage-2 messaging, RTL responsive states. Output: complete staged UX.
9. **Hardening/handoff:** unit/integration checks, build/lint/typecheck, security review, phase playbook, AntiGravity handoff. Output: main-branch candidate for staged deployment.

# 19. Configuration Requirements

AntiGravity must verify, without exposing values:

- `DATABASE_URL`: existing Neon production/preview connection with the new schema applied.
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: existing verified Better Auth/Google configuration.
- `NEXT_PUBLIC_BETTER_AUTH_URL` only if the existing deployment requires it; it must contain a public base URL, never a secret.
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`: existing `masarak-results-2026` read access.
- `BLOB_READ_WRITE_TOKEN`: existing private `masarak-payment-receipts` store access.
- `RATE_LIMIT_SECRET`: strong server-only key for hashing rate-limit identifiers.
- Active coordination cycle, Stage-2 rules, active model version, EGP 99 setting, enabled recipients, support contact, and owner admin role in Neon.
- Vercel Preview/Staged environment parity for auth callback and private services. No provider purchase, migration, or production promotion is part of implementation.

# 20. Deployment Handoff

Follow `docs/VERCEL_RELEASE_WORKFLOW.md`:

1. After authorized implementation and lightweight checks, Codex pushes the implementation commit to `main`.
2. Vercel builds a **Staged Production** deployment while `masarak.live` remains on the previous Current deployment.
3. Codex does not run browser automation, final runtime verification, production promotion, or infrastructure changes.
4. AntiGravity verifies the staged URL using `docs/END_TO_END_TESTING.md`, records defects, and confirms the commit SHA.
5. Any P0/P1 blocks release. AntiGravity returns the verification report to the owner.
6. Only the owner may explicitly authorize and manually perform production promotion. Codex and AntiGravity never promote automatically.
