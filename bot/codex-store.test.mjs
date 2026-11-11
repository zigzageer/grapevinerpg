import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { createConnectedGameTask, CodexGameStore } from "./codex-store.mjs";
import { gameConfig } from "./config.mjs";

const exec = promisify(execFile);
const GUILD = "123456789012345678",
  USER = "223456789012345678";
const HEAD = "a".repeat(40),
  TREE = "b".repeat(40),
  COMMIT = "c".repeat(40);
const game = () => ({
  version: 1,
  guildId: GUILD,
  name: "Bob's $(false) `false` town",
  slug: `server-${GUILD}`,
  characters: [],
});
const snapshot = (value = game(), head = HEAD) => ({
  status: "snapshot",
  head,
  tree: TREE,
  gameJson: value === null ? null : JSON.stringify(value),
});
const published = (state = "READY") => ({
  status: "published",
  commit: COMMIT,
  deploymentId: "dpl_test",
  deploymentState: state,
});
const raw = (value) => ({
  structuredContent: { content: JSON.stringify(value) },
});
const object = (value) => ({ structuredContent: value });

function scriptRunner(toolsForJob, inspect = () => {}) {
  return (options) => ({
    run: async () => {
      inspect(options);
      const job = JSON.parse(
        await readFile(path.join(options.workdir, "job.json"), "utf8"),
      );
      const script = await readFile(
        path.join(options.workdir, "task.js"),
        "utf8",
      );
      const tools = {
        exec_command: async ({ cmd, workdir }) => {
          const { stdout } = await exec("/bin/sh", ["-c", cmd], {
            cwd: workdir,
            maxBuffer: 400_000,
          });
          return { output: stdout, exit_code: 0 };
        },
        ...toolsForJob(job),
      };
      const AsyncFunction = Object.getPrototypeOf(
        async function () {},
      ).constructor;
      await new AsyncFunction("tools", "text", script)(tools, () => {});
      return { status: "completed" };
    },
  });
}

test("native snapshot uses pinned GitHub reads and the saved Codex login", async () => {
  const calls = [];
  let directory;
  const task = createConnectedGameTask({
    codexEnv: {
      CODEX_ENABLED: "true",
      CODEX_HOME: "/saved/codex",
      OPENAI_API_KEY: "unused",
      CODEX_API_KEY: "unused",
    },
    runnerFactory: scriptRunner(
      () => ({
        mcp__codex_apps__github_fetch: async ({ url }) => {
          calls.push(url);
          return raw(
            url.includes("/git/commits/")
              ? { tree: { sha: TREE } }
              : { object: { sha: HEAD } },
          );
        },
        mcp__codex_apps__github_fetch_file: async ({ ref, path: file }) => {
          assert.equal(ref, HEAD);
          assert.equal(file, `public/games/${GUILD}/game.json`);
          return object({ content: JSON.stringify(game()) });
        },
      }),
      (options) => {
        directory = options.workdir;
        assert.equal(options.env.CODEX_HOME, "/saved/codex");
        assert.equal("OPENAI_API_KEY" in options.env, false);
        assert.equal("CODEX_API_KEY" in options.env, false);
        assert.ok(options.extraArgs.includes("--output-schema"));
      },
    ),
  });
  const result = await task({
    task: "snapshot",
    repository: "zigzageer/grapevinerpg",
    branch: "main",
    manifestPath: `public/games/${GUILD}/game.json`,
  });
  assert.equal(result.status, "snapshot");
  assert.deepEqual(JSON.parse(result.gameJson), game());
  assert.equal(calls.length, 2);
  await assert.rejects(() => access(directory), { code: "ENOENT" });
});

test("only an explicit missing manifest becomes an empty server snapshot", async () => {
  for (const code of ["NOT_FOUND", "UNAUTHORIZED"]) {
    const task = createConnectedGameTask({
      runnerFactory: scriptRunner(() => ({
        mcp__codex_apps__github_fetch: async ({ url }) =>
          raw(
            url.includes("/git/commits/")
              ? { tree: { sha: TREE } }
              : { object: { sha: HEAD } },
          ),
        mcp__codex_apps__github_fetch_file: async () => ({
          isError: true,
          structuredContent: { error_code: code },
        }),
      })),
    });
    const result = await task({
      task: "snapshot",
      repository: "zigzageer/grapevinerpg",
      branch: "main",
      manifestPath: `public/games/${GUILD}/game.json`,
    });
    assert.equal(result.status, code === "NOT_FOUND" ? "snapshot" : "failed");
    assert.equal(result.gameJson, null);
  }
});

