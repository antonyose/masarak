import { z } from "zod";
import { egyptianGovernorates } from "@/lib/governorates";

export const resultSearchSchema = z
  .object({
    year: z.number().int().min(2023).max(2026),
    method: z.enum(["seat", "name"]),
    query: z.string().trim().max(120),
  })
  .superRefine((value, context) => {
    if (value.method === "seat" && !/^[\d٠-٩۰-۹]{4,14}$/.test(value.query)) {
      context.addIssue({
        code: "custom",
        path: ["query"],
        message: "أدخل رقم جلوس صحيحًا.",
      });
    }
    if (
      value.method === "name" &&
      value.query.replace(/[^\p{L}\p{N}]/gu, "").length < 4
    ) {
      context.addIssue({
        code: "custom",
        path: ["query"],
        message: "اكتب أربعة أحرف مفيدة على الأقل.",
      });
    }
  });

export const predictionSchema = z.object({
  year: z.number().int().min(2023).max(2026),
  educationSystem: z.enum(["new", "old"]),
  branch: z.enum(["science", "mathematics", "literary"]),
  score: z.number().nonnegative(),
  percentage: z.number().min(0).max(100),
  governorate: z.enum(egyptianGovernorates).optional(),
});
