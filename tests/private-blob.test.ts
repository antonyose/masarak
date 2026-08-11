import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({ del: vi.fn(), get: vi.fn(), put: vi.fn() }));

import { MAX_RECEIPT_BYTES, detectReceiptMime, validateReceipt } from "@/lib/private-blob";

describe("private receipt validation", () => {
  it("recognizes allowed image signatures rather than trusting the extension", () => {
    expect(detectReceiptMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectReceiptMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(detectReceiptMime(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  });

  it("rejects MIME mismatch and files over 5MB", () => {
    expect(() => validateReceipt(new Uint8Array([0xff, 0xd8, 0xff]), "image/png")).toThrow("RECEIPT_TYPE");
    expect(() => validateReceipt(new Uint8Array(MAX_RECEIPT_BYTES + 1), "image/jpeg")).toThrow("RECEIPT_SIZE");
  });
});
