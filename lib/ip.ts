import crypto from "crypto";

/**
 * We never store raw IPs (see privacy policy) — only a one-way hash, used
 * to group requests for rate limiting / abuse detection.
 *
 * Plain sha256(ip) would NOT be safe here: the whole IPv4 space is only
 * ~4 billion values, so an attacker with access to the `downloads` table
 * could brute-force every possible IP into a rainbow table in seconds
 * and de-anonymize every row. HMAC-ing with a server-only secret makes
 * that brute-force infeasible, since the secret isn't guessable.
 */
export function hashIp(ip: string) {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret) {
    throw new Error("IP_HASH_SECRET is not configured");
  }
  return crypto.createHmac("sha256", secret).update(ip).digest("hex");
}

export function getClientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
