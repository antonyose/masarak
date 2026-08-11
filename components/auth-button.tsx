"use client";

import Link from "next/link";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { signOut, useSession } from "@/lib/auth-client";

export function AuthButton() {
  const { data: session, isPending } = useSession();
  if (isPending) return <span className="h-10 w-24 animate-pulse bg-slate-200" aria-hidden="true" />;
  if (!session?.user) return <Link href="/login" className="inline-flex min-h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-bold text-[#173a55]"><LogIn size={16} />دخول</Link>;
  return <div className="flex items-center gap-2"><Link href="/account" className="inline-flex min-h-10 items-center gap-2 border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-900"><UserRound size={15} /><span className="max-w-24 truncate">{session.user.name || "حسابي"}</span></Link><button type="button" onClick={() => signOut({ fetchOptions: { onSuccess: () => window.location.assign("/") } })} className="grid size-10 place-items-center text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label="تسجيل الخروج"><LogOut size={17} /></button></div>;
}
