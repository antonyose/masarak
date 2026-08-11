# Masarak — Tansik 2026 Stage-2 Research Context

> **Frozen research snapshot:** 2026-08-11 (Egypt time)
> **Purpose:** Give Codex the 2026 coordination facts, cutoffs, Stage-2 availability context, source URLs, and prediction-model rules without making Codex perform exploratory web research.
> **Current coordination stage:** Stage 2 is the active product focus. Registration is scheduled for **2026-08-12 through 2026-08-16**.
> **Important:** Stage-2 final faculty cutoffs do **not** exist yet in this snapshot. What exists now is (a) final Stage-1 cutoffs, (b) Stage-2 entry minimums, and (c) the announced Stage-2 vacancy lists.

---

## 0. Instructions to the coding agent

1. **Do not perform exploratory web search for 2026 Tansik facts already contained here.**
2. Treat this file as the frozen research input for the Stage-2 implementation.
3. Prefer local/imported data over hardcoded UI arrays.
4. If a machine-readable refresh is absolutely required, use the exact direct URLs in the Sources section rather than searching the web.
5. Official 2026 Stage-1 facts override predictions.
6. The Stage-2 vacancy flag is a hard eligibility/availability input; the Stage-2 *final cutoff* is still unknown and is what the model is estimating.
7. Preserve the exact Arabic institution label received from the source, then separately map it to a normalized institution/faculty ID.
8. Never treat the student's governorate alone as the official geographic-distribution rule. Exact Tansik geographic eligibility is a separate problem and usually depends on education administration/geographic group.
9. Never invent an exact number of remaining seats for a faculty unless an official exact capacity is available.
10. Never round unusual official scores merely because they do not look like a normal 0.5 increment. Two 2026 values confirmed across multiple reproductions are **طب أسنان بني سويف = 298.7** and **هندسة السويس = 282.2**.

---

# 1. 2026 score systems

## New system

```text
maximum_score = 320
```

All full Stage-1 cutoff tables in this document are for the **2026 new system** unless explicitly stated otherwise.

## Old system

```text
maximum_score = 410
```

Do not compare a raw 410-point historical/old-system score directly with a 320-point new-system score.

At minimum normalize to percentage. Prefer branch-specific rank percentile where trustworthy branch distributions exist.

---

# 2. Stage-1 entry thresholds and cohort sizes

These values are **entry thresholds for Stage 1**, not faculty cutoffs.

## New system

| Branch | Stage-1 entry score | Percentage | Students |
|---|---:|---:|---:|
| Scientific — علوم | 292 / 320 | 91.25% | 23,154 |
| Mathematical — رياضيات | 275.5 / 320 | 86.09% | 16,046 |
| Literary — أدبي | 229 / 320 | 71.56% | 55,567 |
| **Total** | — | — | **94,767** |

## Old system

| Branch | Stage-1 entry score | Percentage | Students |
|---|---:|---:|---:|
| Scientific — علوم | 369 / 410 | 90.00% | 21 |
| Mathematical — رياضيات | 347 / 410 | 84.63% | 7 |
| Literary — أدبي | 270 / 410 | 65.85% | 70 |
| **Total** | — | — | **98** |

### Product implication

A Stage-1 entry threshold such as `292` for Science is **not** the minimum for every faculty. It only determined who entered Stage 1. Each faculty then received its own final cutoff.

---

# 3. Stage-2 timing, minimums, and cohort sizes

Stage 2 is scheduled from:

```text
2026-08-12 → 2026-08-16
```

## New system

| Branch group | Stage-2 entry score | Percentage | Students |
|---|---:|---:|---:|
| Scientific branches | 220 / 320 | 68.75% | 234,866 |
| Literary | 205 / 320 | 64.06% | 31,610 |
| **Total** | — | — | **266,476** |

## Old system

| Branch group | Stage-2 entry score | Percentage | Students |
|---|---:|---:|---:|
| Scientific branches | 280 / 410 | 68.29% | 379 |
| Literary | 240 / 410 | 58.53% | 76 |
| **Total** | — | — | **455** |

### Critical interpretation

`220 / 320` does **not** mean a 220-score student can enter every Stage-2 scientific faculty. It only means that the student is inside the Stage-2 registration cohort. Actual placement still depends on score, preference order, vacancy, branch eligibility, geographic rules and other Tansik constraints.

---

# 4. Stage-1 2026 sector floors — new system

These are useful high-level anchors, but the application should use the exact faculty table whenever available.

| Sector | Lowest Stage-1 cutoff | Approx. percentage |
|---|---:|---:|
| Medicine | 301 | 94.06% |
| Dentistry | 298.5 | 93.28% |
| Physical Therapy | 295.5 | 92.34% |
| Pharmacy | 294.5 | 92.03% |
| Government Engineering | 276.5 | 86.41% |
| Economics / Political Science (Literary) | 286 | 89.38% |
| Alsun (Literary) | 278.5 | 87.03% |
| Media (Literary) | 275.5 | 86.09% |

### Stage-2 deterministic consequences

- Government Medicine, Dentistry, Physical Therapy and Pharmacy listed in Stage 1 are closed unless an exact Stage-2 vacancy record says otherwise.
- The published Stage-2 vacancy list does **not** reopen the public government Engineering faculties that closed in Stage 1; private/high engineering institutes are a separate category.
- Nearly all government Computer Science / AI options for the Math branch appear in the Stage-2 vacancy list.
- For Science, `حاسبات ومعلومات سوهاج علوم` closed in Stage 1 at `292.5`; many other Computer/AI Science variants appear in Stage 2.

---

# 5. Full Stage-1 scientific-group cutoffs — 2026 new system

The source's “scientific group” list contains medical/science-stream entries and math/engineering entries together. Preserve branch distinctions from the official Tansik record/catalog rather than assigning branch solely from this table.

