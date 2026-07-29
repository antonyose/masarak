import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { facultySeeds } from "@/lib/prediction";

export function generateStaticParams() {
  return facultySeeds.map((faculty) => ({ slug: faculty.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const faculty = facultySeeds.find((item) => item.slug === slug);
  return { title: faculty ? faculty.facultyName : "الكلية" };
}

export default async function FacultyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const faculty = facultySeeds.find((item) => item.slug === slug);
  if (!faculty) notFound();

  return (
    <ContentPage
      title={`${faculty.facultyName} — ${faculty.universityName}`}
      description={`${faculty.sector} · ${faculty.governorate}`}
    >
      <h2>النطاق المتوقع المبدئي</h2>
      <p className="ltr-number">
        {faculty.expectedRange[0]}% – {faculty.expectedRange[1]}%
      </p>
      <h2>الحدود التاريخية المسجلة</h2>
      <ul>
        <li className="ltr-number">
          2023:{" "}
          {faculty.historicalCutoffs[2023] === null
            ? "غير مضاف بعد"
            : `${faculty.historicalCutoffs[2023]}%`}
        </li>
        <li className="ltr-number">
          2024:{" "}
          {faculty.historicalCutoffs[2024] === null
            ? "غير مضاف بعد"
            : `${faculty.historicalCutoffs[2024]}%`}
        </li>
        <li className="ltr-number">
          2025: {faculty.historicalCutoffs[2025]}%
        </li>
      </ul>
      <p>
        الاسم كما ورد في المصدر: «{faculty.officialName}».{" "}
        <a href={faculty.sourceUrl} target="_blank" rel="noreferrer">
          راجع بيان تنسيق 2025 الرسمي
        </a>
        .
      </p>
      <h2>اقرأ الرقم في سياقه</h2>
      <p>
        النطاق استرشادي ويتأثر بعدد الطلاب وتوزيع الدرجات والرغبات والطاقة
        الاستيعابية. استخدم أداة التوقع لمقارنة ترتيبك النسبي، وليس النسبة وحدها.
      </p>
    </ContentPage>
  );
}
