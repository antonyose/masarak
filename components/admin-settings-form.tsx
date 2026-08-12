"use client";

import { FormEvent, useEffect, useState } from "react";

type Settings = {
  fullReportPriceEgp: string;
  singleReportPriceEgp: string;
  singleReportOriginalPriceEgp: string;
  friends3PriceEgp: string;
  friends3Enabled: boolean;
  offerEnabled: boolean;
  offerTargetProduct: "single" | "friends_3" | null;
  offerBadgeText: string;
  offerTitle: string;
  offerSubtitle: string;
  offerCtaText: string;
  offerEndAt: string | Date | null;
  offerShowCountdown: boolean;
  offerShowInHeader: boolean;
  offerShowInPricingCard: boolean;
  offerShowInLockedOffer: boolean;
  vodafoneCashNumber: string;
  vodafoneDeepLink: string;
  vodafoneEnabled: boolean;
  orangeCashNumber: string;
  orangeEnabled: boolean;
  instapayIdentifier: string;
  instapayEnabled: boolean;
  paymentInstructions: string;
  supportContact: string;
  freeRecommendationCount: number;
  homepageStageMessage: string;
  updatedAt?: string | Date | null;
};

function toLocalDateTimeValue(value: Settings["offerEndAt"]) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function checked(data: FormData, name: string) {
  return data.get(name) === "on";
}

