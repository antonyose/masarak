const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}

export function normalizeArabicName(input: string): string {
  return normalizeDigits(input)
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

export function usefulCharacterCount(input: string): number {
  return normalizeArabicName(input).replace(/[^\p{L}\p{N}]/gu, "").length;
}
