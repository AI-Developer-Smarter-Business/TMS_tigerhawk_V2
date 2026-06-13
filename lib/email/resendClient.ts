// lib/email/resendClient.ts
// Shared Resend client + bounded retries for transient API failures (no in-app queue).

import { Resend } from "resend"

let _resend: Resend | null = null

export const DEFAULT_FROM = "TigerHawk TMS <noreply@tigerhawklogistics.com>"

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key || key === "your_resend_key_here") {
      throw new Error(
        `RESEND_API_KEY is not configured (value: ${key === undefined ? "undefined" : key === "" ? "empty" : "placeholder"}). Set it in the deployment environment and redeploy.`
      )
    }
    _resend = new Resend(key)
  }
  return _resend
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resendFailureIsRetryable(error: { message?: string } | null | undefined): boolean {
  if (!error) return false
  const msg = (error.message || "").toLowerCase()
  return (
    msg.includes("rate") ||
    msg.includes("429") ||
    msg.includes("too many") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("504")
  )
}

const MAX_SEND_ATTEMPTS = 3

/**
 * Send one message via Resend with short backoff on likely-transient errors.
 * Does not replace a real queue; avoids immediate failure on rate limits / blips.
 */
export async function sendResendEmailWithRetry(
  payload: Parameters<Resend["emails"]["send"]>[0]
): Promise<Awaited<ReturnType<Resend["emails"]["send"]>>> {
  let last: Awaited<ReturnType<Resend["emails"]["send"]>> | undefined
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    last = await getResend().emails.send(payload)
    if (!last.error) return last
    if (!resendFailureIsRetryable(last.error) || attempt === MAX_SEND_ATTEMPTS) {
      return last
    }
    await delay(400 * attempt)
  }
  return last!
}