| Official institution label | Score / 320 | Percentage |
|---|---:|---:|
| طب المنصورة | 309 | 96.56% |
| طب الإسكندرية | 308.5 | 96.41% |
| طب القاهرة | 308 | 96.25% |
| طب الزقازيق | 308 | 96.25% |
| طب دمياط | 307.5 | 96.09% |
| طب طنطا | 307 | 95.94% |
| طب كفر الشيخ | 306.5 | 95.78% |
| طب بنها | 306 | 95.62% |
| طب عين شمس | 305.5 | 95.47% |
| طب بور سعيد | 305 | 95.31% |
| طب المنوفية بشبين الكوم | 305 | 95.31% |
| طب العاصمة بحلوان | 304.5 | 95.16% |
| طب قناة السويس بالإسماعيلية | 304.5 | 95.16% |
| طب السادات | 304.5 | 95.16% |
| طب السويس | 304 | 95.00% |
| طب الفيوم | 304 | 95.00% |
| طب بني سويف | 303.5 | 94.84% |
| طب المنيا | 303 | 94.69% |
| طب سوهاج | 303 | 94.69% |
| طب العريش | 303 | 94.69% |
| طب أسيوط | 302.5 | 94.53% |
| طب قنا | 302 | 94.38% |
| هندسة بترول و تعدين السويس | 302 | 94.38% |
| طب الاقصر | 301.5 | 94.22% |
| طب الوادي الجديد | 301.5 | 94.22% |
| طب أسوان | 301 | 94.06% |
| طب أسنان المنصورة | 300.5 | 93.91% |
| طب أسنان كفر الشيخ | 300 | 93.75% |
| طب أسنان الزقازيق | 300 | 93.75% |
| طب أسنان طنطا | 300 | 93.75% |
| طب أسنان الإسكندرية | 300 | 93.75% |
| طب أسنان القاهرة | 300 | 93.75% |
| طب أسنان عين شمس | 299.5 | 93.59% |
| طب أسنان قناة السويس بالإسماعيلية | 299.5 | 93.59% |
| طب وجراحة الفم والأسنان سوهاج | 299.5 | 93.59% |
| طب أسنان المنوفية | 299.5 | 93.59% |
| طب أسنان السويس | 299 | 93.44% |
| طب أسنان الفيوم | 299 | 93.44% |
| طب أسنان قنا | 299 | 93.44% |
| طب أسنان بني سويف | 298.7 | 93.34% |
| طب أسنان أسيوط | 298.5 | 93.28% |
| طب أسنان المنيا | 298.5 | 93.28% |
| صيدلة المنصورة | 298 | 93.12% |
| صيدلة سوهاج | 297.5 | 92.97% |
| علاج طبيعي كفر الشيخ | 297.5 | 92.97% |
| علاج طبيعي بورسعيد | 297 | 92.81% |
| علاج طبيعي بنها | 297 | 92.81% |
| صيدلة طنطا | 297 | 92.81% |
| صيدلة الزقازيق | 297 | 92.81% |
| صيدلة قناة السويس بالإسماعيلية | 297 | 92.81% |
| صيدلة قنا | 296.5 | 92.66% |
| صيدلة المنوفية | 296.5 | 92.66% |
| صيدلة القاهرة | 296.5 | 92.66% |
| صيدلة دمنهور | 296.5 | 92.66% |
| علاج طبيعي القاهرة | 296.5 | 92.66% |
| صيدلة و تصنيع دوائي كفر الشيخ | 296.5 | 92.66% |
| علاج طبيعي قناة السويس | 296.5 | 92.66% |
| علاج طبيعي قنا | 296 | 92.50% |
| صيدلة الإسكندرية | 296 | 92.50% |
| صيدلة بور سعيد | 296 | 92.50% |
| صيدلة عين شمس | 296 | 92.50% |
| صيدلة أسيوط | 296 | 92.50% |
| علاج طبيعي السويس | 296 | 92.50% |
| صيدلة مدينة السادات | 295.5 | 92.34% |
| صيدلة العاصمة بحلوان | 295.5 | 92.34% |
| صيدلة بني سويف | 295.5 | 92.34% |
| علاج طبيعي بني سويف | 295.5 | 92.34% |
| صيدلة المنيا | 295 | 92.19% |
| صيدلة الفيوم | 295 | 92.19% |
| صيدلة ج الوادي الجديد | 294.5 | 92.03% |
| حاسبات ومعلومات سوهاج علوم | 292.5 | 91.41% |
| هندسة إلكترونية المنوفية بمنوف | 291 | 90.94% |
| هندسة المنصورة | 290.5 | 90.78% |
| هندسة قناة السويس بالإسماعيلية | 290 | 90.62% |
| هندسة القاهرة | 289.5 | 90.47% |
| هندسة عين شمس | 288.5 | 90.16% |
| هندسة دمياط | 287.5 | 89.84% |
| هندسة الزقازيق | 286.5 | 89.53% |
| هندسة بور سعيد | 285 | 89.06% |
| هندسة طنطا | 285 | 89.06% |
| هندسة الإسكندرية | 284.5 | 88.91% |
| هندسة كفر الشيخ | 284 | 88.75% |
| هندسة بنها بشبرا | 284 | 88.75% |
| كلية الهندسة جامعة دمنهور | 283.5 | 88.59% |
| هندسة بنها | 283 | 88.44% |
| هندسة المنوفية بشبين الكوم | 282.5 | 88.28% |
| هندسة العاصمة بحلوان | 282.5 | 88.28% |
| هندسة السويس | 282.2 | 88.19% |
| هندسة العاصمة بالمطرية | 281.5 | 87.97% |
| هندسة الفيوم | 280.5 | 87.66% |
| هندسة بني سويف | 279.5 | 87.34% |
| هندسة المنيا | 278.5 | 87.03% |
| هندسة أسوان | 278 | 86.88% |
| هندسة قنا | 278 | 86.88% |
| هندسة سوهاج | 277.5 | 86.72% |
| هندسة أسيوط | 277.5 | 86.72% |
| هندسة الوادي الجديد | 277 | 86.56% |
| هندسة الطاقة أسوان | 276.5 | 86.41% |

---

# 6. Full Stage-1 literary cutoffs — 2026 new system

