# Vercel Staged Production Release Workflow

This document defines the release gate and deployment workflow for the **Masarak** application (`masarak-app`).

---

## 1. Overview & Release Gate Policy

| Parameter | Value / Status |
| :--- | :--- |
| **Vercel Project** | `masarak-app` |
| **Production Domain** | `https://masarak.live` (`https://www.masarak.me`) |
| **Production Branch** | `main` |
| **Auto-assign Production Domains** | **DISABLED** |
| **Staged Production Workflow** | **ACTIVE** |

> [!IMPORTANT]
> **NO AUTOMATED PRODUCTION PROMOTION BY AI AGENTS**
> 
> Pushing commits to the `main` branch creates a **Staged Production Deployment**.
> The live domain `https://masarak.live` **WILL NOT** automatically switch to the new deployment.
> Production promotions require explicit **HUMAN APPROVAL**.

---

## 2. Handoff & Release Lifecycle

```
Codex / Developer pushes commit to `main`
             │
             ▼
Vercel triggers Production Build (staged)
             │
             ▼
Staged Production URL generated (`https://masarak-<id>-antonyoses-projects.vercel.app`)
             │
             ▼
`masarak.live` remains on CURRENT active production deployment
             │
             ▼
AntiGravity / QA tests the Staged Deployment URL
             │
             ▼
Human approves release & clicks "Promote to Production" in Vercel
             │
             ▼
`masarak.live` switches traffic to the new deployment
```

---

## 3. How to Locate & Test Staged Deployments

1. **Locate Deployment URL**:
   - Go to [Vercel Dashboard -> masarak-app -> Deployments](https://vercel.com/antonyoses-projects/masarak-app/deployments).
   - The latest commit to `main` will show as **Production (Staged)**.
   - Click on the deployment to view its unique URL (e.g. `https://masarak-xxxxxx-antonyoses-projects.vercel.app`).

2. **Test Staged Deployment**:
   - Verify static pages, search (`/result-search`), prediction (`/predict`), and Google OAuth (`/api/auth/[...all]`).
   - Confirm database queries against Neon PostgreSQL and Turso `masarak-results-2026` operate without errors.

---

## 4. Manual Promotion Workflow (Human Approval)

### Option A: Vercel Dashboard (Recommended)
1. Open [Vercel Dashboard -> masarak-app -> Deployments](https://vercel.com/antonyoses-projects/masarak-app/deployments).
2. Click on the verified Staged deployment.
3. Click the **three dots (`...`)** menu button at the top right.
4. Select **Promote to Production**.
5. Confirm promotion. `https://masarak.live` will immediately route to the new deployment.

### Option B: Vercel CLI (Documentation Only - Do NOT automate)
```bash
npx vercel promote <deployment-url-or-id>
```
*Example:* `npx vercel promote masarak-r31vgcx6l-antonyoses-projects.vercel.app`

---

## 5. Rollback Procedure

If an issue is detected after promoting a deployment:

### Option A: Vercel Dashboard Instant Rollback
1. Open [Vercel Dashboard -> masarak-app -> Deployments](https://vercel.com/antonyoses-projects/masarak-app/deployments).
2. Locate the previous known-good deployment (e.g. `dpl_TztDBKa4wuCLbyRtG2YrA2o1rvzR`).
3. Click **`...` -> Instant Rollback** (or **Promote to Production**).

### Option B: Vercel CLI Rollback
```bash
npx vercel rollback
```
or target a specific deployment ID:
```bash
npx vercel rollback dpl_TztDBKa4wuCLbyRtG2YrA2o1rvzR
```

---

## 6. Verification Record

- **Current Active Live Deployment**: `dpl_TztDBKa4wuCLbyRtG2YrA2o1rvzR` (`https://masarak-r31vgcx6l-antonyoses-projects.vercel.app`)
- **Live Domain**: `https://masarak.live`
- **Release Gate Configuration Date**: August 11, 2026
- **Configuration Verified**: Auto-assign Custom Production Domains verified **DISABLED** in Vercel project settings.
