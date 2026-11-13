import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { normalizeCharacter, type Character, type Point } from "./model";
import { StudioRequestError, studioRequest } from "./studio";

export type PlayerPose = Point & { facing: -1 | 1; moving: boolean };
export type RemotePlayer = PlayerPose & {
  sessionId: string;
  characterId: string;
};

const CHARACTER_ID = /^[A-Za-z0-9_-]{1,80}$/;
const ACTIVE_INTERVAL = 350;
const IDLE_INTERVAL = 1_500;
const HIDDEN_INTERVAL = 4_000;
const REQUEST_TIMEOUT = 4_000;
const STALE_AFTER = 5_000;
const NO_PLAYERS: RemotePlayer[] = [];

export function publicMintRoster(characters: Character[]): Character[] {
  return characters
    .filter((c) => c && typeof c.id === "string" && CHARACTER_ID.test(c.id))
    .map((entry) => {
      const c = normalizeCharacter(entry);
      return c.sprite?.startsWith("data:") ? { ...c, sprite: undefined } : c;
    });
}

function readPlayers(input: unknown): RemotePlayer[] {
  const list = (input as { players?: unknown } | null)?.players;
  if (!Array.isArray(list) || list.length > 64)
    throw new Error("Invalid town presence snapshot.");
  const seen = new Set<string>();
  return list.filter((entry): entry is RemotePlayer => {
    const p = entry as Partial<RemotePlayer> | null;
    if (
      !p ||
      typeof p.sessionId !== "string" ||
      !/^[a-f0-9]{32}$/.test(p.sessionId) ||
      seen.has(p.sessionId) ||
      typeof p.characterId !== "string" ||
      !CHARACTER_ID.test(p.characterId) ||
      typeof p.x !== "number" ||
      typeof p.y !== "number" ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      (p.facing !== -1 && p.facing !== 1) ||
      typeof p.moving !== "boolean"
    )
      return false;
    seen.add(p.sessionId);
    return true;
  });
}

type Connection = "connecting" | "online" | "offline" | "local" | "unavailable";
type ClaimResult = "accepted" | "taken" | "offline" | "unavailable";
type PresenceUpdate =
  | { action: "watch" | "release" }
  | (PlayerPose & { characterId: string });
type PresenceSnapshot = {
  accepted: boolean;
  reason?: "taken" | "stale";
  players: RemotePlayer[];
  duels?: unknown;
};
type TownSession = {
  claim: (characterId: string) => Promise<ClaimResult>;
  release: () => void;
  wake: () => void;
  applyDuels: (snapshot: unknown) => void;
  credentials: () =>
    | {
        worldId: string;
        sessionToken: string;
        characterId: string;
      }
    | undefined;
};

function unavailableEndpoint(error: unknown) {
  return (
    error instanceof StudioRequestError && [404, 405].includes(error.status)
  );
}

