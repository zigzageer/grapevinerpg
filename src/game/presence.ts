import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  canStand,
  normalizeCharacter,
  type Character,
  type Point,
  type WalkArea,
} from "./model";
import { studioRequest } from "./studio";

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

function readPlayers(input: unknown, area?: WalkArea): RemotePlayer[] {
  const list = (input as { players?: unknown } | null)?.players;
  if (!Array.isArray(list) || list.length > 63)
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
      typeof p.moving !== "boolean" ||
      !canStand({ x: p.x, y: p.y }, area)
    )
      return false;
    seen.add(p.sessionId);
    return true;
  });
}

export function useTownPresence(
  worldId: string | undefined,
  characterId: string | undefined,
  pose: PlayerPose,
  paused: boolean,
  walkArea?: WalkArea,
): RemotePlayer[] {
  const enabled = Boolean(
    worldId && characterId && globalThis.crypto?.randomUUID,
  );
  const session = useRef<string>(undefined);
  const sequence = useRef(0);
  const wake = useRef<() => void>(undefined);
  const [players, setPlayers] = useState(NO_PLAYERS);
  const latest = useEffectEvent(() => ({
    characterId,
    pose,
    paused,
    walkArea,
  }));

  useEffect(() => {
    setPlayers(NO_PLAYERS);
    if (!enabled || !worldId) return;
    const sessionToken = (session.current ??= crypto.randomUUID());
    let timer: ReturnType<typeof setTimeout>;
    let staleTimer: ReturnType<typeof setTimeout>;
    let pending: AbortController | undefined;
    let disposed = false;
    let lastStart = -Infinity;
    let retryAt = 0;
    let retryDelay = 1_000;
    let hasPeers = false;

    const schedule = (delay: number) => {
      const now = performance.now();
      clearTimeout(timer);
      timer = setTimeout(
        poll,
        Math.max(delay, retryAt - now, lastStart + ACTIVE_INTERVAL - now),
      );
    };
    const nudge = () => {
      if (!pending) schedule(0);
    };
    const reconnect = () => {
      retryAt = 0;
      retryDelay = 1_000;
      nudge();
    };
    const clearPeers = () => {
      hasPeers = false;
      setPlayers(NO_PLAYERS);
    };
    const poll = async () => {
      const current = latest();
      if (disposed || pending || !current.characterId) return;
      lastStart = performance.now();
      const controller = new AbortController();
      pending = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        const snapshot = await studioRequest<unknown>(
          "/presence",
          {
            worldId,
            sessionToken,
            characterId: current.characterId,
            ...current.pose,
            moving: current.pose.moving && !document.hidden && !current.paused,
            seq: ++sequence.current,
          },
          controller.signal,
        );
        if (disposed) return;
        const peers = readPlayers(snapshot, latest().walkArea);
        retryAt = 0;
        retryDelay = 1_000;
        clearTimeout(staleTimer);
        hasPeers = peers.length > 0;
        setPlayers(hasPeers ? peers : NO_PLAYERS);
        if (hasPeers) staleTimer = setTimeout(clearPeers, STALE_AFTER);
      } catch {
        if (disposed) return;
        retryAt = performance.now() + retryDelay;
        retryDelay = Math.min(retryDelay * 2, 8_000);
      } finally {
        clearTimeout(timeout);
        pending = undefined;
        if (!disposed) {
          const state = latest();
          const interval = document.hidden
            ? HIDDEN_INTERVAL
            : !state.paused && (state.pose.moving || hasPeers)
              ? ACTIVE_INTERVAL
              : IDLE_INTERVAL;
          schedule(interval - (performance.now() - lastStart));
        }
      }
    };

    wake.current = nudge;
    document.addEventListener("visibilitychange", nudge);
    window.addEventListener("online", reconnect);
    nudge();
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(staleTimer);
      pending?.abort();
      wake.current = undefined;
      document.removeEventListener("visibilitychange", nudge);
      window.removeEventListener("online", reconnect);
    };
  }, [enabled, worldId]);

  useEffect(() => wake.current?.(), [characterId, pose.moving, paused]);
  return enabled ? players : NO_PLAYERS;
}
