import { describe, expect, it } from "vitest";
import { resultSearchSchema } from "@/lib/schemas";

describe("result search contract", () => {
  it("accepts a useful Arabic name fragment", () => {
    const parsed = resultSearchSchema.safeParse({
      year: 2026,
      method: "name",
      query: "محمد أحمد",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts a complete three-letter first name", () => {
    const parsed = resultSearchSchema.safeParse({
      year: 2026,
      method: "name",
      query: "علي",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects name searches shorter than three useful letters", () => {
    const parsed = resultSearchSchema.safeParse({
      year: 2026,
      method: "name",
      query: "مح",
    });

    expect(parsed.success).toBe(false);
  });

  it("keeps Arabic-digit seat lookup supported", () => {
    const parsed = resultSearchSchema.safeParse({
      year: 2026,
      method: "seat",
      query: "٢٠٠١٩٧٦",
    });

    expect(parsed.success).toBe(true);
  });
});
