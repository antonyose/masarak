export function calculateDiscount(originalAmount: number, type: "percentage" | "fixed", value: number) {
  const raw = type === "percentage" ? originalAmount * value / 100 : value;
  const discountAmount = Math.min(originalAmount, Math.round((raw + Number.EPSILON) * 100) / 100);
  return {
    originalAmount: Number(originalAmount.toFixed(2)),
    discountAmount,
    finalAmount: Math.max(0, Number((originalAmount - discountAmount).toFixed(2))),
  };
}
