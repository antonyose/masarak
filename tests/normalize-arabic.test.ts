import { describe, expect, it } from "vitest";
import {
  normalizeArabicName,
  normalizeDigits,
  usefulCharacterCount,
} from "@/lib/normalize-arabic";

describe("Arabic normalization", () => {
  it("normalizes hamza, diacritics, tatweel and spaces", () => {
    expect(normalizeArabicName("  مُحَمَّد  أحــمد  ")).toBe("محمد احمد");
  });

  it("normalizes Arabic and Persian digits", () => {
    expect(normalizeDigits("١٢٣-۴۵۶")).toBe("123-456");
  });

  it("does not convert taa marbuta to haa", () => {
    expect(normalizeArabicName("فاطمة")).toBe("فاطمة");
  });

  it("counts only useful name characters", () => {
    expect(usefulCharacterCount("م ح م د")).toBe(4);
  });
});
