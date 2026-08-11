# Masarak Authentication Infrastructure Guide (Better Auth + Neon)

This document details the production authentication infrastructure setup for **Masarak** (`https://masarak.live`). Codex or future developers can extend authentication (email/password, profiles, saved students, payments, admin roles) without research or Google OAuth reconfiguration.

---

## 1. Overview & Stack

- **Auth Framework**: [Better Auth](https://www.better-auth.com/) (`better-auth`)
- **Database**: Neon PostgreSQL (`@neondatabase/serverless`)
- **ORM Integration**: Drizzle ORM (`drizzle-orm/neon-http`, `better-auth/adapters/drizzle`)
- **Primary Social Provider**: Google OAuth 2.0
- **Production Base URL**: `https://masarak.live`

---

## 2. Google Cloud Console Credentials Configuration

- **Google Cloud Project**: `masarak-production`
- **Authorized Production Origin**: `https://masarak.live`
- **Authorized Local Origin**: `http://localhost:3000`
- **Authorized Production Redirect URI**: `https://masarak.live/api/auth/callback/google`
- **Authorized Local Redirect URI**: `http://localhost:3000/api/auth/callback/google`

---

## 3. Required Environment Variables

Configured in Vercel Production & Preview environments:

```env
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=ea4f4d5fa3841dcdc7502064d6b44f94dcf2e735f6f4c0edbb6b697910c36812
BETTER_AUTH_URL=https://masarak.live
GOOGLE_CLIENT_ID=<Your-Google-Client-ID>
GOOGLE_CLIENT_SECRET=<Your-Google-Client-Secret>
```

> **IMPORTANT**: `GOOGLE_CLIENT_SECRET` must **NEVER** use `NEXT_PUBLIC_` prefix.

---

## 4. Key Source Files

- **Server Configuration**: [`lib/auth.ts`](file:///a:/Work/thanawya%203ama/lib/auth.ts)
- **Client Hooks**: [`lib/auth-client.ts`](file:///a:/Work/thanawya%203ama/lib/auth-client.ts)
- **Catch-All API Route**: [`app/api/auth/[...all]/route.ts`](file:///a:/Work/thanawya%203ama/app/api/auth/%5B...all%5D/route.ts)
- **Database Schema**: [`db/schema.ts`](file:///a:/Work/thanawya%203ama/db/schema.ts)
- **UI Login Component**: [`components/auth-button.tsx`](file:///a:/Work/thanawya%203ama/components/auth-button.tsx)

---

## 5. Database Schema (Neon PostgreSQL)

Better Auth tables created in the production Neon database:

1. **`user`**: Stores user ID, name, email, email_verified, avatar image URL, timestamps.
2. **`session`**: Stores session token, user ID reference, expiration timestamp, IP address, user agent.
3. **`account`**: Stores OAuth provider ID (`google`), provider account ID, access/refresh tokens, expiration timestamps.
4. **`verification`**: Stores email verification tokens and expiration state.

---

## 6. How Auth Works in Code

### Client-Side Google Sign-In & Logout
```tsx
import { signIn, signOut, useSession } from "@/lib/auth-client";

// Initiate Google Sign-In
await signIn.social({
  provider: "google",
  callbackURL: "/",
});

// Logout
await signOut();

// Read Session in React Component
const { data: session, isPending } = useSession();
```

### Server-Side Session Access (Next.js Server Components & Route Handlers)
```ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({
  headers: await headers(),
});

if (session) {
  console.log("Logged in user ID:", session.user.id);
  console.log("Logged in user email:", session.user.email);
}
```

---

## 7. Extending Auth in Future Codex Work

### How to Add Email/Password Auth
1. In `lib/auth.ts`, add `emailAndPassword: { enabled: true }`.
2. In UI, call `signIn.email({ email, password })` or `signUp.email({ email, password, name })`.

### How to Add User/Admin Roles
1. In `db/schema.ts`, add `role: text("role").default("user")` to the `user` table.
2. In `lib/auth.ts`, configure:
   ```ts
   user: {
     additionalFields: {
       role: {
         type: "string",
         defaultValue: "user",
       },
     },
   }
   ```
3. Read `session.user.role` in API routes or Server Actions to enforce authorization checks.

---

## 8. Verification Results

- **Neon Auth Tables**: Created & verified (`user`, `session`, `account`, `verification`)
- **Better Auth Endpoint**: Exposed at `/api/auth/[...all]`
- **Local Typecheck & Build**: Passed clean (`pnpm run build`)
- **Deployment**: Pushed to `main` branch on GitHub / Vercel
