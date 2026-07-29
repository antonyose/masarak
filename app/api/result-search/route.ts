import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { getDatabase } from "@/db/client";
import { trackEvent } from "@/lib/analytics";
import {
  hasLocalResultsDatabase,
  searchLocalResults,
} from "@/lib/local-results";
import { normalizeArabicName, normalizeDigits } from "@/lib/normalize-arabic";
import { resultSearchSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DemoResult = {
  year: number;
  seatNumber: string;
  studentName: string;
  educationSystem: "new" | "old";
  branch: "science" | "mathematics" | "literary";
  branchLabel: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  nationalRank: null;
  nationalTotalStudents: null;
  resultStatus: string;
  schoolName?: string;
  governorate?: string;
};

const demoResults: DemoResult[] = [
  {
    year: 2026,
    seatNumber: "123456",
    studentName: "محمد أحمد السيد محمود",
    educationSystem: "new",
    branch: "science",
    branchLabel: "علمي علوم",
    totalScore: 288,
    maxScore: 320,
    percentage: 90,
    nationalRank: null,
    nationalTotalStudents: null,
    resultStatus: "ناجح",
    schoolName: "مدرسة النيل الثانوية",
    governorate: "القاهرة",
  },
  {
    year: 2026,
    seatNumber: "654321",
    studentName: "مريم إبراهيم عبد الرحمن",
    educationSystem: "new",
    branch: "mathematics",
    branchLabel: "علمي رياضة",
    totalScore: 294.5,
    maxScore: 320,
    percentage: 92.03,
    nationalRank: null,
    nationalTotalStudents: null,
    resultStatus: "ناجح",
    governorate: "الجيزة",
  },
  {
    year: 2025,
    seatNumber: "245810",
    studentName: "يوسف خالد محمد علي",
    educationSystem: "new",
    branch: "literary",
    branchLabel: "أدبي",
    totalScore: 276,
    maxScore: 320,
    percentage: 86.25,
    nationalRank: null,
    nationalTotalStudents: null,
    resultStatus: "ناجح",
    governorate: "الإسكندرية",
  },
];

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

function isMemoryRateLimited(key: string): boolean {
  const now = Date.now();
  const current = rateLimit.get(key);
  if (!current || current.resetAt <= now) {
    rateLimit.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}

async function isRateLimited(key: string): Promise<boolean> {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!process.env.DATABASE_URL || !secret) {
    return isMemoryRateLimited(key);
  }

  const day = new Date().toISOString().slice(0, 10);
  const hashedKey = createHmac("sha256", secret)
    .update(`${day}:${key}`)
    .digest("hex");
  const db = getDatabase();
  const result = await db.execute(sql`
    INSERT INTO search_rate_limits ("key", window_start, "count")
    VALUES (${hashedKey}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN search_rate_limits.window_start < now() - interval '1 minute'
          THEN 1
        ELSE search_rate_limits."count" + 1
      END,
      window_start = CASE
        WHEN search_rate_limits.window_start < now() - interval '1 minute'
          THEN now()
        ELSE search_rate_limits.window_start
      END
    RETURNING "count"
  `);
  return Number(result.rows[0]?.count ?? 1) > MAX_REQUESTS;
}

async function searchDatabase({
  method,
  query,
  year,
}: {
  method: "seat" | "name";
  query: string;
  year: number;
}) {
  const db = getDatabase();
  if (method === "seat") {
    const result = await db.execute(sql`
      SELECT
        result.year,
        result.seat_number AS "seatNumber",
        result.student_name_original AS "studentName",
        result.education_system AS "educationSystem",
        result.branch,
        CASE result.branch
          WHEN 'science' THEN 'علمي علوم'
          WHEN 'mathematics' THEN 'علمي رياضة'
          WHEN 'literary' THEN 'أدبي'
          ELSE 'غير متاح'
        END AS "branchLabel",
        result.total_score AS "totalScore",
        result.max_score AS "maxScore",
        result.percentage,
        (
          SELECT COUNT(*) + 1
          FROM student_results ranked
          WHERE ranked.year = result.year
            AND ranked.total_score > result.total_score
        )::int AS "nationalRank",
        (
          SELECT COUNT(*)
          FROM student_results nationwide
          WHERE nationwide.year = result.year
        )::int AS "nationalTotalStudents",
        result.result_status AS "resultStatus",
        result.school_name AS "schoolName",
        result.governorate
      FROM student_results result
      WHERE result.year = ${year}
        AND result.seat_number = ${normalizeDigits(query)}
      LIMIT 1
    `);
    return result.rows;
  }

  const normalized = normalizeArabicName(query).toLowerCase();
  const containsPattern = `%${normalized}%`;
  const prefixPattern = `${normalized}%`;
  const wordPattern = `% ${normalized}%`;
  const result = await db.execute(sql`
    SELECT
      result.year,
      result.seat_number AS "seatNumber",
      result.student_name_original AS "studentName",
      result.education_system AS "educationSystem",
      result.branch,
      CASE result.branch
        WHEN 'science' THEN 'علمي علوم'
        WHEN 'mathematics' THEN 'علمي رياضة'
        WHEN 'literary' THEN 'أدبي'
        ELSE 'غير متاح'
      END AS "branchLabel",
      result.total_score AS "totalScore",
      result.max_score AS "maxScore",
      result.percentage,
      (
        SELECT COUNT(*) + 1
        FROM student_results ranked
        WHERE ranked.year = result.year
          AND ranked.total_score > result.total_score
      )::int AS "nationalRank",
      (
        SELECT COUNT(*)
        FROM student_results nationwide
        WHERE nationwide.year = result.year
      )::int AS "nationalTotalStudents",
      result.result_status AS "resultStatus",
      result.school_name AS "schoolName",
      result.governorate
    FROM student_results result
    WHERE result.year = ${year}
      AND (
        result.student_name_normalized ILIKE ${containsPattern}
        OR similarity(result.student_name_normalized, ${normalized}) > 0.22
      )
    ORDER BY
      CASE
        WHEN result.student_name_normalized = ${normalized} THEN 0
        WHEN result.student_name_normalized ILIKE ${prefixPattern} THEN 1
        WHEN result.student_name_normalized ILIKE ${wordPattern} THEN 2
        ELSE 3
      END,
      similarity(result.student_name_normalized, ${normalized}) DESC,
      result.id ASC
    LIMIT 20
  `);
  return result.rows;
}

export async function POST(request: Request) {
  await trackEvent("search");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const requestKey = forwarded || "local";
  if (await isRateLimited(requestKey)) {
    return NextResponse.json(
      { error: "تم إجراء محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى." },
      {
        status: 429,
        headers: { "Cache-Control": "private, no-store", "Retry-After": "60" },
      },
    );
  }

  try {
    const parsed = resultSearchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات البحث غير صحيحة." },
        { status: 400, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const { method, query, year } = parsed.data;
    const normalizedQuery =
      method === "seat"
        ? normalizeDigits(query)
        : normalizeArabicName(query).toLowerCase();

    const usingDatabase = Boolean(process.env.DATABASE_URL);
    const usingLocalDatabase =
      !usingDatabase && hasLocalResultsDatabase();
    let matches: Awaited<ReturnType<typeof searchDatabase>> | DemoResult[];
    let totalCount: number;

    if (usingDatabase) {
      matches = await searchDatabase({ method, query, year });
      totalCount = matches.length;
    } else if (usingLocalDatabase) {
      const localMatches = searchLocalResults({ method, query, year });
      matches = localMatches.results;
      totalCount = localMatches.totalCount;
    } else {
      matches = demoResults
        .filter((result) => result.year === year)
        .filter((result) =>
          method === "seat"
            ? result.seatNumber === normalizedQuery
            : normalizeArabicName(result.studentName)
                .toLowerCase()
                .includes(normalizedQuery),
        )
        .slice(0, 20);
      totalCount = matches.length;
    }

    const dataMode = usingDatabase || usingLocalDatabase ? "live" : "preview";

    return NextResponse.json(
      {
        results: matches,
        count: matches.length,
        totalCount,
        hasMore: totalCount > matches.length,
        dataMode,
        message: matches.length
          ? undefined
          : dataMode === "preview"
            ? "بيانات نتائج 2026 الكاملة غير متصلة بهذه النسخة التجريبية."
            : "لم نعثر على نتيجة مطابقة. راجع كتابة الاسم أو رقم الجلوس وحاول مرة أخرى.",
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "تعذر إتمام البحث الآن. حاول مرة أخرى بعد قليل." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
