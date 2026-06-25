import { createHmac, timingSafeEqual } from "crypto"

/** Optional HMAC-SHA256 verification (`x-samsara-signature: sha256=<hex>`). */
export function verifySamsaraWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.trim()) return false

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const provided = signatureHeader.replace(/^sha256=/i, "").trim()

  if (expected.length !== provided.length) return false

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
  } catch {
    return false
  }
}
