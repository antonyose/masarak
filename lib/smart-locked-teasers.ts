import type { Branch } from "@/lib/grade-scales";

export interface SmartTeaser {
  id: string;
  question: string;
  categoryTag: string;
  badgeText: string;
  urgencyHint?: string;
}

export function generateSmartLockedTeasers({
  branch,
  score,
  percentage,
  governorate,
  isStage3 = false,
}: {
  branch?: Branch | "unknown";
  score?: number | null;
  percentage?: number | null;
  governorate?: string | null;
  isStage3?: boolean;
}): SmartTeaser[] {
  const scoreText = score != null && Number.isFinite(score) ? `${score} درجة` : "";
  const pct = percentage != null && Number.isFinite(percentage) ? percentage : 75;
  const govText = governorate && governorate.trim() ? governorate.trim() : null;

  if (isStage3) {
    return [
      {
        id: "stage3-vacancies",
        question: scoreText
          ? `ما هي الكليات الحكومية الشاغرة المتوقع نزولها لمجموعك (${scoreText}) في المرحلة الثالثة؟`
          : "ما هي الكليات الحكومية الشاغرة المتوقع نزولها لمجموعك في المرحلة الثالثة؟",
        categoryTag: "توقعات المرحلة الثالثة الحصرية",
        badgeText: "متاح في التقرير 🔒",
      },
      {
        id: "stage3-institutes",
        question: govText
          ? `أفضل المعاهد العليا المعتمدة المتاحة في ${govText} والمحافظات القريبة لمجموعك`
          : "أفضل المعاهد العليا المعتمدة من وزارة التعليم العالي المناسبة لمجموعك",
        categoryTag: "المعاهد المعتمدة وتجنب الوهمية",
        badgeText: "متاح في التقرير 🔒",
      },
      {
        id: "stage3-safety",
        question: "كيف ترتب رغباتك في المرحلة الثالثة لتفادي استنفاد الرغبات وضمان القبول؟",
        categoryTag: "استراتيجية التنسيق الآمن",
        badgeText: "متاح في التقرير 🔒",
      },
    ];
  }

  const teasers: SmartTeaser[] = [];

  // Question 1: Sector / College Match tailored to Branch & Score
  if (branch === "science") {
    if (pct >= 84) {
      teasers.push({
        id: "science-high",
        question: scoreText
          ? `هل مجموعك (${scoreText}) يناسب حاسبات ومعلومات أو ذكاء اصطناعي ضمن شواغر المرحلة الثالثة؟`
          : "هل مجموعك يناسب كليات الحاسبات والذكاء الاصطناعي المتاحة في المرحلة الثالثة؟",
        categoryTag: "تحليل شواغر المرحلة الثالثة",
        badgeText: "متاح في التقرير 🔒",
      });
    } else if (pct >= 70) {
      teasers.push({
        id: "science-mid",
        question: scoreText
          ? `فرصتك الحقيقية في كليات العلوم، التمريض، والزراعة لمجموعك (${scoreText})`
          : "فرصتك الحقيقية في كليات العلوم والتمريض والزراعة المتاحة لمجموعك",
        categoryTag: "تحليل القطاع الطبي والعلمي",
        badgeText: "متاح في التقرير 🔒",
      });
    } else {
      teasers.push({
        id: "science-low",
        question: scoreText
          ? `الكليات الحكومية والمعاهد العليا المعتمدة المتبقية لمجموعك (${scoreText})`
          : "الاختيارات الحكومية المتاحة رسميًا لمجموعك في المرحلة الثالثة",
        categoryTag: "كليات متاحة لمجموعك",
        badgeText: "متاح في التقرير 🔒",
      });
    }
  } else if (branch === "mathematics") {
    if (pct >= 76) {
      teasers.push({
        id: "math-high",
        question: scoreText
          ? `موقف مجموعك (${scoreText}) من كليات الحاسبات، الذكاء الاصطناعي، وهندسة إلكترونية`
          : "موقف مجموعك من كليات الحاسبات والذكاء الاصطناعي والفنون التطبيقية",
        categoryTag: "تحليل القطاع الهندسي والتقني",
        badgeText: "متاح في التقرير 🔒",
      });
    } else if (pct >= 65) {
      teasers.push({
        id: "math-mid",
        question: scoreText
          ? `فرصتك في كليات العلوم (رياضة)، التجارة، وتكنولوجيا العلوم الصحية لمجموعك (${scoreText})`
          : "فرصتك في كليات العلوم والتجارة وتكنولوجيا العلوم الصحية لمجموعك",
        categoryTag: "تحليل الكليات المناسبة لشعبتك",
        badgeText: "متاح في التقرير 🔒",
      });
    } else {
      teasers.push({
        id: "math-low",
        question: scoreText
          ? `أفضل المعاهد العليا للهندسة والتكنولوجيا والكليات المتاحة لمجموع (${scoreText})`
          : "أفضل المعاهد الهندسية المعتمدة والكليات المتاحة لشعبتك",
        categoryTag: "البدائل والمعاهد المعتمدة",
        badgeText: "متاح في التقرير 🔒",
      });
    }
  } else if (branch === "literary") {
    if (pct >= 72) {
      teasers.push({
        id: "lit-high",
        question: scoreText
          ? `هل تقبلك كليات الألسن، الإعلام، الآثار، أو تجارة إنجليزي لمجموعك (${scoreText})؟`
          : "هل تقبلك كليات الألسن أو الإعلام أو الآثار وتجارة إنجليزي؟",
        categoryTag: "تحليل كليات القمة الأدبية",
        badgeText: "متاح في التقرير 🔒",
      });
    } else if (pct >= 60) {
      teasers.push({
        id: "lit-mid",
        question: scoreText
          ? `فرصتك في كليات التربية، الآداب، والحقوق لمجموعك (${scoreText})`
          : "فرصتك المؤكدة في كليات التربية والآداب والحقوق",
        categoryTag: "تحليل كليات النطاق الأدبي",
        badgeText: "متاح في التقرير 🔒",
      });
    } else {
      teasers.push({
        id: "lit-low",
        question: scoreText
          ? `كليات الخدمة الاجتماعية والسياحة والفنادق والمعاهد المتاحة لمجموعك (${scoreText})`
          : "الكليات والمعاهد المعتمدة المتاحة لشعبتك الأدبية",
        categoryTag: "الكليات المتبقية لمجموعك",
        badgeText: "متاح في التقرير 🔒",
      });
    }
  } else {
    // Unknown branch or generic fallback
    teasers.push({
      id: "generic-score",
      question: scoreText
        ? `ما هي أنسب وأقرب الكليات الحكومية المضمونة لمجموعك (${scoreText})؟`
        : "ما هي أنسب وأقرب الكليات الحكومية المضمونة لمجموعك؟",
      categoryTag: "تحليل المجموع والفرص المؤكدة",
      badgeText: "متاح في التقرير 🔒",
    });
  }

  // Question 2: Geographic Proximity & Alienation Reduction (تقليل الاغتراب)
  if (govText) {
    teasers.push({
      id: "geo-gov",
      question: `هل تضمن القبول في كليات ${govText} مباشرة أم ستحتاج للتوزيع الجغرافي وتقليل الاغتراب؟`,
      categoryTag: `تحليل التوزيع الجغرافي لمحافظة ${govText}`,
      badgeText: "متاح في التقرير 🔒",
    });
  } else {
    teasers.push({
      id: "geo-general",
      question: "ما هي أقرب الكليات لمحافظتك ونطاقك الجغرافي (أ) و (ب) المضمونة لمجموعك؟",
      categoryTag: "التوزيع الجغرافي وتقليل الاغتراب",
      badgeText: "متاح في التقرير 🔒",
    });
  }

  // Question 3: Safe ranking & preventing choice exhaustion
  teasers.push({
    id: "strategy-safe",
    question: scoreText
      ? `الترتيب الأضمن لـ 75 رغبة لمجموعك (${scoreText}) لتفادي استنفاد الرغبات`
      : "الترتيب الأضمن لـ 75 رغبة لتفادي استنفاد الرغبات وضمان أفضل كلية",
    categoryTag: "استراتيجية كتابة الرغبات",
    badgeText: "متاح في التقرير 🔒",
  });

  return teasers;
}
