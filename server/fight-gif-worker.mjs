import { parentPort, workerData } from "node:worker_threads";
import { renderFightGif } from "./fight-gif.mjs";

const buffers = (entries) =>
  Object.fromEntries(
    Object.entries(entries).map(([id, bytes]) => [
      id,
      bytes && Buffer.from(bytes),
    ]),
  );

parentPort.postMessage(
  await renderFightGif({
    ...workerData,
    background: workerData.background && Buffer.from(workerData.background),
    sprites: buffers(workerData.sprites),
    effects: buffers(workerData.effects),
  }),
);
