import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { inNeonTransaction } from "@/db/transaction";
import { AuthorizationError, requireAdmin } from "@/lib/authz";
import { assertSameOrigin } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireAdmin();
    const { id } = await context.params;
    const result = await inNeonTransaction(async (client) => {
      const found = await client.query<{ id: string; year: number; stage: number; backtest_metrics_json: Record<string, unknown> }>("SELECT id, year, stage, backtest_metrics_json FROM model_versions WHERE id = $1 FOR UPDATE", [id]);
      const model = found.rows[0];
      if (!model) throw new Error("MODEL_NOT_FOUND");
      if (model.backtest_metrics_json.activationReady !== true) throw new Error("BACKTEST_GATE_FAILED");
      await client.query("UPDATE model_versions SET activated_at = now() WHERE id = $1", [id]);
      await client.query("UPDATE coordination_cycles SET active_model_version_id = $1, updated_at = now() WHERE year = $2", [id, model.year]);
      await client.query("INSERT INTO admin_audit_logs (actor_user_id, action, target_type, target_id, after_json, request_id) VALUES ($1, 'model.activate', 'model_version', $2, $3::jsonb, $4)", [session.user.id, id, JSON.stringify({ year: model.year, stage: model.stage, activationScope: model.backtest_metrics_json.activationScope ?? null, oldSystemGateApplied: false }), request.headers.get("x-request-id") ?? randomUUID()]);
      return { id, year: model.year, stage: model.stage };
    });
    return NextResponse.json({ model: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = error instanceof AuthorizationError ? error.status : message === "MODEL_NOT_FOUND" ? 404 : message === "BACKTEST_GATE_FAILED" ? 409 : 500;
    return NextResponse.json({ error: message === "BACKTEST_GATE_FAILED" ? "لم يجتز هذا النموذج بوابة الاختبارات المسجلة لنطاق تفعيله." : "تعذر تفعيل النموذج." }, { status });
  }
}