test("native publisher uploads exact sprite bytes and commits roster and sprite together", async () => {
  const sprite = Buffer.from(
    Array.from({ length: 140_000 }, (_, index) => index % 256),
  );
  let blob, files, lease;
  const task = createConnectedGameTask({
    runnerFactory: scriptRunner(() => ({
      mcp__codex_apps__github_create_blob: async (args) => {
        blob = args;
        return object({ sha: "sprite-blob" });
      },
      mcp__codex_apps__github_create_tree: async (args) => {
        files = args;
        return object({ sha: TREE });
      },
      mcp__codex_apps__github_create_commit: async (args) => {
        assert.equal(args.parent_sha, HEAD);
        return object({ sha: COMMIT });
      },
      mcp__codex_apps__github_update_ref: async (args) => {
        lease = args;
        return object({});
      },
      mcp__codex_apps__vercel_create_deployment: async (args) => {
        assert.equal(args.requestBody.withLatestCommit, true);
        assert.equal(args.requestBody.target, "production");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                result: { id: "dpl_test", readyState: "READY" },
              }),
            },
          ],
        };
      },
    })),
  });
  const result = await task(
    {
      task: "publish",
      repository: "zigzageer/grapevinerpg",
      branch: "main",
      manifestPath: `public/games/${GUILD}/game.json`,
      game: game(),
      expectedHead: HEAD,
      baseTree: TREE,
      message: "Add character",
      sprite: {
        path: `public/games/${GUILD}/${USER}.png`,
        size: sprite.length,
      },
      vercel: {
        teamId: "team",
        projectId: "project",
        projectName: "mint",
        repositoryId: 1,
      },
    },
    sprite,
  );
  assert.deepEqual(Buffer.from(blob.content, "base64"), sprite);
  assert.equal(files.base_tree_sha, TREE);
  assert.equal(files.tree_elements.length, 2);
  assert.deepEqual(JSON.parse(files.tree_elements[0].content), game());
  assert.equal(files.tree_elements[1].sha, "sprite-blob");
  assert.equal(lease.expected_sha, HEAD);
  assert.equal(lease.force, false);
  assert.equal(result.commit, COMMIT);
  assert.equal(result.deploymentState, "READY");
});

test("a deployment failure preserves the successful commit checkpoint", async () => {
  const task = createConnectedGameTask({
    runnerFactory: scriptRunner(() => ({
      mcp__codex_apps__github_create_tree: async () => object({ sha: TREE }),
      mcp__codex_apps__github_create_commit: async () =>
        object({ sha: COMMIT }),
      mcp__codex_apps__github_update_ref: async () => object({}),
      mcp__codex_apps__vercel_create_deployment: async () => {
        throw new Error("Build service unavailable");
      },
    })),
  });
  const result = await task({
    task: "publish",
    repository: "zigzageer/grapevinerpg",
    branch: "main",
    manifestPath: `public/games/${GUILD}/game.json`,
    game: game(),
    expectedHead: HEAD,
    baseTree: TREE,
  });
  assert.equal(result.status, "published");
  assert.equal(result.commit, COMMIT);
  assert.equal(result.deploymentState, "FAILED");
});

test("native store retries a conflicted ref against the newest roster", async () => {
  let writes = 0,
    reads = 0;
  const store = new CodexGameStore({
    task: async (job) => {
      if (job.task === "snapshot")
        return snapshot({
          ...game(),
          characters: reads++ ? [{ id: "concurrent" }] : [],
        });
      if (++writes === 1) return { status: "conflict" };
      assert.deepEqual(
        job.game.characters.map((c) => c.id),
        ["concurrent", "new"],
      );
      return published();
    },
  });
  const result = await store.update(GUILD, (current) => ({
    ...current,
    characters: [...current.characters, { id: "new" }],
  }));
  assert.equal(result.game.characters.length, 2);
  assert.equal(writes, 2);
});

test("repeating create retries deployment without adding another commit", async () => {
  const calls = [];
  const store = new CodexGameStore({
    task: async (job) => {
      calls.push(job.task);
      return job.task === "snapshot" ? snapshot() : published();
    },
  });
  const result = await store.update(GUILD, (current) => current);
  assert.equal(result.commit, null);
  assert.deepEqual(calls, ["snapshot", "deploy"]);
});

test("a lost result is reconciled before retrying deployment", async () => {
  let reads = 0;
  const next = { ...game(), characters: [{ id: "new" }] };
  const store = new CodexGameStore({
    task: async (job) => {
      if (job.task === "snapshot")
        return snapshot(reads++ ? next : game(), reads > 1 ? COMMIT : HEAD);
      if (job.task === "publish") throw new Error("Worker result lost");
      return { ...published(), commit: null };
    },
  });
  const result = await store.update(GUILD, () => next);
  assert.equal(result.commit, COMMIT);
  assert.equal(result.deployment.state, "READY");
});

test("game configuration uses existing connections without requiring provider or GitHub keys", () => {
  const config = gameConfig({ CODEX_ENABLED: "true" });
  assert.equal(config.repository, "zigzageer/grapevinerpg");
  assert.equal(config.vercel.projectId, "prj_0VQ70aDKzQcB17HfOjJ8UG1U6BL5");
  assert.equal(config.codexEnv.CODEX_ENABLED, "true");
});
