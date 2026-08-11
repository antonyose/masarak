import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/db/client";
import {
  predictionEntitlements,
  predictionRuns,
  savedStudents,
  user,
} from "@/db/schema";

export class AuthorizationError extends Error {
  constructor(
    public status: 401 | 403 | 404,
    message = "غير مصرح بالوصول.",
  ) {
    super(message);
  }
}

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new AuthorizationError(401);
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  const [record] = await getDatabase()
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (record?.role !== "admin") throw new AuthorizationError(403);
  return session;
}

export async function requireOwnedStudent(studentId: string, userId: string) {
  const [record] = await getDatabase()
    .select()
    .from(savedStudents)
    .where(and(eq(savedStudents.id, studentId), eq(savedStudents.userId, userId)))
    .limit(1);
  if (!record) throw new AuthorizationError(404);
  return record;
}

export async function requireOwnedPrediction(
  predictionId: string,
  userId: string,
) {
  const [record] = await getDatabase()
    .select()
    .from(predictionRuns)
    .where(
      and(eq(predictionRuns.id, predictionId), eq(predictionRuns.userId, userId)),
    )
    .limit(1);
  if (!record) throw new AuthorizationError(404);
  return record;
}

export async function hasAnnualEntitlement({
  userId,
  savedStudentId,
  year,
}: {
  userId: string;
  savedStudentId: string;
  year: number;
}) {
  const [record] = await getDatabase()
    .select({ id: predictionEntitlements.id })
    .from(predictionEntitlements)
    .where(
      and(
        eq(predictionEntitlements.userId, userId),
        eq(predictionEntitlements.savedStudentId, savedStudentId),
        eq(predictionEntitlements.year, year),
      ),
    )
    .limit(1);
  return Boolean(record);
}