| Official institution label | Score / 320 | Percentage |
|---|---:|---:|
| اقتصاد وعلوم سياسية القاهرة | 299 | 93.44% |
| ألسن كفر الشيخ | 299 | 93.44% |
| الدراسات الاقتصادية والعلوم السياسة الإسكندرية | 294 | 91.88% |
| ألسن عين شمس | 292 | 91.25% |
| إعلام القاهرة | 289 | 90.31% |
| ألسن قناة السويس بالإسماعيلية | 288.5 | 90.16% |
| سياسة واقتصاد السويس | 288.5 | 90.16% |
| ألسن الفيوم | 288 | 90.00% |
| إعلام عين شمس | 286 | 89.38% |
| سياسة واقتصاد بني سويف | 286 | 89.38% |
| ألسن الغردقة | 285 | 89.06% |
| ألسن بني سويف | 284 | 88.75% |
| إعلام المنوفية | 282 | 88.12% |
| ألسن المنيا | 282 | 88.12% |
| ألسن سوهاج | 280.5 | 87.66% |
| الاعاقة والتأهيل الزقازيق | 279 | 87.19% |
| ألسن الأقصر | 279 | 87.19% |
| ألسن أسوان | 278.5 | 87.03% |
| إعلام وتكنولوجيا اتصال السويس | 278 | 86.88% |
| إعلام بني سويف | 277.5 | 86.72% |
| إعلام قنا | 275.5 | 86.09% |
| تكنولوجيا الادارة ونظم المعلومات بور سعيد | 273.5 | 85.47% |
| آثار القاهرة | 273 | 85.31% |
| الاعاقة والتأهيل بني سويف | 272.5 | 85.16% |
| آثار عين شمس | 272 | 85.00% |
| آثار الزقازيق بصان الحجر | 271.5 | 84.84% |
| حقوق بور سعيد | 271.5 | 84.84% |
| آثار دمياط | 270.5 | 84.53% |
| آثار الفيوم | 268.5 | 83.91% |
| آثار و لغات مطروح | 264.5 | 82.66% |
| آثار أسوان | 264.5 | 82.66% |
| آثار الأقصر | 262.5 | 82.03% |
| حقوق قنا | 260.5 | 81.41% |
| آداب القاهرة | 259.5 | 81.09% |
| حقوق سوهاج | 259 | 80.94% |
| آثار سوهاج | 259 | 80.94% |
| تربية الزقازيق | 258.5 | 80.78% |
| آداب انتساب موجه القاهرة | 258 | 80.62% |
| فنون جميلة (فنون) الإسكندرية | 257 | 80.31% |
| آثار قنا | 257 | 80.31% |
| حقوق انتساب موجه قنا | 256 | 80.00% |
| تربية الإسكندرية | 256 | 80.00% |
| حقوق انتساب موجه سوهاج | 256 | 80.00% |
| تربية عين شمس | 254.5 | 79.53% |
| تجارة القاهرة | 253 | 79.06% |
| كلية تكنولوجيا العلوم الصحية برج العرب التكنولوجية | 252.5 | 78.91% |
| آداب عين شمس | 252 | 78.75% |
| تربية بور سعيد | 252 | 78.75% |
| فنون جميلة (فنون) المنصورة | 251 | 78.44% |
| تربية المنصورة | 251 | 78.44% |
| تجارة الإسكندرية | 251 | 78.44% |
| تجارة انتساب موجه القاهرة | 251 | 78.44% |
| فنون جميلة (فنون) العاصمة بحلوان | 250.5 | 78.28% |
| تجارة عين شمس | 250.5 | 78.28% |
| آداب انتساب موجه عين شمس | 250 | 78.12% |
| تجارة انتساب موجه الإسكندرية | 249 | 77.81% |
| تجارة انتساب موجه عين شمس | 248.5 | 77.66% |
| تربية بنها | 248.5 | 77.66% |
| آداب الإسكندرية | 248.5 | 77.66% |
| تربية دمنهور | 248 | 77.50% |
| تجارة دمياط | 248 | 77.50% |
| تربية طنطا | 247.5 | 77.34% |
| تجارة و إدارة أعمال العاصمة بحلوان | 247.5 | 77.34% |
| آداب انتساب موجه الإسكندرية | 247 | 77.19% |
| تجارة و إدارة أعمال انتساب موجه العاصمة بحلوان | 246.5 | 77.03% |
| آداب العاصمة بحلوان | 246 | 76.88% |
| آداب انتساب موجه العاصمة بحلوان | 245 | 76.56% |
| تجارة قنا | 244.5 | 76.41% |
| حقوق كفرالشيخ | 243.5 | 76.09% |
| تجارة انتساب موجه دمياط | 243 | 75.94% |
| حقوق أسوان | 243 | 75.94% |
| تربية المنوفية بشبين الكوم | 242.5 | 75.78% |
| تربية قناة السويس بالإسماعيلية | 242 | 75.62% |
| تربية كفر الشيخ | 242 | 75.62% |
| حقوق المنيا | 242 | 75.62% |
| آداب و علوم إنسانية السويس | 241.5 | 75.47% |
| تجارة الزقازيق | 241.5 | 75.47% |
| تجارة بنها | 241.5 | 75.47% |
| حقوق انتساب موجه كفر الشيخ | 241.5 | 75.47% |
| تربية المنيا | 241.5 | 75.47% |
| آداب بنها | 241 | 75.31% |
| تربية العاصمة بحلوان | 241 | 75.31% |
| دار العلوم القاهرة | 241 | 75.31% |
| تجارة دمنهور | 241 | 75.31% |
| دار العلوم انتساب موجه القاهرة | 240.5 | 75.16% |
| تجارة انتساب موجه قنا | 240.5 | 75.16% |
| تجارة انتساب موجه بنها | 240 | 75.00% |
| آداب انتساب موجه بنها | 240 | 75.00% |
| حقوق دمياط | 239.5 | 74.84% |
| تجارة انتساب موجه دمنهور | 239.5 | 74.84% |
| حقوق الفيوم | 238.5 | 74.53% |
| تجارة انتساب موجه الزقازيق | 238 | 74.38% |
| تربية (تعليم ابتدائي) عين شمس | 238 | 74.38% |
| تجارة المنصورة | 237.5 | 74.22% |
| تجارة المنوفية بشبين الكوم | 237 | 74.06% |
| فنون جميلة (فنون) المنيا | 237 | 74.06% |
| آداب بنات عين شمس | 236.5 | 73.91% |
| آداب انتساب موجه بنات عين شمس | 236 | 73.75% |
| تربية (تعليم ابتدائي) الزقازيق | 236 | 73.75% |
| تجارة انتساب موجه المنوفية بشبين الكوم | 236 | 73.75% |
| تربية مطروح | 235.5 | 73.59% |
| تجارة أسوان | 235.5 | 73.59% |
| حقوق انتساب موجه أسوان | 235.5 | 73.59% |
| تربية بنات عين شمس | 235 | 73.44% |
| تربية (تعليم ابتدائي) الإسكندرية | 234.5 | 73.28% |
| تربية السويس | 234.5 | 73.28% |
| تجارة انتساب موجه المنصورة | 234 | 73.12% |
| آداب و علوم إنسانية انتساب موجه السويس | 234 | 73.12% |
| تربية مدينة السادات | 234 | 73.12% |
| تجارة طنطا | 233.5 | 72.97% |
| تربية الفيوم | 233.5 | 72.97% |
| تجارة بني سويف | 233.5 | 72.97% |
| تربية طفولة مبكرة الزقازيق | 233 | 72.81% |
| فنون جميلة (فنون) أسيوط | 233 | 72.81% |
| تربية دمياط | 232.5 | 72.66% |
| تجارة انتساب موجه أسوان | 232.5 | 72.66% |
| تجارة انتساب موجه طنطا | 232 | 72.50% |
| تربية الغردقة | 231.5 | 72.34% |
| تربية (تعليم ابتدائي) العاصمة بحلوان | 231.5 | 72.34% |
| تجارة قناة السويس بالإسماعيلية | 231 | 72.19% |
| تجارة كفر الشيخ | 231 | 72.19% |
| آداب دمنهور | 230.5 | 72.03% |
| تجارة أسيوط | 230 | 71.88% |
| تجارة انتساب موجه كفر الشيخ | 230 | 71.88% |
| آداب المنوفية بشبين الكوم | 230 | 71.88% |
| تجارة انتساب موجه بني سويف | 230 | 71.88% |
| تجارة السويس | 229.5 | 71.72% |
| تربية (تعليم ابتدائي) بنات عين شمس | 229 | 71.56% |
| آداب الفيوم | 229 | 71.56% |
| تربية بني سويف | 229 | 71.56% |
| آداب انتساب موجه دمنهور | 229 | 71.56% |

---

# 7. Stage-2 availability — high-value government/public faculty sets

