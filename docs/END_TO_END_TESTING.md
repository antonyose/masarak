# AntiGravity End-to-End Verification Handoff

# 1. Purpose

Codex is responsible for implementing the planned system and running lightweight structural checks. AntiGravity owns staged runtime/browser verification, responsive inspection, environment verification, payment/admin flow verification, Vercel log review, defect reporting, and the production release recommendation.

This handoff must be executed only after implementation is pushed to `main` and Vercel has produced a Staged Production deployment. It does not authorize AntiGravity or Codex to promote that deployment.

# 2. Preconditions

Confirm the following before testing:

- Staged deployment commit SHA matches the implementation commit on `main`.
- `DATABASE_URL` connects to the intended Neon database and all reviewed additive migrations are applied.
- Apply the reviewed migration sequence from the repository root with `corepack pnpm@10.15.0 exec drizzle-kit migrate`, then load coordination/model/settings data with `corepack pnpm@10.15.0 seed:stage2`. Confirm the target connection before either command.
- Resolve the existing Google owner with `corepack pnpm@10.15.0 admin:promote-owner`; only after confirming the displayed account, run `corepack pnpm@10.15.0 admin:promote-owner -- --apply`. If more than one Google account exists, use `--email=<exact-existing-email>`.
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are present in the staged environment. Google production credentials remain unchanged.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` connect read-only application code to `masarak-results-2026`.
- `BLOB_READ_WRITE_TOKEN` points to the private `masarak-payment-receipts` store.
- `RATE_LIMIT_SECRET` is present and server-only.
- Better Auth tables remain intact; email/password is enabled; an owner account exists with an audited `admin` role.
- Coordination sources, aliases, Stage-1 official cutoffs, Stage-2 rules/vacancies, and an active Stage-2 model are present.
- Payment settings show EGP 99, free recommendation count 1, current support contact, and:
  - Vodafone Cash enabled: `01001014231` with `http://vf.eg/vfcash?id=mt&qrId=hpSxBH`.
  - Orange Cash enabled: `01276101944`.
  - InstaPay enabled: `01276101944`.
- Use at least two normal test users and one admin. Do not use real student data in screenshots or defect reports unless redacted.

# 3. Staged Deployment Verification

1. Open Vercel Dashboard → `masarak-app` → Deployments.
2. Locate the latest `main` deployment marked Production (Staged).
3. Record its commit SHA, deployment ID, creation time, and unique staged URL.
4. Compare the recorded SHA with the expected implementation commit.
5. Open the unique staged URL for every scenario in this document.
6. Separately open `https://masarak.live` and confirm it still resolves to the previous Current deployment, not the staged candidate.
7. Do not select Promote to Production at any point during testing.

Follow `docs/VERCEL_RELEASE_WORKFLOW.md`. Stop and report a release-process P1 if the live domain moved before owner approval.

# 4. Migration Verification

Inspect Neon with read-only SQL. Adjust table/schema quoting only if the implementation uses the documented equivalent name.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'coordination_sources', 'coordination_cycles',
    'coordination_stage_rules', 'official_cutoffs', 'stage_vacancies',
    'model_versions', 'saved_students', 'prediction_runs',
    'payment_settings', 'payment_submissions', 'credit_ledger',
    'prediction_entitlements', 'admin_audit_logs'
  )
order by table_name;
```

Verify:

- Existing Better Auth tables and data were not recreated or lost.
- `user.phone` is nullable and `user.role` defaults to `user`.
- No migration copied the 919,396 student records into Neon.
- Unique saved-student key is `(user_id, year, seat_number)`, not `(year, seat_number)`.
- Vacancy/cutoff natural keys include year, stage, system, branch, and faculty.
- Receipt hash and payment idempotency keys are unique.
- Pending payment queue has a status/submitted-time index.
- Ledger idempotency constraints and annual entitlement uniqueness exist.

Example constraint checks:

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'saved_students', 'prediction_runs', 'payment_submissions',
    'credit_ledger', 'prediction_entitlements'
  )
order by tablename, indexname;
```

Fail if migration history contains destructive drops/truncation of production application/auth data.

# 5. Coordination Data Verification

Verify in Neon/admin UI:

