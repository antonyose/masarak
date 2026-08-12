"use client";

import { FormEvent, useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";

export function LoginExperience() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function callbackUrl() {
    const requested = new URLSearchParams(window.location.search).get("next");
    return requested?.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/account";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const data = new FormData(event.currentTarget);
    const rawEmail = String(data.get("email") ?? "").trim();
    let email = rawEmail;
    if (rawEmail.toLowerCase() === "admin") {
      email = "admin@masarak.live";
    } else if (!rawEmail.includes("@")) {
      email = `${rawEmail}@masarak.live`;
    }

    const values = {
      name: String(data.get("name") ?? ""),
      email,
      phone: String(data.get("phone") ?? ""),
      password: String(data.get("password") ?? ""),
      callbackURL: callbackUrl(),
    };

    try {
      const result =
        mode === "signup"
          ? await signUp.email(values)
          : await signIn.email({
              email: values.email,
              password: values.password,
              callbackURL: values.callbackURL,
            });
      if (result.error) throw new Error(result.error.message || "تعذر إكمال الدخول.");
      window.location.assign(values.callbackURL);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر إكمال الدخول.");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    setError("");
    try {
      await signIn.social({ provider: "google", callbackURL: callbackUrl() });
    } catch {
      setError("تعذر بدء تسجيل الدخول عبر Google.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg border border-slate-200 bg-white p-6 shadow-[0_16px_50px_rgba(15,42,61,.1)] md:p-8">
      <div className="grid grid-cols-2 border border-slate-200 p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`p-2.5 font-bold ${mode === "login" ? "bg-[#173a55] text-white" : "text-slate-600"}`}
        >
          تسجيل الدخول
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`p-2.5 font-bold ${mode === "signup" ? "bg-[#173a55] text-white" : "text-slate-600"}`}
        >
          حساب جديد
        </button>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        {mode === "signup" ? (
          <>
            <label className="grid gap-1.5 text-sm font-bold text-slate-800">
              الاسم
              <input
                name="name"
                required
                minLength={2}
                className="min-h-12 border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-800">
              رقم الموبايل المصري
              <input
                name="phone"
                required
                inputMode="tel"
                className="min-h-12 border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none ltr-number"
              />
            </label>
          </>
        ) : null}

        <label className="grid gap-1.5 text-sm font-bold text-slate-800">
          البريد الإلكتروني أو اسم المستخدم
          <input
            name="email"
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="admin أو البريد الإلكتروني"
            className="min-h-12 border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none ltr-number"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-bold text-slate-800">
          كلمة المرور
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="••••••••"
            className="min-h-12 border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none ltr-number"
          />
        </label>

        {error ? (
          <p className="border-r-4 border-red-600 bg-red-50 p-3 text-sm font-bold text-red-800">
            {error}
          </p>
        ) : null}

        <button
          disabled={loading}
          className="min-h-12 bg-teal-700 px-4 font-extrabold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {loading ? "جارٍ المتابعة…" : mode === "signup" ? "إنشاء الحساب والمتابعة" : "دخول"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        أو
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="button"
        onClick={google}
        disabled={loading}
        className="min-h-12 w-full border border-slate-300 bg-white px-4 font-bold text-slate-700 hover:bg-slate-50"
      >
        المتابعة باستخدام Google
      </button>

      <p className="mt-4 text-xs leading-6 text-slate-500">
        مستخدم Google يستطيع حفظ نتيجة دون موبايل، لكنه سيحتاج لإكمال الرقم قبل إرسال طلب دفع.
      </p>
    </div>
  );
}
