"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "@/lib/auth-client";
import { LogOut, User as UserIcon } from "lucide-react";

export function AuthButton() {
  const { data: session, isPending } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (err) {
      console.error("Sign-in error:", err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.reload();
          },
        },
      });
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  };

  if (isPending) {
    return (
      <div className="auth-button-skeleton bg-neutral-800/40 animate-pulse rounded-full h-9 w-24 border border-neutral-700/50" />
    );
  }

  if (session?.user) {
    return (
      <div className="auth-user-bar flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || "مستخدم"}
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <UserIcon size={14} className="text-emerald-400" />
          )}
          <span className="max-w-[100px] truncate">{session.user.name || session.user.email}</span>
        </div>
        <button
          onClick={handleSignOut}
          title="تسجيل الخروج"
          className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-950/30 rounded-full transition-colors border border-transparent hover:border-red-900/40"
          aria-label="تسجيل الخروج"
        >
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleGoogleSignIn}
      disabled={isSigningIn}
      className="auth-google-btn inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 text-xs font-medium transition-all shadow-sm active:scale-95 disabled:opacity-50"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
      <span>{isSigningIn ? "جاري الاتصال..." : "المتابعة باستخدام Google"}</span>
    </button>
  );
}