- The active cycle is year 2026, current stage 2.
- Registration dates and homepage Stage-2 message match the frozen context.
- New-system Stage-2 minimums are 220/320 for scientific branches and 205/320 for Literary.
- Old-system Stage-2 minimums are 280/410 for scientific branches and 240/410 for Literary.
- Stage-1 new-system official cutoff counts match the reviewed seed input: 98 scientific-group and 131 Literary records, unless the implementation documents a larger directly verified import.
- Stage-2 public/government vacancy sets are present with exact branch variants.
- Source URL, tier, content hash, and exact Arabic official label are retained.
- Unmatched aliases are zero for the activated model dataset.
- One Stage-2 model version is active and contains configuration, calibration, and backtest metrics.
- Old-system records without verified faculty-level data are marked unknown/insufficient, never inferred as facts.

# 6. Result Search Tests

Exercise these through the staged browser and inspect the network response:

- **Exact seat number:** returns exactly the matching 2026 result with score, percentage, national rank, and no fabricated branch/school/governorate.
- **Invalid seat number:** short, non-numeric, and overlong input is rejected before query with clear Arabic copy.
- **Exact Arabic name:** returns the exact-name rows first.
- **Partial Arabic name:** a four-or-more-character fragment returns relevant matches, capped at 20 with total/has-more guidance.
- **Multi-word Arabic name:** narrows results correctly after normalization of Arabic letters, spaces, and Arabic/Latin digits.
- **Multiple matches:** results remain distinguishable without leaking details outside the returned matches.
- **No result:** shows a calm recovery state, not demo data.

Confirm responses are `private, no-store`, `noindex`, and report production/live Turso mode. Temporarily invalid Turso configuration should produce a safe service error; production must not fall back to Neon, local SQLite, or synthetic results.

# 7. Stage-2 Prediction Tests

Use representative inputs and record the model version/mode for each:

- **Closed Stage-1 fact:** Science/new-system 2026 with طب القاهرة. Expected: “غير متاحة في المرحلة الثانية” and official Stage-1 cutoff 308/320; never “فرصة ضعيفة”.
- **Closed branch variant:** حاسبات ومعلومات سوهاج علوم. Expected: closed at 292.5 because that Science variant is absent from Stage 2.
- **Available Science variant:** choose a listed Science CS/AI vacancy such as حاسبات ومعلومات أسيوط علوم. Expected: available, predicted range, uncertainty, and non-official disclaimer.
- **Available Math variant:** choose its exact `رياضة` variant. Expected: Math-specific record; no cross-use of the Science variant.
- **Engineering fact:** هندسة السويس retains the unusual official 282.2 value without rounding.
- **Dentistry fact:** طب أسنان بني سويف retains 298.7 without rounding.
- **Literary:** exercise a listed Literary Stage-2 vacancy and a Stage-1-closed Literary faculty.
- **Below new scientific minimum:** 219.5/320. Expected: outside Stage 2; no normal recommendations; Stage-3 update message.
- **At new scientific boundary:** 220/320. Expected: inside the registration cohort but no claim that every vacancy is available to that score.
- **Below/at new Literary boundary:** 204.5 and 205/320.
- **Old-system boundaries:** 279.5/280 scientific and 239.5/240 Literary out of 410. Missing faculty facts remain unknown.
- **Unknown availability:** no trusted cutoff/vacancy match. Expected explicit insufficient-data state and exclusion from recommendations.
- **Aptitude faculty:** vacancy does not imply eligibility unless aptitude requirements are satisfied/acknowledged.
- **Governorate:** changes convenience order only and does not claim official geographic eligibility.
- **Confidence:** data-quality penalties visibly reduce confidence; no fake probability percentage appears.

Because Turso branch is unknown, a saved 2026 result with user-selected branch must use `normalized_percentage` and label the branch source as user-provided. Fail if it displays a fabricated branch rank percentile.

# 8. Google Authentication Regression Test

- Start logged out and select Google login.
- Confirm the existing Google consent/callback flow returns to the staged app without callback errors.
- Verify a Better Auth user/session exists and session persists after refresh and direct navigation.
- Verify existing account linking behavior is unchanged for the same email.
- Log out and confirm protected routes become inaccessible.

This is regression verification only. Do not reconfigure Google Cloud or create new credentials.

# 9. Email/Password Authentication

- Register with valid name, unique email, Egyptian phone, and acceptable password.
- Verify all four fields are required and normalized phone is stored.
- Confirm successful signup automatically starts a session.
- Log out, log back in, and verify session persistence.
- Test wrong password, duplicate email, malformed email, invalid phone, weak password, and rate limiting.
- Ensure error messages do not reveal whether unrelated accounts exist beyond safe duplicate-registration handling.
- Verify email verification and SMS OTP are not mandatory at launch.

