import "server-only";

import { getSeatEntitlement } from "@/lib/authz";
import { getPaymentSettings } from "@/lib/settings";
import { normalizeDigits } from "@/lib/normalize-arabic";
import { findResultBySeat } from "@/lib/results-repository";
import type { TursoStudentResult } from "@/lib/turso";

export type PaymentProductType = "single" | "friends_3";

export type PaymentProduct = {
  id: PaymentProductType;
  priceEgp: string;
  seatCount: 1 | 3;
};

export function getPaymentProduct(
  settings: Awaited<ReturnType<typeof getPaymentSettings>>,
  productType: PaymentProductType,
): PaymentProduct | null {
  if (productType === "single") {
    return {
      id: productType,
      priceEgp: settings.singleReportPriceEgp,
      seatCount: 1,
    };
  }
  if (!settings.friends3Enabled) return null;
  return {
    id: productType,
    priceEgp: settings.friends3PriceEgp,
    seatCount: 3,
  };
}

export function normalizePaymentSeats(seatNumbers: string[]) {
  return seatNumbers.map((seatNumber) => normalizeDigits(seatNumber.trim()));
}

export async function validatePaymentSeats({
  year,
  productType,
  seatNumbers,
}: {
  year: number;
  productType: PaymentProductType;
  seatNumbers: string[];
}) {
  const settings = await getPaymentSettings();
  const product = getPaymentProduct(settings, productType);
  if (!product) throw new Error("FRIENDS_PRODUCT_DISABLED");

  const normalizedSeats = normalizePaymentSeats(seatNumbers);
  if (normalizedSeats.length !== product.seatCount) {
    throw new Error("INVALID_PRODUCT_SEAT_COUNT");
  }
  if (new Set(normalizedSeats).size !== normalizedSeats.length) {
    throw new Error("DUPLICATE_PAYMENT_SEATS");
  }

  const [results, entitlements] = await Promise.all([
    Promise.all(normalizedSeats.map((seatNumber) => findResultBySeat(year, seatNumber))),
    Promise.all(normalizedSeats.map((seatNumber) => getSeatEntitlement({ year, seatNumber }))),
  ]);
  const missingSeats = normalizedSeats.filter((_, index) => !results[index]);
  if (missingSeats.length) {
    const error = new Error("PAYMENT_SEAT_NOT_FOUND");
    Object.assign(error, { missingSeats });
    throw error;
  }

  const unlockedSeats = normalizedSeats.filter(
    (_, index) => Boolean(entitlements[index]),
  );

  return {
    settings,
    product,
    seatNumbers: normalizedSeats,
    results: results as TursoStudentResult[],
    unlockedSeats,
  };
}
