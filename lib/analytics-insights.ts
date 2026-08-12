export type AnalyticsMode = "sessions" | "aggregate";

export type EventMetric = {
  event_name: string;
  total: number;
};

export type BehaviorFunnelStep = EventMetric & {
  label: string;
  instrumented: boolean;
};

export type BehaviorRate = {
  key: "resultReach" | "offerReach" | "checkoutCompletion" | "approval";
  label: string;
  value: number | null;
  numerator: number;
  denominator: number;
};

export type BehaviorInsight = {
  tone: "positive" | "warning" | "info";
  title: string;
  detail: string;
};

const STEP_DEFINITIONS = [
  { event_name: "page_view", label: "زيارة الموقع", legacy: true },
  { event_name: "search_result", label: "الوصول لنتيجة", legacy: true },
  { event_name: "report_viewed", label: "ظهور التقرير", legacy: false },
  { event_name: "offer_viewed", label: "مشاهدة عرض التقرير", legacy: false },
  { event_name: "checkout_intent", label: "بدء قرار الشراء", legacy: true },
  { event_name: "receipt_uploaded", label: "اختيار الإيصال", legacy: false },
  { event_name: "payment_submitted", label: "إرسال طلب الدفع", legacy: true },
  { event_name: "payment_approved", label: "دفع مقبول", legacy: true },
] as const;

function asLookup(metrics: EventMetric[]) {
  return Object.fromEntries(metrics.map((metric) => [metric.event_name, Number(metric.total) || 0]));
}

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function buildBehaviorFunnel(
  metrics: EventMetric[],
  approvedPayments: number,
  mode: AnalyticsMode,
): BehaviorFunnelStep[] {
  const lookup = asLookup(metrics);
  const checkoutIntent = mode === "sessions"
    ? (lookup.checkout_intent ?? 0)
    : Math.max(
        lookup.pricing_cta_clicked ?? 0,
        lookup.product_selected ?? 0,
        lookup.header_offer_clicked ?? 0,
      );

  const values: Record<string, number> = {
    ...lookup,
    checkout_intent: checkoutIntent,
    payment_approved: approvedPayments,
  };

  return STEP_DEFINITIONS.map((step) => ({
    event_name: step.event_name,
    label: step.label,
    total: values[step.event_name] ?? 0,
    instrumented: mode === "sessions" || step.legacy || (lookup[step.event_name] ?? 0) > 0,
  }));
}

export function buildBehaviorRates(funnel: BehaviorFunnelStep[]): BehaviorRate[] {
  const lookup = asLookup(funnel);
  const definitions = [
    { key: "resultReach" as const, label: "الوصول لنتيجة", numerator: lookup.search_result ?? 0, denominator: lookup.page_view ?? 0 },
    { key: "offerReach" as const, label: "وصول التقرير للعرض", numerator: lookup.offer_viewed ?? 0, denominator: lookup.report_viewed ?? 0 },
    { key: "checkoutCompletion" as const, label: "إكمال طلب الدفع", numerator: lookup.payment_submitted ?? 0, denominator: lookup.checkout_intent ?? 0 },
    { key: "approval" as const, label: "قبول طلبات الدفع", numerator: lookup.payment_approved ?? 0, denominator: lookup.payment_submitted ?? 0 },
  ];

  return definitions.map((definition) => ({
    ...definition,
    value: safeRate(definition.numerator, definition.denominator),
  }));
}

export function buildBehaviorInsights(
  funnel: BehaviorFunnelStep[],
  mode: AnalyticsMode,
  engagedSessions: number,
  uniqueSessions: number,
): BehaviorInsight[] {
  const lookup = asLookup(funnel);
  const insights: BehaviorInsight[] = [];
  const checkoutRate = safeRate(lookup.payment_submitted ?? 0, lookup.checkout_intent ?? 0);
  const approvalRate = safeRate(lookup.payment_approved ?? 0, lookup.payment_submitted ?? 0);
  const resultRate = safeRate(lookup.search_result ?? 0, lookup.page_view ?? 0);

  if (mode === "aggregate") {
    insights.push({
      tone: "info",
      title: "البيانات القديمة كانت تعدّ التفاعلات فقط",
      detail: "بدأنا تتبع الجلسات المجهولة من النسخة الجديدة؛ لا نستخدم اسم الطالب أو رقم الجلوس أو عنوان IP.",
    });
  } else if (uniqueSessions > 0) {
    const engagementRate = safeRate(engagedSessions, uniqueSessions) ?? 0;
    insights.push({
      tone: engagementRate >= 45 ? "positive" : "warning",
      title: `${engagementRate}% من الجلسات استمرت 15 ثانية أو أكثر`,
      detail: engagementRate >= 45
        ? "الزوار يقضون وقتًا كافيًا لفهم الأداة؛ راقب استمرار النسبة مع زيادة الزيارات."
        : "جزء كبير يخرج بسرعة؛ راجع سرعة الصفحة ووضوح أول خطوة على الموبايل.",
    });
  }

  if (checkoutRate !== null) {
    insights.push({
      tone: checkoutRate >= 20 ? "positive" : "warning",
      title: `${checkoutRate}% ممن بدأوا قرار الشراء أرسلوا طلب الدفع`,
      detail: checkoutRate >= 20
        ? "مسار الدفع يتحول بصورة جيدة؛ ركّز على سرعة مراجعة الطلبات."
        : "أكبر فرصة تحسين حاليًا بين اختيار العرض وإرسال الإيصال؛ بسّط التعليمات ووضّح الثقة ووقت المراجعة.",
    });
  }

  if (approvalRate !== null) {
    insights.push({
      tone: approvalRate >= 70 && approvalRate <= 100 ? "positive" : "warning",
      title: `${approvalRate}% من طلبات الدفع المرسلة تم قبولها`,
      detail: approvalRate > 100
        ? "هناك طلبات أقدم من بداية التتبع داخل الفترة؛ لا تستخدم النسبة لاتخاذ قرار حتى تكتمل نافذة القياس."
        : approvalRate >= 70
        ? "جودة طلبات الدفع جيدة. الطلبات المعلقة تُحسب منفصلة حتى لا نعتبرها رفضًا."
        : "راجع أسباب الرفض وجودة صور الإيصالات ووضوح بيانات التحويل.",
    });
  }

  if (resultRate !== null) {
    insights.push({
      tone: resultRate >= 50 ? "positive" : "warning",
      title: `${resultRate}% نسبة الوصول إلى نتيجة مقارنة بزيارات الفترة`,
      detail: mode === "sessions"
        ? "النسبة مبنية على جلسات مجهولة فريدة داخل كل خطوة."
        : "هذه مقارنة اتجاهية بين تفاعلات مجمعة، وليست نسبة مستخدمين فريدة.",
    });
  }

  if ((lookup.report_viewed ?? 0) > 0 && (lookup.offer_viewed ?? 0) === 0) {
    insights.push({
      tone: "warning",
      title: "التقارير تظهر لكن عرض الدفع لا يُسجّل",
      detail: "تحقق من ظهور منطقة التقرير المدفوع أو من خطأ في تحميل إعدادات الدفع.",
    });
  }

  return insights.slice(0, 4);
}