# 10. Account Area

Verify authenticated access and coherent empty/loading/error states for:

- `/account`
- `/account/results`
- `/account/predictions`
- `/account/payments`

Logged-out requests should return to login without briefly rendering private data. Google users without a phone may view/save results but must be prompted to complete the phone field before payment creation.

# 11. Saved Student Tests

- Search by exact Turso seat number, select an explicit branch, and save.
- Query Neon to confirm immutable name/score/max/percentage/system snapshots match Turso.
- Confirm `branch_source=user_provided` and the UI does not call it dataset-verified.
- Save the same seat again as the same user. Expected: existing record returned; no duplicate.
- Save the same year/seat as another user. Expected: succeeds for the other account.
- Attempt to access User B’s saved-student ID while signed in as User A. Expected: 404/403 with no snapshot leakage.
- Create a manual-score preview and attempt save/payment. Expected: blocked until a real Turso seat result is selected.

# 12. Prediction History

- Create an authenticated prediction from a saved result.
- Confirm year, Stage 2, model version, mode, branch/source, and creation time are stored and shown.
- Refresh and sign out/in; the report remains in history.
- Activate/use a later test model version and create another report. Expected: new row, original JSON unchanged.
- Confirm the old report says it was created using Stage-2 data and optionally indicates a newer update.
- Directly compare original snapshot hash/content before and after later model activity; it must be immutable.

# 13. Free/Premium Tests

Test both browser presentation and raw network payloads:

- Anonymous/free response shows the configured first recommendation and accurate locked count.
- Official public facts and eligibility remain free.
- Search the JSON response for names/ranges/explanations from locked recommendations. They must be absent, not blurred or encoded.
- Add/edit `masarak_unlocked` and similar localStorage keys. Nothing should unlock.
- Manipulate DOM/CSS, replay requests, and call the premium endpoint without a session. Expected: no full report.
- Use an authenticated owner without entitlement. Expected: free projection only and premium endpoint denied.
- Try another user’s prediction ID. Expected: denied without revealing premium data.
- Change `free_recommendation_count` in admin test settings and confirm the server payload—not just CSS—reflects the configured count. Restore it to 1.

# 14. Payment Settings

As admin verify:

- Full report price is EGP 99 and displayed from the server setting.
- Vodafone number/link, Orange number, InstaPay identifier, method flags, instructions, support contact, free count, and homepage message are editable.
- Disable each payment method individually and confirm it disappears from new checkout options without affecting existing price snapshots.
- Change price in a controlled staged test, create a payment, and confirm the server snapshots that price. Restore EGP 99.
- Every price, recipient, enabled flag, stage-message, or support change creates an audit entry with actor/time and before/after values.

# 15. Payment Submission

Use a safe test workflow. Do not transfer real money unless the owner explicitly requests it.

For Vodafone Cash, Orange Cash, and InstaPay:

1. Start from an owned saved-student prediction without entitlement.
2. Confirm checkout shows EGP 99 from the server and the correct selected recipient.
3. For Vodafone, verify the preserved direct link opens in a separate safe context.
4. Enter sender/reference fields and upload a clearly marked synthetic receipt image.
5. Confirm the payment row’s expected amount/settings snapshot cannot be changed through client request editing.
6. Confirm receipt metadata is private, status becomes pending, and submitted time is populated.
7. Refresh `/account/payments`; pending state persists.

Replay payment creation with the same idempotency key. Expected: no duplicate submission.

# 16. Receipt Security

- Upload valid JPEG, PNG, and WebP images under 5 MB.
- Attempt PDF, SVG, executable/renamed binary, mismatched MIME signature, empty file, and image over 5 MB. Expected: rejected before persistent association.
- Inspect the Blob object name. It must be random and contain no name, email, phone, seat number, or original filename.
- Try the stored Blob key/URL anonymously and as a normal user. Expected: receipt bytes are not publicly accessible.
- Verify the owning user sees status but not a reusable public receipt URL.
- Verify an authenticated admin can view through the protected receipt endpoint.
- Re-upload the identical bytes in another payment/account. Expected: duplicate hash rejected with a generic message and no cross-user details.
- Confirm failed DB association does not leave a visible orphan; inspect Blob logs/store if a failure is simulated.

# 17. Admin Access

