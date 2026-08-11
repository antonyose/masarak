import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { enforceRateLimit } from "@/lib/request-security";
import { resultSearchSchema } from "@/lib/schemas";
import { searchTursoResults } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      request,
      scope: "result-search",
      limit: 20,
      windowSeconds: 60,
    });
    const parsed = resultSearchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات البحث غير صحيحة." },
        { status: 400 },
      );
    }

    await trackEvent("search");
    const { method, query, year } = parsed.data;
    let search;
    let dataMode = "live";
    if (process.env.TURSO_DATABASE_URL) {
      search = await searchTursoResults({ method, query, year });
    } else if (
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_LOCAL_RESULT_FALLBACK === "true"
    ) {
      const local = await import("@/lib/local-results");
      if (!local.hasLocalResultsDatabase()) throw new Error("TURSO_NOT_CONFIGURED");
      search = local.searchLocalResults({ method, query, year });
      dataMode = "development-local";
    } else {
      throw new Error("TURSO_NOT_CONFIGURED");
    }

    return NextResponse.json(
      {
        results: search.results,
        count: search.results.length,
        totalCount: search.totalCount,
        hasMore: search.totalCount > search.results.length,
        dataMode,
        message: search.results.length
          ? undefined
          : "لم نعثر على نتيجة مطابقة. راجع كتابة الاسم أو رقم الجلوس وحاول مرة أخرى.",
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "تم إجراء محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    console.error("Result search failed:", error);
    return NextResponse.json(
      { error: "خدمة النتائج غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