This section is the normalized **public/government faculty subset** extracted from the announced Stage-2 vacancy lists.
The raw announcements also contain many higher/private institutes and technical institutes. Exact URLs for the full raw lists are included later.

## 7.1 Veterinary Medicine — Stage 2 scientific

All of the following were announced as having Stage-2 vacancies:

- طب بيطري الوادي الجديد
- طب بيطري العريش
- طب بيطري بنها
- طب بيطري مدينة السادات
- طب بيطري الزقازيق
- طب بيطري المنصورة
- طب بيطري قناة السويس بالإسماعيلية
- طب بيطري المنيا
- طب بيطري سوهاج
- طب بيطري أسيوط
- طب بيطري المنوفية
- طب بيطري الإسكندرية
- طب بيطري دمنهور
- طب بيطري القاهرة
- طب بيطري بني سويف
- طب بيطري كفر الشيخ
- طب بيطري قنا
- طب بيطري مطروح
- طب بيطري عين شمس
- طب بيطري أسوان

## 7.2 Nursing — Stage 2 scientific

- تمريض السادات
- تمريض بني سويف
- تمريض بور سعيد
- تمريض سوهاج
- تمريض عين شمس
- تمريض الإسكندرية
- تمريض الزقازيق
- تمريض القاهرة
- تمريض المنيا
- تمريض قناة السويس بالإسماعيلية
- تمريض الوادي الجديد
- تمريض دمنهور
- تمريض كفر الشيخ
- تمريض قنا
- تمريض بنها
- تمريض أسوان
- تمريض الفيوم
- تمريض المنصورة
- تمريض طنطا
- تمريض أسيوط
- تمريض المنوفية بشبين الكوم
- تمريض دمياط
- تمريض العاصمة بحلوان
- تمريض مطروح

## 7.3 Sciences — Science-stream variants / general scientific list

- علوم بنها
- علوم الوادي الجديد
- علوم أسوان
- علوم العريش
- علوم السويس
- علوم المنوفية بشبين الكوم
- علوم العاصمة بحلوان
- علوم كفر الشيخ
- علوم المنصورة
- علوم قناة السويس بالإسماعيلية
- علوم الزقازيق
- علوم أسيوط
- علوم عين شمس
- علوم الإسكندرية
- علوم دمنهور
- علوم سوهاج
- علوم القاهرة
- علوم قنا
- علوم بني سويف
- علوم الفيوم
- علوم المنيا
- علوم دمياط
- علوم بور سعيد
- علوم طنطا
- علوم الاقصر
- علوم السادات
- علوم الغردقة
- علوم بنات عين شمس
- علوم البترول والتعدين مطروح - علوم

## 7.4 Computer Science / Information / AI — Science variants

**Important:** `حاسبات ومعلومات سوهاج علوم` is not in this Stage-2 set because it already appeared in Stage 1 at 292.5.

- حاسبات و ذكاء إصطناعي بنها علوم
- حاسبات ومعلومات عين شمس علوم
- حاسبات ومعلومات كفر الشيخ علوم
- حاسبات ومعلومات المنصورة علوم
- حاسبات ومعلومات أسيوط علوم
- حاسبات ومعلومات المنوفية بشبين الكوم علوم
- حاسبات و ذكاء إصطناعي القاهرة علوم
- حاسبات و ذكاء إصطناعي العاصمة بحلوان علوم
- حاسبات ومعلومات الأقصر علوم
- حاسبات ومعلومات السويس علوم
- حاسبات ومعلومات قناة السويس بالإسماعيلية علوم
- حاسبات ومعلومات الزقازيق علوم
- حاسبات ومعلومات المنيا علوم
- حاسبات ومعلومات الفيوم علوم
- حاسبات و معلومات العريش علوم
- حاسبات ومعلومات قنا علوم
- حاسبات وذكاء اصطناعي مطروح علوم
- حاسبات وذكاء اصطناعي السادات علوم
- حاسبات ومعلومات دمنهور بالنوبارية علوم
- الذكاء الاصطناعى كفر الشيخ علوم
- حاسبات ومعلومات طنطا علوم
- حاسبات و علوم البيانات الإسكندرية علوم
- حاسبات ومعلومات دمياط علوم
- حاسبات ومعلومات بني سويف علوم
- حاسبات و ذكاء إصطناعي الغردقة علوم
- ذكاء إصطناعي المنوفية شبين الكوم علوم

## 7.5 Computer Science / Information / AI — Math variants

- حاسبات وذكاء اصطناعي مطروح رياضة
- حاسبات ومعلومات السويس رياضة
- حاسبات و ذكاء إصطناعي العاصمة بحلوان رياضة
- حاسبات و ذكاء إصطناعي الغردقة رياضة
- حاسبات و ذكاء إصطناعي القاهرة رياضة
- حاسبات ومعلومات الأقصر رياضة
- حاسبات ومعلومات قناة السويس بالإسماعيلية رياضة
- حاسبات ومعلومات الزقازيق رياضة
- حاسبات ومعلومات الفيوم رياضة
- حاسبات ومعلومات أسيوط رياضة
- حاسبات ومعلومات المنوفية بشبين الكوم رياضة
- حاسبات ومعلومات عين شمس رياضة
- حاسبات ومعلومات المنصورة رياضة
- حاسبات ومعلومات كفر الشيخ رياضة
- حاسبات و ذكاء إصطناعي بنها رياضة
- حاسبات ومعلومات قنا رياضة
- حاسبات ومعلومات المنيا رياضة
- حاسبات و علوم البيانات الإسكندرية رياضة
- حاسبات ومعلومات دمياط رياضة
- حاسبات ومعلومات طنطا رياضة
- حاسبات وذكاء اصطناعي السادات رياضة
- ذكاء إصطناعي المنوفية شبين الكوم رياضة
- حاسبات ومعلومات سوهاج رياضة
- حاسبات ومعلومات دمنهور بالنوبارية رياضة
- الذكاء الاصطناعى كفر الشيخ رياضة
- حاسبات و معلومات العريش رياضة
- حاسبات ومعلومات بني سويف رياضة

## 7.6 Sciences — Math variants

- علوم القاهرة رياضة
- علوم المنصورة رياضة
- علوم عين شمس رياضة
- علوم الإسكندرية رياضة
- علوم سوهاج رياضة
- علوم قنا رياضة
- علوم الزقازيق رياضة
- علوم قناة السويس بالإسماعيلية رياضه
- علوم العاصمة بحلوان رياضة
- علوم المنوفية بشبين الكوم رياضه
- علوم بنها رياضة
- علوم الفيوم رياضة
- علوم بني سويف رياضة
- علوم المنيا رياضة
- علوم أسوان رياضة
- علوم أسيوط رياضة
- علوم طنطا رياضة
- علوم دمياط رياضة
- علوم بنات عين شمس رياضة
- علوم دمنهور رياضة
- علوم بور سعيد رياضة
- علوم الوادي الجديد رياضة
- علوم الغردقة رياضة
- علوم الاقصر رياضة
- علوم السادات رياضة
- علوم العريش رياضة
- علوم الارض بني سويف رياضة