- Logged-out visitor: all `/admin` pages and APIs denied.
- Normal Better Auth user: denied even with legacy `masarak_admin_token` cookie manually inserted.
- Confirm the legacy password login endpoint is removed or nonfunctional and no fallback password works.
- Database `admin` user: can access dashboard, payments, settings, coordination, model, and audit views.
- Pending submitted payments show user, student, seat number, expected amount, method, sender/reference, receipt, and submission time.
- Verify the owner-promotion action was performed through the audited script and the admin-role change appears in audit history.

# 18. Payment Approval

Select one pending synthetic payment and record pre-approval counts.

```sql
select status from payment_submissions where id = '<payment-id>';
select event_type, units from credit_ledger where payment_id = '<payment-id>';
select * from prediction_entitlements where payment_id = '<payment-id>';
select action from admin_audit_logs where target_id = '<payment-id>';
```

Approve once. Expected:

- Payment transitions pending → approved with reviewer/time.
- Exactly one grant and one consume ledger event are created.
- Exactly one `(user, saved_student, 2026)` all-stages entitlement is created.
- Exactly one approval audit event is created.

Double-click, retry the request, refresh/reapprove, and send concurrent approval requests if tooling permits. Expected: approved response remains stable and no duplicate status transition, ledger event, entitlement, or audit approval appears.

# 19. Payment Rejection

- Reject a separate pending synthetic payment with a reason.
- Confirm rejected status, reviewer/time, visible user-facing reason/state, and audit event.
- Confirm no grant, consume, or entitlement is created.
- Retry rejection and attempt approval using stale UI; expected idempotent rejection/conflict handling with no entitlement.
- Start a new submission from the rejected report. Expected: new row and preserved rejection history.

# 20. Unlock Flow

- Keep the pending payment page open and approve from the admin session.
- Confirm 5–10-second polling detects approval without realtime infrastructure.
- Expected Arabic success state: “تم تأكيد الدفع 🎉” and “التقرير الكامل متاح الآن”.
- Confirm the report refetches and full analysis appears automatically.
- Refresh, log out/in, and open from `/account/predictions`; full report remains authorized.
- Create a test Stage-3 prediction for the same saved student/year with a new model version. The existing 2026 entitlement must unlock it automatically while the Stage-2 snapshot remains unchanged.
- A different saved student on the same account must not inherit the entitlement.

# 21. Cross-User Security

Using User A and User B, attempt:

- A reading B’s saved student.
- A reading B’s prediction/free-owned detail or premium report.
- A using B’s annual entitlement for A’s student.
- A reading/cancelling B’s payment.
- A accessing B’s receipt.
- A calling admin list/review/settings/model endpoints.
- A changing IDs in URL, JSON body, query string, and polling requests.

All must fail server-side without returning B’s PII, payment evidence, or premium data. Repeat with a valid A entitlement to prove authorization remains scoped to A’s exact saved student/year.

# 22. Responsive UX

Inspect at minimum 360×800 mobile, 390×844 mobile, 768px tablet, 1024px desktop, and 1440px desktop:

- Homepage Stage-2 messaging and tool switcher.
- Seat/name result search and multi-match list.
- Predictor, branch-source notice, hard facts, locked count, and below-minimum state.
- Google/login/signup/account completion.
- All four account routes and empty/history states.
- Payment methods, copy/deep-link actions, receipt upload, pending/rejected/approved states.
- Premium report and Stage-2 snapshot label.
- Admin payment table/detail, receipt viewer, approval confirmation, and settings forms.

Confirm Arabic RTL, readable isolated numbers, no clipped dropdowns, keyboard focus, 48px primary targets, status text/icons not color-only, and reduced-motion behavior. Preserve the current calm Cairo/teal/navy visual language.

# 23. Browser Console and Network

After every major flow inspect console and network for:

- JavaScript, hydration, CSP, cookie, or accessibility errors.
- Unexpected 401/403/404/429/500 responses.
- Repeated polling after leaving the page.
- Secrets (`DATABASE_URL`, Turso/Blob tokens, Better Auth secret) in scripts or responses.
- Seat number/name/phone in analytics calls.
- Premium arrays/details in free responses.
- Public receipt URLs, Blob tokens, or raw Blob credentials.
- Client-controlled expected amount, role, payment status, model version, or entitlement.

Record request/response bodies only after redacting PII and secrets.

# 24. Vercel Runtime Logs

After exercising the staged deployment, inspect logs for:

- `/api/result-search`: Turso latency/errors, rate-limit failures, unexpected fallback messages.
- Prediction preview/create/report routes: model/data load failures, premium authorization denials, serialization leakage.
- `/api/auth/[...all]`: signup/login/callback/session errors without password/token logging.
- Saved-student/account routes: Turso snapshot and ownership errors.
- Payment create/upload/status routes: price snapshot, MIME/size/hash, Blob, orphan-cleanup, and polling failures.
- Admin payment/receipt/approve/reject routes: RBAC, conditional transition, transaction, and idempotency errors.
- Settings/coordination/model routes: validation and audit failures.

No log should contain passwords, auth tokens, receipt bytes, full Blob URLs, Turso tokens, or unredacted PII.

# 25. Configuration Tasks

| Service | Setting | Expected state/value | Already exists? | Owner interaction |
|---|---|---|---|---|
| Vercel | `DATABASE_URL` | Neon connection with reviewed additive schema | Yes; schema update required | Migration authorization required |
| Vercel | Better Auth/Google variables | Existing verified production values | Yes | No reconfiguration |
| Vercel | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | `masarak-results-2026` access | Yes | Verify only |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | Private `masarak-payment-receipts` store | Yes | Verify only |
| Vercel | `RATE_LIMIT_SECRET` | Strong server-only value | May be new | Owner/AntiGravity sets if absent |
| Neon | Coordination seeds | Stage-1 facts, Stage-2 rules/vacancies, sources/aliases | New | Apply after dry-run review |
| Neon | Active model | Validated Stage-2 version | New | Admin activation after metrics review |
| Neon | Payment settings | EGP 99; three enabled methods; supplied recipients; free count 1 | New | Verify values |
| Neon | Owner role | Existing owner email promoted to `admin` | New | Owner must provide exact email/run approval |
| Vercel | Staged release gate | Main builds staged; custom domain unchanged | Existing | Owner alone promotes later |

Do not purchase services, change providers, recreate OAuth, move result data, or promote production while performing these tasks.

# 26. PASS/FAIL Checklist

- [ ] Staged SHA/URL verified; live domain unchanged.
- [ ] Additive migration and constraints verified; Better Auth data intact.
- [ ] Coordination facts/vacancies/rules/model verified.
- [ ] Turso seat/name search passes without production fallback.
- [ ] Stage-1 facts override predictions; Stage-2 boundaries/branches pass.
- [ ] Unknown branch uses normalized percentage with reduced confidence.
- [ ] Google regression and email/password flows pass.
- [ ] Account ownership and immutable history pass.
- [ ] Free payload contains no premium recommendation data.
- [ ] Vodafone, Orange, and InstaPay submissions pass at server-snapshotted EGP 99.
- [ ] Private receipt validation/access/duplicate behavior passes.
- [ ] Normal users cannot access admin routes.
- [ ] Approval/retry creates one ledger pair, entitlement, and audit event.
- [ ] Rejection creates no entitlement.
- [ ] Polling unlock and persistent account access pass.
- [ ] All-2026 entitlement unlocks later Stage-3 report for the same student only.
- [ ] Cross-user attempts return no unauthorized data.
- [ ] Mobile/desktop RTL and accessibility inspection passes.
- [ ] Console/network/log review finds no secrets, PII analytics, premium leakage, or unexplained failures.
- [ ] No open P0 or P1 defects.
- [ ] Owner received the completed report; no promotion performed.

# 27. Defect Reporting Format

Report each issue separately:

```text
Feature:
Severity: P0 | P1 | P2 | P3
Staged URL:
Commit SHA:
Account/role:
Preconditions:
Exact reproduction steps:
Expected behavior:
Actual behavior:
Screenshot/video:
Console error:
Network request/response (redacted):
Relevant Vercel log (redacted):
Data impact/security exposure:
```

Severity definitions:

- **P0:** security breach, premium/PII/receipt leak, data loss/corruption, unauthorized production promotion, or complete critical-system outage.
- **P1:** major core-flow failure such as search, prediction, auth, payment approval, entitlement, or admin review being unusable.
- **P2:** important defect with a safe workaround and no security/data-integrity impact.
- **P3:** cosmetic, copy, spacing, or minor usability issue.

# 28. Production Promotion Gate

**DO NOT PROMOTE if any P0 or P1 issue remains.** Also do not promote when migration/data/model/configuration verification is incomplete, premium data leaks into a free response, receipts are public, or approval is not idempotent.

When all critical checks pass, AntiGravity sends the completed checklist, defect disposition, staged URL, and commit SHA to the owner. Only the owner may explicitly authorize and manually perform promotion through Vercel. AntiGravity and Codex must never automatically promote a staged deployment.