export function AdminSettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/settings", { cache: "no-store" }).then(async (response) => {
      if (response.ok) setSettings((await response.json()).settings);
    });
  }, []);

  if (!settings) return <p className="text-sm text-slate-500">جارٍ تحميل إعدادات الدفع…</p>;
  const currentSettings = settings;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const rawEndAt = String(data.get("offerEndAt") ?? "").trim();
    const payload = {
      fullReportPriceEgp: Number(currentSettings.fullReportPriceEgp),
      singleReportPriceEgp: Number(data.get("singleReportPriceEgp")),
      singleReportOriginalPriceEgp: Number(data.get("singleReportOriginalPriceEgp")),
      friends3PriceEgp: Number(data.get("friends3PriceEgp")),
      friends3Enabled: checked(data, "friends3Enabled"),
      offerEnabled: checked(data, "offerEnabled"),
      offerTargetProduct: String(data.get("offerTargetProduct") ?? "") || null,
      offerBadgeText: data.get("offerBadgeText"),
      offerTitle: data.get("offerTitle"),
      offerSubtitle: data.get("offerSubtitle"),
      offerCtaText: data.get("offerCtaText"),
      offerEndAt: rawEndAt ? new Date(rawEndAt).toISOString() : null,
      offerShowCountdown: checked(data, "offerShowCountdown"),
      offerShowInHeader: checked(data, "offerShowInHeader"),
      offerShowInPricingCard: checked(data, "offerShowInPricingCard"),
      offerShowInLockedOffer: checked(data, "offerShowInLockedOffer"),
      vodafoneCashNumber: data.get("vodafoneCashNumber"),
      vodafoneDeepLink: data.get("vodafoneDeepLink"),
      vodafoneEnabled: checked(data, "vodafoneEnabled"),
      orangeCashNumber: data.get("orangeCashNumber"),
      orangeEnabled: checked(data, "orangeEnabled"),
      instapayIdentifier: data.get("instapayIdentifier"),
      instapayEnabled: checked(data, "instapayEnabled"),
      paymentInstructions: data.get("paymentInstructions"),
      supportContact: data.get("supportContact"),
      freeRecommendationCount: Number(data.get("freeRecommendationCount")),
      homepageStageMessage: data.get("homepageStageMessage"),
    };
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      setMessage(response.ok ? "تم حفظ إعدادات العرض وتسجيل التغيير." : result.error);
      if (response.ok) setSettings(result.settings);
    } catch {
      setMessage("تعذر حفظ الإعدادات الآن.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form key={String(settings.updatedAt ?? "settings")} onSubmit={submit} className="mt-4 grid gap-4">
      <fieldset className="admin-offer-settings">
        <legend>العرض النشط والعدّاد</legend>
        <div className="admin-offer-grid">
          <label className="admin-check-row"><input name="offerEnabled" type="checkbox" defaultChecked={settings.offerEnabled} /> تفعيل العرض العام</label>
          <label className="grid gap-1 text-sm font-bold">العرض على منتج
            <select name="offerTargetProduct" defaultValue={settings.offerTargetProduct ?? ""} className="min-h-10 border border-slate-300 px-3">
              <option value="">بدون منتج محدد</option>
              <option value="single">التقرير الفردي</option>
              <option value="friends_3">عرض الصحاب</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">ينتهي في
            <input name="offerEndAt" type="datetime-local" defaultValue={toLocalDateTimeValue(settings.offerEndAt)} className="min-h-10 border border-slate-300 px-3 ltr-number" />
            <span className="text-xs font-normal text-slate-500">اتركه فارغًا لعرض مستمر بدون عدّاد.</span>
          </label>
          <label className="grid gap-1 text-sm font-bold">شارة العرض<input name="offerBadgeText" defaultValue={settings.offerBadgeText} className="min-h-10 border border-slate-300 px-3" /></label>
          <label className="grid gap-1 text-sm font-bold">عنوان قصير<input name="offerTitle" defaultValue={settings.offerTitle} className="min-h-10 border border-slate-300 px-3" /></label>
          <label className="grid gap-1 text-sm font-bold">وصف قصير<input name="offerSubtitle" defaultValue={settings.offerSubtitle} className="min-h-10 border border-slate-300 px-3" /></label>
          <label className="grid gap-1 text-sm font-bold">نص زر العرض<input name="offerCtaText" defaultValue={settings.offerCtaText} className="min-h-10 border border-slate-300 px-3" /></label>
        </div>
        <div className="admin-offer-toggles">
          <label className="admin-check-row"><input name="offerShowCountdown" type="checkbox" defaultChecked={settings.offerShowCountdown} /> إظهار العدّاد</label>
          <label className="admin-check-row"><input name="offerShowInHeader" type="checkbox" defaultChecked={settings.offerShowInHeader} /> إظهار في الهيدر</label>
          <label className="admin-check-row"><input name="offerShowInPricingCard" type="checkbox" defaultChecked={settings.offerShowInPricingCard} /> إظهار على بطاقة السعر</label>
          <label className="admin-check-row"><input name="offerShowInLockedOffer" type="checkbox" defaultChecked={settings.offerShowInLockedOffer} /> إظهار داخل التقرير المقفول</label>
        </div>
      </fieldset>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold">سعر التقرير الفردي<input name="singleReportPriceEgp" type="number" step="0.01" defaultValue={settings.singleReportPriceEgp} className="min-h-10 border border-slate-300 px-3" /></label>
        <label className="grid gap-1 text-sm font-bold">السعر الأصلي للتقرير<input name="singleReportOriginalPriceEgp" type="number" step="0.01" defaultValue={settings.singleReportOriginalPriceEgp} className="min-h-10 border border-slate-300 px-3" /><span className="text-xs font-normal text-slate-500">يظهر كسعر سابق في بطاقة العرض.</span></label>
        <label className="grid gap-1 text-sm font-bold">سعر عرض الصحاب<input name="friends3PriceEgp" type="number" step="0.01" defaultValue={settings.friends3PriceEgp} className="min-h-10 border border-slate-300 px-3" /><span className="admin-check-row"><input name="friends3Enabled" type="checkbox" defaultChecked={settings.friends3Enabled} /> العرض مفعّل</span></label>
        <label className="grid gap-1 text-sm font-bold">عدد التوصيات المجانية<input name="freeRecommendationCount" type="number" min="1" max="10" defaultValue={settings.freeRecommendationCount} className="min-h-10 border border-slate-300 px-3" /></label>
        <label className="grid gap-1 text-sm font-bold">فودافون كاش<input name="vodafoneCashNumber" defaultValue={settings.vodafoneCashNumber} className="min-h-10 border border-slate-300 px-3" /><span className="admin-check-row"><input name="vodafoneEnabled" type="checkbox" defaultChecked={settings.vodafoneEnabled} /> مفعّل</span></label>
        <label className="grid gap-1 text-sm font-bold">رابط فودافون<input name="vodafoneDeepLink" defaultValue={settings.vodafoneDeepLink} className="min-h-10 border border-slate-300 px-3 ltr-number" /></label>
        <label className="grid gap-1 text-sm font-bold">أورنج كاش<input name="orangeCashNumber" defaultValue={settings.orangeCashNumber} className="min-h-10 border border-slate-300 px-3" /><span className="admin-check-row"><input name="orangeEnabled" type="checkbox" defaultChecked={settings.orangeEnabled} /> مفعّل</span></label>
        <label className="grid gap-1 text-sm font-bold">إنستا باي<input name="instapayIdentifier" defaultValue={settings.instapayIdentifier} className="min-h-10 border border-slate-300 px-3" /><span className="admin-check-row"><input name="instapayEnabled" type="checkbox" defaultChecked={settings.instapayEnabled} /> مفعّل</span></label>
        <label className="grid gap-1 text-sm font-bold md:col-span-2">تعليمات الدفع<textarea name="paymentInstructions" defaultValue={settings.paymentInstructions} className="min-h-20 border border-slate-300 p-3" /></label>
        <label className="grid gap-1 text-sm font-bold">دعم WhatsApp<input name="supportContact" defaultValue={settings.supportContact} className="min-h-10 border border-slate-300 px-3" /></label>
        <label className="grid gap-1 text-sm font-bold">رسالة المرحلة<input name="homepageStageMessage" defaultValue={settings.homepageStageMessage} className="min-h-10 border border-slate-300 px-3" /></label>
      </div>
      <div><button disabled={loading} className="min-h-11 bg-teal-700 px-5 font-bold text-white">{loading ? "جارٍ الحفظ…" : "حفظ إعدادات التشغيل"}</button>{message ? <span className="mr-3 text-sm font-bold text-teal-800">{message}</span> : null}</div>
    </form>
  );
}
