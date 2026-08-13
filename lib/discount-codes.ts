import "server-only";

import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { discountCodes, discountRedemptions } from "@/db/schema";
import { getDatabase } from "@/db/client";
import { getPaymentProduct, type PaymentProductType } from "@/lib/payment-products";
import { getPaymentSettings } from "@/lib/settings";
import { calculateDiscount } from "@/lib/discount-math";

export type DiscountQuote = {
  codeId: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  remainingRedemptions: number;
};

export async function getDiscountQuote(code: string, productType: PaymentProductType): Promise<DiscountQuote | null> {
  const settings = await getPaymentSettings();
  const product = getPaymentProduct(settings, productType);
  if (!product) return null;
  const now = new Date();
  const [record] = await getDatabase()
    .select({
      id: discountCodes.id,
      code: discountCodes.code,
      discountType: discountCodes.discountType,
      discountValue: discountCodes.discountValue,
      maxRedemptions: discountCodes.maxRedemptions,
    })
    .from(discountCodes)
    .where(and(
      eq(discountCodes.code, code.trim().toUpperCase()),
      eq(discountCodes.active, true),
      or(isNull(discountCodes.expiresAt), gt(discountCodes.expiresAt, now)),
    ))
    .limit(1);
  if (!record) return null;
  const [usage] = await getDatabase()
    .select({ count: sql<number>`count(*)::int` })
    .from(discountRedemptions)
    .where(and(eq(discountRedemptions.discountCodeId, record.id), inArray(discountRedemptions.status, ["reserved", "redeemed"])));
  const remaining = record.maxRedemptions - Number(usage?.count ?? 0);
  if (remaining <= 0) return null;
  const calculated = calculateDiscount(Number(product.priceEgp), record.discountType, Number(record.discountValue));
  return {
    codeId: record.id,
    code: record.code,
    discountType: record.discountType,
    discountValue: Number(record.discountValue),
    ...calculated,
    remainingRedemptions: remaining,
  };
}