## 7.7 Media / Economics / Alsun — Math variants

- إعلام القاهرة رياضة
- إعلام عين شمس رياضة
- إعلام المنوفية رياضة
- إعلام قنا رياضة
- إعلام بني سويف رياضة
- إعلام وتكنولوجيا اتصال السويس رياضة
- اقتصاد و علوم سياسية القاهرة رياضة
- الدراسات الاقتصادية و العلوم السياسة الإسكندرية رياضة
- سياسة واقتصاد السويس رياضة
- سياسة واقتصاد بني سويف رياضة
- ألسن كفر الشيخ رياضة
- ألسن عين شمس رياضة
- ألسن قناة السويس رياضة بالإسماعيلية
- ألسن الغردقة رياضة
- ألسن سوهاج رياضة
- ألسن المنيا رياضة
- ألسن أسوان رياضة
- ألسن الأقصر رياضة
- ألسن بني سويف رياضة
- ألسن الفيوم رياضة

## 7.8 Applied Arts — relevant Math options

These remain subject to any aptitude-test/eligibility rules that apply.

- فنون تطبيقية بني سويف
- فنون تطبيقية بنها
- فنون تطبيقية طنطا
- فنون تطبيقية دمياط
- فنون تطبيقية العاصمة بحلوان
- فنون تطبيقية النوبارية دمنهور

## 7.9 Literary — public/government faculty vacancy subset

This list intentionally excludes the numerous private/higher institutes from the raw announcement and focuses on public/government faculty options used by Masarak's faculty recommendation flow.

- تربية (تعليم ابتدائي) العريش
- تربية رياضية (علوم الرياضة)بنات السويس
- تربية رياضية (علوم الرياضة)بنين السويس
- تربية رياضية (علوم الرياضة)بنين الوادي الجديد
- آداب انتساب موجه قنا
- دار العلوم أسوان
- آداب وعلوم انسانية انتساب موجه قناة السويس بالإسماعيلية
- تربية رياضية (علوم الرياضة)بنين بني سويف
- تربية رياضية (علوم الرياضة)بنين العريش
- حقوق انتساب موجه بنها
- تربية رياضية (علوم الرياضة)بنات أسوان
- تربية نوعية سوهاج
- حقوق انتساب موجه الزقازيق
- خدمة اجتماعية الفيوم
- آداب انتساب موجه أسوان
- تربية رياضية (علوم الرياضة)بنات أسيوط
- تجارة انتساب موجه العريش
- سياحة وفنادق مطروح
- تربية رياضية (علوم الرياضة)بنين أسوان
- تربية شعبة تربية فنية السويس
- تربية رياضية (علوم الرياضة)بنات المنوفية بشبين الكوم
- خدمة اجتماعية أسيوط
- حقوق انتساب موجه أسيوط
- دار العلوم المنيا
- أقتصاد منزلى العريش
- تربية نوعية أسوان
- تربية رياضية (علوم الرياضة)بنات بور سعيد
- تربية رياضية (علوم الرياضة)بنين المنيا
- تربية (طفولة) الغردقة
- تربية (تعليم ابتدائي) الاقصر
- تربية رياضية (علوم الرياضة)بنين مطروح
- تربية (طفولة) العريش
- حقوق انتساب موجه بني سويف
- سياحة وفنادق المنيا
- سياحة وفنادق مدينة السادات
- تربية رياضية (علوم الرياضة)بنات المنيا
- تربية رياضية (علوم الرياضة)بنات الإسكندرية
- تربية نوعية المنصورة بمنية النصر
- حقوق انتساب موجه عين شمس
- تربية رياضية (علوم الرياضة)بنات بنها
- تربية نوعية المنصورة بميت غمر
- تربية نوعية دمنهور بالنوبارية
- حقوق انتساب موجه الإسكندرية
- تجارة انتساب موجه سوهاج
- آداب انتساب موجه بور سعيد
- تربية طفولة مبكرة مطروح
- تربية (تعليم ابتدائي) دمياط
- تربية (طفولة) السويس
- سياحة وفنادق الفيوم
- تربية رياضية (علوم الرياضة)بنين مدينة السادات
- تربية نوعية قنا
- تربية (طفولة) أسوان
- تربية نوعية أسيوط
- تربية رياضية (علوم الرياضة)بنين قناة السويس بالإسماعيلية
- تربية رياضية (علوم الرياضة)بنين الزقازيق
- سياحة وفنادق المنصورة
- سياحه وفنادق الاقصر
- حقوق انتساب موجه طنطا
- تربية رياضية (علوم الرياضة)بنين أسيوط
- سياحة وفنادق بني سويف
- تربية رياضية (علوم الرياضة)بنات العاصمة بحلوان بالجزيرة
- تربية رياضية (علوم الرياضة)بنين كفر الشيخ
- تربية رياضية (علوم الرياضة)بنات كفر الشيخ
- آداب انتساب موجه الفيوم
- تربية موسيقية العاصمة بحلوان
- تربية (تعليم ابتدائي) بور سعيد
- آداب انتساب موجه دمياط
- تربية (تعليم ابتدائي) أسيوط
- تربية (تعليم ابتدائي) الغردقة
- تربية طفولة مبكرة الفيوم
- تربية نوعية دمياط
- تربية رياضية (علوم الرياضة)بنين الفيوم
- تربية (تعليم ابتدائي) السويس
- حقوق انتساب موجه القاهرة
- حقوق انتساب موجه المنصورة
- آداب انتساب موجه الزقازيق
- تربية نوعية كفر الشيخ
- تجارة انتساب موجه مدينة السادات
- تربية (طفولة) قنا
- تربية (طفولة) قناة السويس بالإسماعيلية
- تربية (تعليم ابتدائي) مطروح
- تربية رياضية (علوم الرياضة)بنين قنا
- تربية نوعية بور سعيد
- تربية طفولة مبكرة أسيوط
- آداب الوادي الجديد
- تربية طفولة مبكرة دمنهور
- تربية رياضية (علوم الرياضة)بنين دمياط
- تربية نوعية الإسكندرية
- تربية رياضية (علوم الرياضة)بنين العاصمة بحلوان
- تربية فنية العاصمة بالزمالك
- تربية طفولة مبكرة بور سعيد
- تربية نوعية طنطا
- آداب أسيوط
- تربية (طفولة) دمياط رياض أطفال
- تربية طفولة مبكرة المنوفية
- تربية رياضية (علوم الرياضة)بنات طنطا
- تربية نوعية المنصورة
- تربية نوعية الفيوم
- تربية طفولة مبكرة مدينة السادات
- أقتصاد منزلى العاصمة بحلوان
- تربية (تعليم ابتدائي) بني سويف
- آداب انتساب موجه طنطا
- آداب بور سعيد
- تربية نوعية مطروح
- آداب العريش
- حقوق المنصورة
- تربية (تعليم ابتدائي) الفيوم
- دار العلوم الفيوم
- آداب كفر الشيخ
- سياحة وفنادق قناة السويس بالإسماعيلية
- آداب المنصورة
- تربية (تعليم ابتدائي) المنصورة
- تربية (طفولة) الوادي الجديد
- تربية (طفولة) عين شمس
- تربية (تعليم ابتدائي) مدينة السادات
- تجارة مدينة السادات
- حقوق مدينة السادات
- تربية (طفولة) سوهاج
- تربية (طفولة) العاصمة بحلوان رياض أطفال
- تربية (تعليم ابتدائي) بنها
- حقوق بنها
- تربية رياضية (علوم الرياضة)بنين بنها
- تربية (تعليم ابتدائي) المنوفية
- حقوق المنوفية بشبين الكوم
- تجارة العريش
- تربية نوعية المنوفية بأشمون
- آداب و علوم إنسانية قناة السويس بالإسماعيلية
- تربية نوعية بنها
- تربية (تعليم ابتدائي) قناة السويس بالإسماعيلية
- سياحة وفنادق العاصمة بالمنيل
- حقوق الزقازيق
- تربية نوعية الزقازيق
- آداب الزقازيق
- حقوق أسيوط
- تربية أسيوط
- أقتصاد منزلى المنوفية بشبين الكوم
- تربية أسوان
- آداب طنطا
- تربية (طفولة) طنطا
- تربية رياضية (علوم الرياضة)بنين طنطا
- تربية (تعليم ابتدائي) طنطا
- حقوق طنطا
- آداب أسوان
- تكنولوجيا وتنمية الزقازيق علوم مالية و إدارية
- آداب دمياط
- تجارة بور سعيد
- تربية رياضية (علوم الرياضة)بنين بور سعيد
- تربية طفولة مبكرة المنيا
- حقوق عين شمس
- تربية نوعية عين شمس
- تربية طفولة مبكرة المنصورة
- تربية (تعليم ابتدائي) أسوان
- حقوق الإسكندرية
- تربية العريش
- خدمة اجتماعية العاصمة بحلوان
- تربية رياضية (علوم الرياضة)بنات المنصورة
- تربية الوادي الجديد
- حقوق العاصمة بحلوان
- حقوق انتساب موجه العاصمة بحلوان
- تربية (طفولة) الإسكندرية
- تربية (تعليم ابتدائي) قنا
- حقوق القاهرة
- تربية نوعية القاهرة
- تربية قنا
- آداب قنا
- تربية طفولة مبكرة بني سويف
- تربية رياضية (علوم الرياضة)بنين الإسكندرية
- سياحة وفنادق الإسكندرية
- تربية رياضية (علوم الرياضة)بنين المنصورة
- تربية رياضية (علوم الرياضة)بنين المنوفية بشبين الكوم
- تربية (تعليم ابتدائي) دمنهور
- تربية (تعليم ابتدائي) سوهاج
- تجارة سوهاج
- تربية سوهاج
- آداب سوهاج
- تربية رياضية (علوم الرياضة)بنات دمياط
- آداب انتساب موجه المنوفية بشبين الكوم
- تربية الاقصر
- سياحة وفنادق الغردقة
- تربية رياضية (علوم الرياضة)بنين سوهاج
- آداب انتساب موجه المنصورة
- تجارة انتساب موجه أسيوط
- تجارة انتساب موجه السويس
- تربية (تعليم ابتدائي) المنيا
- تربية نوعية المنيا
- فنون جميلة (فنون) الأقصر
- آداب المنيا
- حقوق بني سويف
- آداب بني سويف
- تربية طفولة مبكرة القاهرة
- تربية طفولة مبكرة الإسكندرية
- تجارة انتساب موجه بور سعيد
- تجارة انتساب موجه قناة السويس بالإسماعيلية
- تربية (تعليم ابتدائي) كفر الشيخ
- تربية (طفولة) كفر الشيخ
- تربية شعبة تربية فنية قناة السويس بالإسماعيلية
- تربية موسيقية قناة السويس بالإسماعيلية
- تربية رياضية (علوم الرياضة)بنات بني سويف
- آداب انتساب موجه بني سويف
- آداب انتساب موجه سوهاج
- آداب انتساب موجه المنيا
- حقوق انتساب موجه المنوفية بشبين الكوم
- تربية رياضية (علوم الرياضة)بنات سوهاج
- تربية فنية المنيا
- تربية رياضية (علوم الرياضة)بنات العريش
- آداب انتساب موجه الوادي الجديد
- خدمة اجتماعية أسوان
- خدمة اجتماعية انتساب موجه أسوان
- خدمة اجتماعية انتساب موجه أسيوط
- تربية رياضية (علوم الرياضة)بنات قنا
- تربية رياضية (علوم الرياضة)بنات قناة السويس بالإسماعيلية
- خدمة اجتماعية تنموية بني سويف
- دار العلوم انتساب موجه أسوان
- حقوق انتساب موجه مدينة السادات
- خدمة اجتماعية تنموية انتساب موجه بني سويف
- خدمة اجتماعية انتساب موجه الفيوم
- خدمة اجتماعية انتساب موجه العاصمة بحلوان
- تربية رياضية (علوم الرياضة)بنات مدينة السادات

