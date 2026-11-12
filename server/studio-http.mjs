import http from "node:http";
import https from "node:https";
import { MAX_BODY, verifyBridge, canonicalIp } from "./bridge.mjs";
import { StudioError } from "./studio-store.mjs";

export function createStudioServer({
  service,
  secret,
  tls,
  verifyVercel,
  matches,
  matchBotSecret,
  fightGifs,
}) {
  const handle = async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status, value) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    };
    try {
      const url = new URL(request.url, "https://studio.local");
      const internal = url.pathname.startsWith("/internal/");
      const matchInternal = url.pathname.startsWith("/internal/v1/");
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
        const requestSecret = matchInternal ? matchBotSecret : secret;
        if (requestSecret)
          ip = verifyBridge({
            secret: requestSecret,
            method: request.method,
            path: request.url,
            headers: request.headers,
            body,
          });
      } catch {
        /* Reject malformed authentication headers. */
      }
      if (!ip && verifyVercel && !internal) {
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
      if (matches && matchInternal) {
        const [, , resource, id, member] = parts;
        if (request.method === "GET") {
          if (
            fightGifs &&
            resource === "fights" &&
            member === "gif" &&
            parts.length === 5
          ) {
            const { match } = matches.getAutoFight(id);
            const result = fightGifs.request(match);
            if (result.status === "ready") {
              response.writeHead(200, {
                "Content-Type": "image/gif",
                "Content-Length": result.bytes.length,
              });
              response.end(result.bytes);
            } else if (result.status === "queued") {
              send(202, { status: "queued" });
            } else {
              send(503, {
                error:
                  "The fight GIF is unavailable. Open the replay to see the fight.",
              });
            }
            return;
          }
          if (resource === "fighters" && parts.length === 4) {
            send(200, await matches.listFighters(id));
            return;
          }
          if (resource === "fighters" && parts.length === 5) {
            send(200, await matches.getFighter(id, member));
            return;
          }
          if (
            resource === "leaderboards" &&
            id === "global" &&
            parts.length === 4
          ) {
            send(200, matches.leaderboard());
            return;
          }
          if (
            resource === "leaderboards" &&
            id === "guild" &&
            parts.length === 5
          ) {
            send(200, matches.leaderboard(member));
            return;
          }
        }
        if (
          request.method === "GET" &&
          resource === "links" &&
          parts.length === 5
        ) {
          send(200, matches.getLink(id, member));
          return;
        }
        if (
          resource === "matches" &&
          request.method === "GET" &&
          parts.length === 4
        ) {
          send(200, matches.getMatch(id));
          return;
        }
        if (request.method === "POST") {
          if (resource === "fighters" && parts.length === 3) {
            send(200, await matches.updateFighter(input));
            return;
          }
          if (resource === "fights" && parts.length === 3) {
            send(201, await matches.fight(input));
            return;
          }
          if (resource === "links" && parts.length === 3) {
            send(200, await matches.link(input));
            return;
          }
          if (resource === "matches" && parts.length === 3) {
            send(201, await matches.challenge(input));
            return;
          }
          if (
            resource === "matches" &&
            member === "actions" &&
            parts.length === 5
          ) {
            send(200, await matches.act(id, input));
            return;
          }
        }
      }
      if (request.method === "GET") {
        if (url.pathname === "/health") {
          send(200, { ok: true });
          return;
        }
        if (parts[0] === "games" && parts.length === 2) {
          send(200, await service.loadGame(parts[1]));
          return;
        }
        if (matches && parts[0] === "matches" && parts.length === 2) {
          send(200, matches.getMatch(parts[1]));
          return;
        }
        if (
          parts[0] === "games" &&
          parts[2] === "characters" &&
          parts[4] === "history" &&
          parts.length === 5
        ) {
          send(200, await service.history(parts[1], parts[3]));
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
