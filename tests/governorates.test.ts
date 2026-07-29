import { describe, expect, it } from "vitest";
import {
  egyptianGovernorates,
  getProximityTier,
} from "@/lib/governorates";

describe("governorate proximity", () => {
  it("contains all 27 Egyptian governorates without duplicates", () => {
    expect(egyptianGovernorates).toHaveLength(27);
    expect(new Set(egyptianGovernorates).size).toBe(27);
  });

  it("distinguishes the same, nearby and other governorates", () => {
    expect(getProximityTier("الإسكندرية", "الإسكندرية")).toBe("same");
    expect(getProximityTier("الإسكندرية", "البحيرة")).toBe("nearby");
    expect(getProximityTier("الإسكندرية", "أسيوط")).toBe("other");
  });
});