---

# 8. What must be treated as a hard fact vs a prediction

Create an explicit state model.

Recommended states:

```ts
type FacultyStageStatus =
  | "officially_closed_stage_1"
  | "available_stage_2"
  | "availability_unknown"
  | "not_eligible_current_stage";
```

## Precedence rules

### Rule A — exact Stage-2 vacancy record has highest current-stage availability authority

Key the match by at least:

```text
year + education_system + branch + normalized_faculty_id
```

Do not match only by a short faculty name.

If the exact branch/institution variant is in the vacancy list:

```text
status = available_stage_2
```

even if another branch variant of the same faculty name had a Stage-1 cutoff.

### Rule B — official Stage-1 cutoff + no exact Stage-2 vacancy

```text
status = officially_closed_stage_1
```

Do **not** describe it as “low chance.”

Example:

```text
طب القاهرة
Stage-1 final cutoff = 308 / 320
Stage-2 vacancy = false
→ unavailable in Stage 2 (deterministic fact)
```

### Rule C — no trusted matching record

```text
status = availability_unknown
```

Do not silently show it as available.

### Rule D — student below Stage-2 minimum

```text
status = not_eligible_current_stage
```

Do not generate normal Stage-2 recommendations.

---

# 9. Branch matching is critical

The scientific vacancy announcement contains explicit variants such as:

```text
حاسبات ومعلومات ... علوم
حاسبات ومعلومات ... رياضة
علوم ... رياضة
إعلام القاهرة رياضة
ألسن ... رياضة
```

Do not collapse these into one branch-neutral faculty row.

Recommended key:

```text
faculty_id
year
education_system
branch
stage
```

Example:

```text
حاسبات ومعلومات سوهاج علوم
```

and:

```text
حاسبات ومعلومات سوهاج رياضة
```

