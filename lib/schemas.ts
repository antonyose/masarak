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

export const egyptianPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .refine((value) => /^(?:\+20|0020|0)?1[0125]\d{8}$/.test(value), {
    message: "أدخل رقم موبايل مصريًا صحيحًا.",
  })
  .transform((value) => {
    if (value.startsWith("+20")) return `0${value.slice(3)}`;
    if (value.startsWith("0020")) return `0${value.slice(4)}`;
    return value.startsWith("0") ? value : `0${value}`;
  });

export const savedStudentSchema = z.object({
  year: z.literal(2026),
  seatNumber: z.string().trim().regex(/^[\d٠-٩۰-۹]{4,14}$/),
  branch: z.enum(["science", "mathematics", "literary"]),
});

export const predictionPreviewSchema = predictionSchema.extend({
  seatNumber: z.string().trim().optional(),
});

export const predictionCreateSchema = z.object({
  savedStudentId: z.string().uuid(),
  governorate: z.enum(egyptianGovernorates).optional(),
});

export const publicPredictionCreateSchema = z.object({
  year: z.literal(2026),
  seatNumber: z.string().trim().regex(/^[\d٠-٩۰-۹]{4,14}$/),
  branch: z.enum(["science", "mathematics", "literary"]).optional(),
  governorate: z.enum(egyptianGovernorates).optional(),
});

export const accountUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: egyptianPhoneSchema,
});

export const paymentCreateSchema = z.object({
  predictionId: z.string().uuid(),
  year: z.literal(2026).optional(),
  seatNumber: z.string().trim().regex(/^[\d٠-٩۰-۹]{4,14}$/).optional(),
  method: z.enum(["vodafone_cash", "orange_cash", "instapay"]),
  senderIdentifier: z.string().trim().max(80).optional(),
  transactionReference: z.string().trim().max(120).optional(),
  idempotencyKey: z.string().uuid(),
});

export const paymentReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(3).max(500),
  }),
]);
