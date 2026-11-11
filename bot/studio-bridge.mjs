import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import https from "node:https";

export const MAX_BODY = 3_500_000;
export function canonicalIp(input) {
  const value = String(input || "").trim();
  if (isIP(value) === 4) return value;
  if (isIP(value) !== 6) throw new Error("A valid client IP is required.");
  const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  if (normalized.startsWith("::ffff:")) {
    const parts = normalized.slice(7).split(":");
    if (parts.length === 2) {
      const number = parseInt(parts[0], 16) * 65536 + parseInt(parts[1], 16);
      return [24, 16, 8, 0].map((shift) => (number >>> shift) & 255).join(".");
    }
  }
  return normalized;
}

export function signature({ secret, method, path, ip, timestamp, body }) {
  return createHmac("sha256", secret)
    .update([method, path, ip, timestamp].join("\n") + "\n")
    .update(body)
    .digest("hex");
}

export function verifyBridge({
  secret,
  method,
  path,
  headers,
  body,
  time = Date.now(),
}) {
  const ip = canonicalIp(headers["x-mint-ip"]);
  const timestamp = headers["x-mint-time"];
  const received = String(headers["x-mint-signature"] || "");
  if (
    !/^\d{13}$/.test(timestamp || "") ||
    Math.abs(time - Number(timestamp)) > 60_000 ||
    !/^[a-f0-9]{64}$/.test(received)
  )
    return null;
  const expected = signature({ secret, method, path, ip, timestamp, body });
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected))
    ? ip
    : null;
}

export function bridgeRequest({
  origin,
  secret,
  token,
  ca,
  method = "GET",
  path,
  ip,
  body = Buffer.alloc(0),
  timeoutMs = 20_000,
}) {
  const timestamp = String(Date.now());
  const headers = {
    "content-type": "application/json",
    "content-length": body.length,
    "x-mint-ip": canonicalIp(ip),
    ...(token
      ? { authorization: `Bearer ${token}` }
      : {
          "x-mint-time": timestamp,
          "x-mint-signature": signature({
            secret,
            method,
            path,
            ip: canonicalIp(ip),
            timestamp,
            body,
          }),
        }),
  };
  return new Promise((resolve, reject) => {
    const url = new URL(path, origin);
    if (url.protocol !== "https:" || url.origin !== new URL(origin).origin)
      throw new Error("Invalid studio origin.");
    const request = https.request(
      url,
      { method, headers, ca, timeout: timeoutMs },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_BODY) {
            response.destroy(new Error("Studio response is too large."));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            type: response.headers["content-type"],
            bytes: Buffer.concat(chunks),
          }),
        );
      },
    );
    request.on("timeout", () =>
      request.destroy(new Error("Studio request timed out.")),
    );
    request.on("error", reject);
    request.end(body);
  });
}