are separate Tansik eligibility/cutoff records even if they map to one physical faculty.

---

# 10. Proposed Stage-2 prediction model

The current Stage-2 prediction should use the strongest information now available:

```text
historical 2023-2025 behavior
+
actual 2026 Stage-1 outcomes
+
official Stage-2 vacancy flag
+
student branch/system
+
historical volatility
=
Stage-2 estimated cutoff range
```

The model must be deterministic and versioned.

## 10.1 Prediction modes

Support:

```ts
type PredictionMode =
  | "rank_percentile"
  | "normalized_percentage";
```

### `rank_percentile`

Preferred only if a trustworthy score distribution exists for:

```text
same year + same system + same branch
```

Use:

```text
rankPercentile =
  studentsWithHigherScore / successfulStudentsInSameBranch
```

Lower percentile = stronger student position.

### `normalized_percentage`

Fallback when branch-specific distribution is unavailable.

```text
normalizedPercentage = score / maxScore * 100
```

Use a lower confidence label when this fallback is used.

### Current 2026 dataset caution

Masarak's 2026 result database is large and has national-rank/index data, but **do not assume it has verified branch data** simply because a national rank exists. Inspect its actual fields/metadata. If branch is absent, do not invent a Science/Math/Literary rank.

---

# 11. Historical baseline

Starting configurable historical weights:

```json
{
  "2025": 0.50,
  "2024": 0.30,
  "2023": 0.20
}
```

These are starting values, not permanent truth.

For each exact normalized faculty/branch variant:

1. Load historical cutoffs for 2023, 2024 and 2025.
2. Convert each to the same metric:
   - preferably historical branch rank percentile;
   - otherwise cutoff percentage.
3. Calculate a weighted historical baseline.
4. Calculate historical trend.
5. Calculate robust volatility.

Prefer robust statistics to simple standard deviation when only a few years exist.

---

# 12. 2026 Stage-1 calibration

Stage 1 gives us actual 2026 outcomes. Use them to update Stage-2 estimates.

For each comparable known Stage-1 faculty:

```text
pre2026_prediction_i = model trained only on historical data
actual_2026_i        = official Stage-1 cutoff
residual_i           = actual_2026_i - pre2026_prediction_i
```

Group comparable records by:

```text
branch + sector
```

Then compute a robust shift:

```text
sector_shift = median(residual_i)
```

or a weighted median if historical quality differs.

Do not use one unusual faculty as the sector shift.

For an available Stage-2 faculty:

```text
stage2_base =
  historical_faculty_estimate
  + sector_shift_2026
  + small trend adjustment
```

Do not use:

```text
2025 cutoff ± a hardcoded constant
```

as the entire model.

---

# 13. Uncertainty interval

A useful initial formulation:

```text
historical_mad =
  median(abs(historical_cutoff - median(historical_cutoffs)))

backtest_error_band =
  selected quantile of absolute backtest residuals

uncertainty =
  max(
    minimum_uncertainty_floor,
    1.4826 * historical_mad,
    backtest_error_band
  )
  + data_quality_penalties
```

Possible penalties:

- only one historical year;
- newly opened faculty;
- uncertain alias match;
- branch distribution missing;
- current-year branch rank missing;
- historical rules changed;
- exact vacancy source uncertain.

Do not expose a fake precision such as:

```text
87.43% chance of admission
```

until the probability model has actually been calibrated.

---

# 14. Recommendation classifications

For percentage-mode, define:

```text
margin = student_percentage - predicted_cutoff_percentage
```

A reasonable first classification:

```text
SAFE:
margin >= uncertainty

TARGET:
-0.35 * uncertainty <= margin < uncertainty

REACH:
-1.0 * uncertainty <= margin < -0.35 * uncertainty

UNLIKELY:
margin < -1.0 * uncertainty
```

Names in Arabic:

```text
safe      → فرصة مرتفعة
target    → فرصة مناسبة
reach     → اختيار طموح
unlikely  → فرصة ضعيفة
```

These thresholds should be tuned through backtesting.

For rank-percentile mode, reverse the direction because a lower rank percentile is better.

---

# 15. Backtesting requirement

Before activating the Stage-2 model:

## Test 1

```text
Train/calibrate with 2023 + 2024
→ predict 2025
→ compare against actual 2025
```

## Test 2

Use the normal historical model to predict known Stage-1 2026 institutions, then compare to the actual Stage-1 values above.

Record at minimum:

```text
MAE in percentage points
median absolute error
prediction-range coverage
error by branch
error by faculty sector
number of exact matches / alias failures
```

Store metrics with:

```text
model_version
```

Do not activate a new model merely because it “looks better.”

---

# 16. Score-scale rules across years

Never compare raw scores directly across incompatible totals.

For example:

```text
2024: 370 / 410
2026: 288 / 320
```

At minimum:

```text
percentage_2024 = 370 / 410 * 100
percentage_2026 = 288 / 320 * 100
```

Better:

```text
branch rank percentile
```

when distributions support it.

A historical cutoff table should store both:

```text
minimum_score
maximum_score
minimum_percentage
```

---

# 17. Geographic distribution

Do not equate:

```text
student_governorate
```

with:

```text
official_tansik_geographic_group
```

The product may use governorate for:

- sorting nearby campuses;
- UX personalization;
- travel-distance preference.

But do not hard-filter official Tansik geographic eligibility unless the correct education-administration / A-B-C geographic rules are implemented.

Recommended fields:

```text
education_administration
geographic_group
geographic_eligibility_status
```

Possible status:

```text
verified
estimated
unknown
```

If only governorate is known:

```text
geographic_eligibility_status = unknown
```

---

# 18. Aptitude-test faculties

Vacancy does not cancel an aptitude-test requirement.

Examples/categories that may require special handling include Fine Arts / Applied Arts / Sports Sciences and any other faculties governed by current-year aptitude rules.

Store:

```text
requires_aptitude_test
aptitude_test_passed
```

and never show a student as fully eligible solely because the faculty is in the vacancy list.

---

# 19. Faculty vs internal department

National Tansik usually admits the student to a faculty/program record, not necessarily to an internal department.

Do not say:

```text
You are guaranteed Computer Science inside Faculty of Science.
```

if the user is only eligible for:

```text
كلية العلوم
```

Internal department placement may follow university/faculty rules later.

---

# 20. Data model recommended for 2026 coordination

Use normalized database data rather than large hardcoded arrays.

## `coordination_cycles`

```text
id
year
current_stage
registration_opens_at
registration_closes_at
active_model_version
```

## `coordination_stage_rules`

```text
year
stage
education_system
branch
minimum_score
maximum_score
minimum_percentage
student_count
source_id
```

## `official_cutoffs`

```text
id
year
stage
education_system
branch
faculty_id
official_name_ar
minimum_score
maximum_score
minimum_percentage
source_id
```

## `stage_vacancies`

```text
id
year
stage
education_system
branch
faculty_id
official_name_ar
is_available
source_id
```

## `faculty_stage_status`

