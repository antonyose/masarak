import type { Metadata } from "next";
import Link from "next/link";
import { facultySeeds } from "@/lib/prediction";

export const metadata: Metadata = { title: "دليل الكليات" };

export default function FacultiesPage() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1>دليل الكليات</h1>
          <p>
            استكشف دليلًا موسعًا للكليات الحكومية حسب القطاع والجامعة
            والمحافظة، مع حد 2025 المنشور على بوابة التنسيق الرسمية.
          </p>
        </div>
      </section>
      <section className="content-page">
        <div className="shell faculty-directory">
          {facultySeeds.map((faculty) => (
            <article key={faculty.id}>
              <h2>{faculty.facultyName}</h2>
              <p>
                {faculty.universityName} · {faculty.governorate}
              </p>
              <p>{faculty.sector}</p>
              <Link href={`/faculties/${faculty.slug}`}>تفاصيل الكلية ←</Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
