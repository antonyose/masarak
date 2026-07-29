import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { getMaxScore } from "@/lib/grade-scales";
import { predictFaculties } from "@/lib/prediction";
import { predictionSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = predictionSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: "راجع بيانات المجموع والشعبة ثم حاول مرة أخرى." },
        { status: 400 },
      );
    }

    const maxScore = getMaxScore(body.data.year, body.data.educationSystem);
    if (!maxScore || body.data.score > maxScore) {
      return NextResponse.json(
        { error: "المجموع يتجاوز النهاية العظمى للنظام والسنة المختارين." },
        { status: 400 },
      );
    }

    const calculated = predictFaculties({
      percentage: body.data.percentage,
      branch: body.data.branch,
      governorate: body.data.governorate,
    });
    let rank = {
      estimatedRank: calculated.estimatedRank,
      studentsAboveScore: calculated.studentsAboveScore,
      totalStudents: calculated.totalStudents,
      confidence: calculated.confidence as "متوسطة" | "منخفضة",
      branchFallback: false,
    };

    if (process.env.DATABASE_URL) {
      const db = getDatabase();
      const distribution = await db.execute(sql`
        SELECT
          students_above_score AS "studentsAboveScore",
          total_successful_students AS "totalStudents",
          branch
        FROM score_distributions
        WHERE year = ${body.data.year}
          AND education_system = ${body.data.educationSystem}
          AND branch IN (${body.data.branch}, 'unknown')
          AND score <= ${body.data.score}
        ORDER BY
          CASE WHEN branch = ${body.data.branch} THEN 0 ELSE 1 END,
          score DESC
        LIMIT 1
      `);
      const row = distribution.rows[0] as
        | {
            studentsAboveScore: number;
            totalStudents: number;
            branch: string;
          }
        | undefined;
      if (row) {
        rank = {
          estimatedRank: Number(row.studentsAboveScore) + 1,
          studentsAboveScore: Number(row.studentsAboveScore),
          totalStudents: Number(row.totalStudents),
          confidence: row.branch === "unknown" ? "منخفضة" : "متوسطة",
          branchFallback: row.branch === "unknown",
        };
      }
    }

    return NextResponse.json(
      {
        ...calculated,
        ...rank,
        score: body.data.score,
        percentage: body.data.percentage,
        maxScore,
        year: body.data.year,
        governorate: body.data.governorate ?? null,
        dataMode: process.env.DATABASE_URL ? "live" : "preview",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "تعذر حساب التوقع الآن. حاول مرة أخرى بعد قليل." },
      { status: 500 },
    );
  }
}
