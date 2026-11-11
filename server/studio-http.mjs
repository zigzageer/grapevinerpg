import http from "node:http";
import https from "node:https";
import { MAX_BODY, verifyBridge, canonicalIp } from "./bridge.mjs";
import { StudioError } from "./studio-store.mjs";

export function createStudioServer({ service, secret, tls, verifyVercel }) {
  const handle = async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status, value) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    };
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > MAX_BODY)
          throw new StudioError(
            "Upload a reference image smaller than 2 MB.",
            413,
          );
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      let ip;
      try {
        ip = verifyBridge({
          secret,
          method: request.method,
          path: request.url,
          headers: request.headers,
          body,
        });
      } catch {
        /* Reject malformed authentication headers. */
      }
      if (!ip && verifyVercel && !request.url.startsWith("/internal/")) {
        const authorization = String(request.headers.authorization || "");
        if (
          authorization.startsWith("Bearer ") &&
          (await verifyVercel(authorization.slice(7)))
        ) {
          try {
            ip = canonicalIp(request.headers["x-mint-ip"]);
          } catch {
            /* Reject invalid forwarded IPs. */
          }
        }
      }
      if (!ip) {
        send(401, { error: "Studio request could not be authenticated." });
        return;
      }
      const url = new URL(request.url, "https://studio.local");
      if (url.search) throw new StudioError("Unexpected request parameters.");
      const parts = url.pathname.split("/").filter(Boolean);
      let input = {};
      if (request.method === "POST") {
        try {
          input = JSON.parse(body.toString("utf8"));
        } catch {
          throw new StudioError("The request could not be read.");
        }
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw new StudioError("Invalid studio request.");
      }
      if (request.method === "GET") {
        if (url.pathname === "/health") {
          send(200, { ok: true });
          return;
        }
        if (url.pathname === "/quota") {
          send(200, service.quota(ip));
          return;
        }
        if (parts[0] === "games" && parts.length === 2) {
          send(200, await service.loadGame(parts[1]));
          return;
        }
        if (
          parts[0] === "games" &&
          parts[2] === "characters" &&
          parts[4] === "history" &&
          parts.length === 5
        ) {
          service.game(parts[1]);
          send(200, service.store.history(parts[1], parts[3]));
          return;
        }
        if (parts[0] === "drafts" && parts.length === 2) {
          service.game(parts[1]);
          send(200, service.store.drafts(parts[1], service.ipHash(ip)));
          return;
        }
        if (parts[0] === "jobs" && parts.length === 2) {
          send(200, service.store.job(parts[1], service.ipHash(ip)));
          return;
        }
        if (
          parts[0] === "assets" &&
          parts.length === 2 &&
          parts[1].endsWith(".png")
        ) {
          const bytes = service.store.image(parts[1].slice(0, -4));
          response.writeHead(200, {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          });
          response.end(bytes);
          return;
        }
      }
      if (request.method === "POST") {
        if (url.pathname === "/generations") {
          send(202, await service.enqueue(input, ip));
          return;
        }
        if (
          parts[0] === "games" &&
          parts[2] === "characters" &&
          parts[4] === "apply" &&
          parts.length === 5
        ) {
          service.game(parts[1]);
          send(200, service.store.apply(parts[1], parts[3], input.versionId));
          return;
        }
      }
      send(404, { error: "Studio endpoint not found." });
    } catch (error) {
      if (!response.headersSent)
        send(error instanceof StudioError ? error.status : 500, {
          error:
            error instanceof StudioError
              ? error.message
              : "The character studio is temporarily unavailable. Please try again.",
        });
      else response.end();
    }
  };
  return tls ? https.createServer(tls, handle) : http.createServer(handle);
}
