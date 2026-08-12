import { describe, expect, it } from "vitest";
import {
  buildBehaviorFunnel,
  buildBehaviorInsights,
  buildBehaviorRates,
} from "@/lib/analytics-insights";

describe("admin behavior analytics", () => {
  it("maps legacy aggregate events without pretending they are unique people", () => {
    const funnel = buildBehaviorFunnel([
      { event_name: "page_view", total: 271 },
      { event_name: "search_result", total: 228 },
      { event_name: "pricing_cta_clicked", total: 53 },
      { event_name: "header_offer_clicked", total: 8 },
      { event_name: "report_viewed", total: 2 },
      { event_name: "payment_submitted", total: 7 },
    ], 7, "aggregate");

    expect(funnel.find((step) => step.event_name === "checkout_intent")?.total).toBe(53);
    expect(funnel.find((step) => step.event_name === "report_viewed")?.instrumented).toBe(false);
    expect(buildBehaviorRates(funnel)).toContainEqual(expect.objectContaining({
      key: "checkoutCompletion",
      value: 13.2,
    }));
    expect(buildBehaviorInsights(funnel, "aggregate", 0, 0)[0]?.title)
      .toContain("التفاعلات فقط");
  });

  it("uses distinct-session synthetic checkout intent when session tracking is available", () => {
    const funnel = buildBehaviorFunnel([
      { event_name: "page_view", total: 100 },
      { event_name: "search_result", total: 62 },
      { event_name: "report_viewed", total: 58 },
      { event_name: "offer_viewed", total: 48 },
      { event_name: "checkout_intent", total: 20 },
      { event_name: "receipt_uploaded", total: 9 },
      { event_name: "payment_submitted", total: 8 },
    ], 6, "sessions");

    const rates = buildBehaviorRates(funnel);
    expect(rates.find((rate) => rate.key === "resultReach")?.value).toBe(62);
    expect(rates.find((rate) => rate.key === "offerReach")?.value).toBe(82.8);
    expect(rates.find((rate) => rate.key === "checkoutCompletion")?.value).toBe(40);
    expect(rates.find((rate) => rate.key === "approval")?.value).toBe(75);
  });

  it("never emits fake rates when there is no denominator", () => {
    const funnel = buildBehaviorFunnel([], 0, "aggregate");
    expect(buildBehaviorRates(funnel).every((rate) => rate.value === null)).toBe(true);
    expect(buildBehaviorInsights(funnel, "aggregate", 0, 0)).toHaveLength(1);
  });
});
