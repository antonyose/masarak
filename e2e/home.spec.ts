import { expect, test } from "@playwright/test";

function testIp(projectName: string, offset: number) {
  const projectNumber = [...projectName].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return `198.51.100.${((projectNumber + offset) % 200) + 1}`;
}

test("homepage supports both primary tools", async (
  { page, request },
  testInfo,
) => {
  const forwardedFor = testIp(testInfo.project.name, 1);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": forwardedFor });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", {
      name: "اعرف نتيجتك وكلياتك الأقرب",
    }),
  ).toBeVisible();
  await expect(page.getByText("السنة الحالية")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "سنة التنسيق" }),
  ).toHaveCount(0);

  await page.getByRole("tab", { name: "اعرف نتيجتك" }).click();
  await expect(page.getByText("نتائج العام الحالي")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "سنة النتيجة" }),
  ).toHaveCount(0);
  const liveProbe = await request.post("/api/result-search", {
    headers: { "x-forwarded-for": forwardedFor },
    data: { year: 2026, method: "name", query: "مارتينا" },
  });
  const liveData = await liveProbe.json();
  if (liveData.dataMode === "live") {
    await page.getByRole("button", { name: "الاسم" }).click();
    await page.getByLabel("اسم الطالب").fill("مارتينا");
  } else {
    await page.getByLabel("رقم الجلوس").fill("123456");
  }
  await page.getByRole("button", { name: "اعرض النتيجة" }).click();
  await expect(page.locator(".student-card").first()).toBeVisible();

  await page.getByRole("tab", { name: "اعرف الكليات المتوقعة" }).click();
  await expect(page.getByLabel("مجموعك")).toHaveValue("288");
  await page.getByRole("button", { name: "اعرض الكليات المتوقعة" }).click();
  await expect(
    page.getByText("ترتيبك التقديري", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("الكليات الأقرب لمجموعك", { exact: true }),
  ).toBeVisible();
});

test("partial Arabic name search returns and narrows multiple live matches", async ({
  page,
  request,
}, testInfo) => {
  const forwardedFor = testIp(testInfo.project.name, 21);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": forwardedFor });
  const liveProbe = await request.post("/api/result-search", {
    headers: { "x-forwarded-for": forwardedFor },
    data: { year: 2026, method: "name", query: "مارتينا" },
  });
  const liveData = await liveProbe.json();
  test.skip(
    liveData.dataMode !== "live",
    "The private 2026 results index is not available in this environment.",
  );
  expect(liveData.results[0].nationalRank).toBeGreaterThan(0);
  expect(liveData.results[0].nationalTotalStudents).toBe(919396);

  await page.goto("/result-search");
  await page.getByRole("button", { name: "الاسم" }).click();
  await page.getByLabel("اسم الطالب").fill("مارتينا");
  await page.getByRole("button", { name: "اعرض النتيجة" }).click();

  await expect(page.getByText("تم العثور على ٣٣٨ نتيجة")).toBeVisible();
  await expect(page.locator(".student-card")).toHaveCount(20);
  await expect(
    page.getByText("ترتيبك الخام على الجمهورية").first(),
  ).toBeVisible();
  await expect(
    page.getByText("نعرض أول ٢٠ نتيجة. أضف جزءًا آخر من الاسم لتضييق البحث."),
  ).toBeVisible();

  await page.getByLabel("اسم الطالب").fill("مارتينا مينا");
  await page.getByRole("button", { name: "اعرض النتيجة" }).click();
  await expect(page.getByText("تم العثور على ٣ نتائج")).toBeVisible();
  await expect(page.locator(".student-card")).toHaveCount(3);
});

test("governorate reorders nearby options and keeps all governorates available", async ({
  page,
}) => {
  await page.goto("/predict");
  await page.getByLabel("محافظتك (اختياري)").selectOption("الإسكندرية");
  await page.getByRole("button", { name: "اعرض الكليات المتوقعة" }).click();

  await expect(page.getByText("محافظتك: الإسكندرية")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "الأقرب لمحافظتي" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("في محافظتك").first()).toBeVisible();

  await page.getByRole("button", { name: "كل المحافظات" }).click();
  await expect(
    page.getByRole("button", { name: "كل المحافظات" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("محافظة أخرى").first()).toBeVisible();
});

test("Sohag science student sees realistic options before distant medicine", async ({
  page,
}) => {
  await page.goto("/predict");
  await page.getByLabel("محافظتك (اختياري)").selectOption("سوهاج");
  await page.getByLabel("مجموعك").fill("289");
  await page.getByRole("button", { name: "اعرض الكليات المتوقعة" }).click();

  const results = page.locator(".results-area");
  await expect(results.getByText("كلية الطب البيطري — جامعة سوهاج")).toBeVisible();
  await expect(results.getByText("كلية التمريض — جامعة سوهاج")).toBeVisible();
  await expect(results.getByText("المعهد الفني الصحي — سوهاج")).toBeVisible();
  await expect(
    results.getByText("كلية الطب — جامعة أسيوط"),
  ).not.toBeVisible();

  await page
    .getByRole("button", { name: /عرض باقي الخيارات/ })
    .click();
  await page
    .getByLabel("اعرض حسب فرصة القبول")
    .selectOption("unlikely");
  await expect(results.getByText("كلية الطب — جامعة أسيوط")).toBeVisible();
});

test("score validation respects the 320 maximum", async ({ page }) => {
  await page.goto("/predict");
  await page.getByLabel("مجموعك").fill("321");
  await page.getByRole("button", { name: "اعرض الكليات المتوقعة" }).click();
  await expect(page.locator(".form-error[role='alert']")).toContainText(
    "0 إلى 320",
  );
});