This can be materialized or calculated:

```text
year
stage
education_system
branch
faculty_id
status
reason
official_cutoff
```

## `coordination_sources`

```text
id
source_tier
publisher
url
published_at
retrieved_at
content_hash
notes
```

## `model_versions`

```text
id
name
mode
configuration_json
calibration_metrics_json
backtest_metrics_json
created_at
active
```

---

# 21. Source tiers

Use:

```text
A = Ministry of Higher Education / official Tansik
B = major press reproducing the Ministry/Tansik tables directly
C = other press / aggregator
```

Rules:

1. Tier A wins when values conflict.
2. Tier B can be used as a frozen mirror when the official page is difficult to parse.
3. Tier C should not override A/B.
4. Store the source URL with imported records.
5. Never silently “fix” an unusual official value by rounding.

---

# 22. Direct source URLs — no exploratory search required

## 2026 official / primary

```text
Scientific Stage-1 official Tansik table
https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2026.htm

Literary Stage-1 official Tansik table
https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2026.htm

Ministry Stage-1 results announcement
https://www.facebook.com/MOHESREGYPT/posts/1593893738760121/

Ministry Stage-1 cutoffs announcement
https://www.facebook.com/MOHESREGYPT/posts/1593849848764510/

Ministry Stage-2 timing announcement
https://www.facebook.com/MOHESREGYPT/photos/1593909715425190/
```

## 2026 frozen mirrors used to build this document

```text
Stage-1 scientific/new-system full list
https://www.youm7.com/amp/2026/8/10/نتيجة-تنسيق-المرحلة-الأولى-الحدود-الدنيا-بالشعبة-العلمية-بالنظام-الحديث/7509309

Stage-1 literary/new-system full list
https://www.youm7.com/story/2026/8/10/نتيجة-تنسيق-المرحلة-الأولى-الحدود-الدنيا-بالشعبة-الأدبية-بالنظام-الحديث/7509297

Stage-2 scientific vacancy list (includes government faculties + many institutes)
https://www.youm7.com/story/2026/8/11/تنسيق-المرحلة-الثانية-القائمة-الكامل-للكليات-والمعاهد-الشاغرة-أمام-الطلاب/7510195

Stage-2 literary vacancy list (includes government faculties + many institutes)
https://www.youm7.com/story/2026/8/10/الأماكن-الشاغرة-بتنسيق-المرحلة-الثانية-للثانوية-العامة-بالشعبة-الأدبية/7509321

Stage-2 old/new-system minimums and cohort sizes mirror
https://www.almasryalyoum.com/news/details/4334936
```

## Historical official cutoff URLs

No search is needed; use these direct sources only if the repo does not already contain the historical cutoff data.

```text
2025 scientific:
https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2025.htm

2025 literary:
https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2025.htm

2024 scientific:
https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2024.htm

2024 literary:
https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2024.htm

2023 scientific:
https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitE2023.htm

2023 literary:
https://tansik.digital.gov.eg/Application/Certificates/Thanwy/Limits/LimitA2023.htm
```

---

# 23. Important implementation consequences for the current Masarak Stage-2 release

## Must happen

- Stage-1 official cutoffs become immutable/current-year facts.
- Current Stage-2 vacancy data must be imported/matched before predictions are displayed.
- Free/public output may state that a faculty closed in Stage 1 and at what score.
- The predictor should estimate only the cutoff/competitiveness of faculties that remain available to that exact branch/system.
- Stage-2 minimum score is an entry gate, not a predicted faculty cutoff.
- Prediction records must carry `stage=2` and a `model_version`.
- Old saved Stage-2 predictions must not silently turn into Stage-3 reports later.
- When Stage 2 results are released, those final Stage-2 cutoffs become hard facts exactly as Stage-1 cutoffs did.

## Must not happen

- Do not keep suggesting Stage-1-closed Medicine/Engineering/etc as “reach” choices.
- Do not interpret the 220 scientific Stage-2 minimum as a faculty cutoff.
- Do not make every faculty in a governorate eligible just because the student lives there.
- Do not use a national overall rank as if it were a verified branch rank.
- Do not compare 410-point and 320-point raw scores.
- Do not manufacture exact seat counts.
- Do not let an LLM calculate admission thresholds.

---

# 24. Recommended Stage-2 UI explanation

For an officially closed faculty:

```text
غير متاحة في المرحلة الثانية
أغلقت رسميًا في المرحلة الأولى عند 308 درجة.
```

For a Stage-2 available predicted faculty:

```text
متاحة في المرحلة الثانية
الحد النهائي لم يُعلن بعد — التوقع مبني على بيانات السنوات السابقة
ونتيجة المرحلة الأولى 2026.
```

For a student below the Stage-2 minimum:

```text
مجموعك أقل من الحد الأدنى المعلن للمرحلة الثانية حاليًا.
هنحدّث الخيارات بعد إعلان بيانات المرحلة الثالثة.
```

Global prediction disclaimer:

```text
التوقعات المعروضة تحليل إحصائي وليست نتيجة تنسيق رسمية أو ضمانًا للقبول.
المرجع النهائي هو موقع التنسيق الإلكتروني ووزارة التعليم العالي.
```

---

# 25. Future Stage-3 transition contract

When Stage-2 results are released:

1. Fetch/import the final Stage-2 cutoffs from the known official Tansik source.
2. Validate exact names and scores.
3. Convert known Stage-2 results from predictions to hard facts.
4. Import the official Stage-3 vacancy list.
5. Update Stage-3 entry rules.
6. Recompute current availability states.
7. Recalibrate only still-open faculties.
8. Create a **new model version**.
9. Preserve all old Stage-2 prediction snapshots.
10. Backtest the Stage-2 predictions against actual Stage-2 outcomes.
11. Use those residuals to improve Stage-3 uncertainty bands.
12. Update product messaging from Stage 2 to Stage 3.
13. Do not overwrite the frozen Stage-2 research snapshot.

---

# 26. Research snapshot limitations

This file intentionally freezes the public information available on **2026-08-11**.

It does **not** claim:

- final Stage-2 faculty cutoffs;
- exact remaining seat counts per faculty;
- exact geographic eligibility for an individual student without the required geographic inputs;
- exact admission probability percentages.

The correct current product is therefore:

```text
official facts where already known
+
official vacancy eligibility
+
well-calibrated statistical prediction for what is still unknown
```

---

# 27. Quick data counts in this snapshot

```text
Stage-1 new-system scientific-group cutoff records: 98
Stage-1 new-system literary cutoff records: 131
Stage-2 veterinary public vacancies listed: 20
Stage-2 nursing public vacancies listed: 24
Stage-2 Science-faculty public vacancies listed: 29
Stage-2 CS/AI Science variants listed: 26
Stage-2 CS/AI Math variants listed: 27
Stage-2 Math Science-faculty variants listed: 27
Stage-2 Literary public-faculty subset entries listed: 218
```

---

**End of frozen Tansik 2026 Stage-2 research context.**