export function useTownPresence(
  worldId: string | undefined,
  pose: PlayerPose,
  paused: boolean,
  onClaimLost: (characterId: string) => void,
) {
  const session = useRef<TownSession>(undefined);
  const [claimedCharacterId, setClaim] = useState<string>();
  const [players, setPlayers] = useState(NO_PLAYERS);
  const [duelSnapshot, setDuelSnapshot] = useState<unknown>();
  const [connection, setConnection] = useState<Connection>("connecting");
  const latest = useEffectEvent(() => ({ pose, paused }));
  const loseClaim = useEffectEvent(onClaimLost);

  useEffect(() => {
    setClaim(undefined);
    setPlayers(NO_PLAYERS);
    setDuelSnapshot(undefined);
    if (!worldId || !globalThis.crypto?.randomUUID) {
      setConnection("offline");
      return;
    }

    const sessionToken = crypto.randomUUID();
    let seq = 0;
    let claimedId: string | undefined;
    let disposed = false;
    let leaving = false;
    let claiming = false;
    let hasConnected = false;
    let needsRelease = false;
    let pageEpoch = 0;
    let duelRevision = 0;
    let status: Connection = navigator.onLine ? "connecting" : "offline";
    setConnection(status);
    let request: AbortController | undefined;
    let queue: Promise<unknown> = Promise.resolve();
    let timer: ReturnType<typeof setTimeout>;
    let staleTimer: ReturnType<typeof setTimeout>;
    let retryDelay = 1_000;
    let retryAt = 0;
    let lastPoll = -Infinity;

    const updateConnection = (next: Connection) => {
      status = next;
      setConnection(next);
    };
    const clearPeers = () => {
      setPlayers(NO_PLAYERS);
      setDuelSnapshot(undefined);
    };
    const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
      const result = queue.then(task);
      queue = result.catch(() => undefined);
      return result;
    };
    const send = async (
      update: PresenceUpdate,
    ): Promise<PresenceSnapshot | undefined> => {
      if (disposed || leaving) return;
      const epoch = pageEpoch;
      const revision = duelRevision;
      if ("characterId" in update) needsRelease = true;
      const controller = new AbortController();
      request = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        const raw = await studioRequest<PresenceSnapshot>(
          "/presence",
          { ...update, worldId, sessionToken, seq: ++seq },
          controller.signal,
        );
        if (disposed || epoch !== pageEpoch) return;
        if (typeof raw.accepted !== "boolean")
          throw new Error("Invalid town presence snapshot.");
        const peers = readPlayers(raw);
        if ("action" in update && update.action === "release" && raw.accepted)
          needsRelease = false;
        hasConnected = true;
        updateConnection("online");
        retryAt = 0;
        retryDelay = 1_000;
        setPlayers(peers.length ? peers : NO_PLAYERS);
        if (revision === duelRevision) setDuelSnapshot(raw.duels);
        clearTimeout(staleTimer);
        staleTimer = setTimeout(clearPeers, STALE_AFTER);
        return { ...raw, players: peers };
      } catch (error) {
        if (disposed || epoch !== pageEpoch) return;
        const watching = "action" in update && update.action === "watch";
        const missingEndpoint =
          unavailableEndpoint(error) && (watching || status === "local");
        updateConnection(
          !navigator.onLine
            ? "offline"
            : !hasConnected && (import.meta.env.DEV || missingEndpoint)
              ? "local"
              : "unavailable",
        );
        retryAt = performance.now() + retryDelay;
        retryDelay = Math.min(retryDelay * 2, 8_000);
      } finally {
        clearTimeout(timeout);
        request = undefined;
      }
    };
    const makePose = (
      characterId: string,
      stationary = false,
    ): PresenceUpdate => {
      const { pose, paused } = latest();
      return {
        ...pose,
        characterId,
        moving: !stationary && pose.moving && !document.hidden && !paused,
      };
    };
    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (disposed || leaving || claiming) return;
      const now = performance.now();
      timer = setTimeout(
        poll,
        Math.max(delay, retryAt - now, lastPoll + ACTIVE_INTERVAL - now),
      );
    };
    const poll = () =>
      void enqueue(async () => {
        if (disposed || leaving || claiming) return;
        lastPoll = performance.now();
        const characterId = claimedId;
        const snapshot = await send(
          characterId
            ? makePose(characterId)
            : { action: needsRelease ? "release" : "watch" },
        );
        if (characterId && snapshot?.accepted === false) {
          claimedId = undefined;
          setClaim(undefined);
          loseClaim(characterId);
        }
        const { pose, paused } = latest();
        const duel = (
          snapshot?.duels as { own?: { status?: string } } | undefined
        )?.own;
        const busy =
          (duel && duel.status !== "finished") ||
          (!paused && (pose.moving || snapshot?.players.length));
        schedule(
          document.hidden
            ? HIDDEN_INTERVAL
            : busy
              ? ACTIVE_INTERVAL
              : IDLE_INTERVAL,
        );
      });
    const reconnect = () => {
      retryAt = 0;
      retryDelay = 1_000;
      if (status === "offline") updateConnection("connecting");
      schedule(0);
    };
    const releaseOnExit = () => {
      if (!needsRelease) return;
      needsRelease = false;
      void fetch("/api/studio/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release",
          worldId,
          sessionToken,
          seq: ++seq,
        }),
        keepalive: true,
      }).catch(() => {});
    };
    const pageHide = () => {
      leaving = true;
      pageEpoch++;
      clearTimeout(timer);
      clearTimeout(staleTimer);
      request?.abort();
      releaseOnExit();
      claimedId = undefined;
      setClaim(undefined);
      updateConnection(navigator.onLine ? "connecting" : "offline");
      clearPeers();
    };
    const pageShow = () => {
      if (!leaving) return;
      leaving = false;
      reconnect();
    };
    const offline = () => {
      clearTimeout(staleTimer);
      updateConnection("offline");
      clearPeers();
    };

    session.current = {
      claim: async (characterId) => {
        if (claiming) return "unavailable";
        if (claimedId === characterId && status === "online") return "accepted";
        const epoch = pageEpoch;
        claiming = true;
        clearTimeout(timer);
        const snapshot = await enqueue(async () => {
          if (!navigator.onLine) {
            updateConnection("offline");
            return;
          }
          return send(makePose(characterId, true));
        });
        claiming = false;
        if (disposed || leaving || epoch !== pageEpoch) {
          schedule(0);
          return "unavailable";
        }
        if (snapshot?.accepted) {
          claimedId = characterId;
          setClaim(characterId);
        }
        schedule(IDLE_INTERVAL);
        if (!snapshot)
          return status === "offline" || status === "local"
            ? "offline"
            : "unavailable";
        if (snapshot.accepted) return "accepted";
        return snapshot.reason === "taken" ? "taken" : "unavailable";
      },
      release: () => {
        if (!claimedId && !needsRelease) return;
        claimedId = undefined;
        setClaim(undefined);
        void enqueue(async () => {
          await send({ action: "release" });
          schedule(IDLE_INTERVAL);
        });
      },
      wake: () => {
        if (!request) schedule(0);
      },
      applyDuels: (snapshot) => {
        if (disposed || leaving) return;
        duelRevision++;
        setDuelSnapshot(snapshot);
      },
      credentials: () =>
        claimedId && status === "online"
          ? { worldId, sessionToken, characterId: claimedId }
          : undefined,
    };
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("pageshow", pageShow);
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", offline);
    const wake = () => session.current?.wake();
    document.addEventListener("visibilitychange", wake);
    schedule(0);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(staleTimer);
      request?.abort();
      releaseOnExit();
      session.current = undefined;
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", pageShow);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [worldId]);

  useEffect(() => session.current?.wake(), [pose.moving, paused]);
  const claim = useCallback(
    (characterId: string) =>
      session.current?.claim(characterId) ??
      Promise.resolve<ClaimResult>("offline"),
    [],
  );
  const release = useCallback(() => session.current?.release(), []);
  const presenceCredentials = useCallback(
    () => session.current?.credentials(),
    [],
  );
  const refresh = useCallback(() => session.current?.wake(), []);
  const applyDuels = useCallback(
    (snapshot: unknown) => session.current?.applyDuels(snapshot),
    [],
  );
  return {
    players,
    connection,
    claimedCharacterId,
    duelSnapshot,
    claim,
    release,
    refresh,
    applyDuels,
    presenceCredentials,
  };
}
