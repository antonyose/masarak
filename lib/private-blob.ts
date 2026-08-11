import "server-only";

import { randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const receiptMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

function requireToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Private receipt storage is not configured.");
  return token;
}

export function detectReceiptMime(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg" as const;
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png" as const;
  }
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp" as const;
  }
  return null;
}

export function validateReceipt(bytes: Uint8Array, declaredType: string) {
  if (!bytes.length || bytes.length > MAX_RECEIPT_BYTES) {
    throw new Error("RECEIPT_SIZE");
  }
  const detected = detectReceiptMime(bytes);
  if (!detected || detected !== declaredType) {
    throw new Error("RECEIPT_TYPE");
  }
  return detected;
}

export async function uploadPrivateReceipt(
  bytes: Uint8Array,
  contentType: (typeof receiptMimeTypes)[number],
) {
  const extension =
    contentType === "image/jpeg" ? "jpg" : contentType === "image/png" ? "png" : "webp";
  const pathname = `receipts/${randomUUID()}.${extension}`;
  const blob = await put(pathname, Buffer.from(bytes), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType,
    token: requireToken(),
  });
  return blob.pathname;
}

export async function deletePrivateReceipt(pathname: string) {
  await del(pathname, { token: requireToken() });
}

export async function getPrivateReceipt(pathname: string) {
  return get(pathname, {
    access: "private",
    token: requireToken(),
    useCache: false,
  });
}
