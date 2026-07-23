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

/**
 * Trusts `x-forwarded-for` as-is. This is only safe because Vercel's edge
 * network overwrites this header itself and does not forward a
 * client-supplied value through — see
 * https://vercel.com/docs/headers/request-headers. Every rate limit and
 * lockout in this app (parse, download, admin login) is keyed off this
 * value, so if this project is ever self-hosted or put behind another
 * reverse proxy that doesn't strip/overwrite incoming `x-forwarded-for`,
 * this becomes trivially spoofable — an attacker could send a fresh random
 * value per request to bypass every rate limit here. In that setup, only
 * trust an IP header your own proxy sets (e.g. terminate TLS yourself and
 * set your own header downstream), not one a client can send directly.
 */
export function getClientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
