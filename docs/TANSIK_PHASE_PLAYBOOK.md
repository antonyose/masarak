# Masarak Tansik Phase Playbook

This is the operational playbook for adding a later coordination stage or a replacement model without changing historical reports or widening an entitlement. It is intentionally scoped to reviewed official sources already selected by the owner; it is not an exploratory research procedure.

## Non-negotiable rules

- Treat every official cutoff, vacancy, stage threshold, and source label as an exact fact with provenance.
- Reject an ambiguous normalized faculty alias. Never fuzzy-import it.
- A model version is immutable. Changed configuration or data requires a new version string and data hash.
- Activation gates apply only to the system/branch/stage scope served by that model. Missing old-system evidence never blocks a complete new-system release.
- A prediction run is an immutable snapshot. Never update an earlier Stage‑2 row when Stage‑3 data arrives.
- The public entitlement is `(year, seat_number)` with scope `year_all_stages`; an approved 2026 payment must unlock current and later 2026 reports without another payment or login. Legacy `(user_id, saved_student_id, year)` rows remain for account compatibility only.
- Products are server-configured: one report is 35 جنيه and the enabled friends offer is 69 جنيه for three distinct real 2026 seat numbers. Friends branches are selected later when each seat is searched.
- A friends approval locks and checks every linked seat in one Neon transaction, then creates three seat entitlements or none; duplicate/paid seats cancel the pending payment without partial unlock.
- Codex may prepare and push a staged build. Only the owner/AntiGravity may apply production data changes and promote the deployment.

## 1. Freeze and review the phase input

1. Save the owner-approved official URLs and frozen source material.
2. Record publisher, tier, publication/retrieval dates, and SHA‑256 content hash.
3. Transcribe the exact Arabic labels into reviewed machine-readable seed data.
4. Map labels through `faculty_aliases`. Stop the import on zero or multiple physical-faculty matches.
5. Record missing old-system or branch-specific facts as unknown; do not infer them from another system.

## 2. Add the phase data additively

Prepare an idempotent script that uses natural-key upserts for:

- `coordination_sources` by content hash;
- `coordination_stage_rules` by year/stage/system/branch;
- `official_cutoffs` by year/stage/system/branch/faculty;
- `stage_vacancies` by year/stage/system/branch/faculty.

The script must run in one database transaction and print inserted/resolved row counts. It must not change Better Auth tables or copy Turso student results into Neon.

## 3. Create a new model version

Use a version such as `stage3-2026-v1`; never reuse `stage2-2026-v1`. Store:

- frozen configuration and classification boundaries;
- combined coordination-data hash;
- calibration metrics;
- holdout/backtest metrics with explicit `activationScope`;
- `activationReady` for that scope and `oldSystemGateApplied: false` when old-system evidence is outside it.

If the same version already exists with a different data hash, fail rather than overwrite it.

## 4. Run the scoped activation gate

Run focused deterministic tests and the phase backtest. At minimum verify:

- hard official facts override estimates;
- vacancies match the exact branch and system;
- stage eligibility uses the active threshold;
- incomplete old-system paths return unknown/insufficient data;
- uncertainty and confidence degrade when evidence is sparse;
- the report is deterministic for the same model and input.

Do not combine unrelated incomplete data into the activation decision. Record each system/branch result separately.

## 5. Activate without rewriting history

After owner review, an admin activates the validated model through the audited model activation endpoint. The transaction updates `coordination_cycles.active_model_version_id`, timestamps the model, and creates an `admin_audit_logs` entry.

Creating a Stage‑3 report must insert a new `prediction_runs` row with the new stage, model ID, input hash, and full result snapshot. It must leave every Stage‑2 row unchanged.

## 6. Verify entitlement continuity

For any anonymous search with an existing approved 2026 seat entitlement:

1. Create the later-stage prediction for the same seat number, using the stored paid branch context.
2. Confirm no new payment or ledger grant is created.
3. Confirm anonymous premium retrieval succeeds through the `(2026, seat_number)` entitlement.
4. Confirm a different seat remains locked regardless of browser, device, or login state.
5. Confirm the original Stage‑2 premium report still returns its original snapshot.

For an approved friends payment, repeat the same checks for all three seats. If a secondary friend seat has no stored branch context, require that friend to choose a branch on first search, create a new immutable prediction snapshot, and keep the same entitlement authoritative.

## 7. Staged handoff

Run TypeScript, lint, focused unit tests, and the production build. Push the reviewed commit to `main` under the staged-production workflow, but do not promote it. Hand AntiGravity the commit SHA, staged URL, migration/seed commands (if any), expected row counts, active model/version/scope, and the tests in `docs/END_TO_END_TESTING.md`.

## Incident and rollback guidance

- If a data import is wrong before activation, correct the reviewed seed and use a new content hash.
- If an activated model is wrong, activate the last known-good immutable model; do not edit report snapshots.
- If a payment was reviewed incorrectly, use an append-only refund/admin-adjustment workflow and audit it; do not delete ledger or entitlement history manually.
- If a staged build fails, leave `masarak.live` on its current deployment and fix forward in a new commit.
