# Character studio

Open **Characters** and select **+** to create a character. The pencil on a character’s card opens their editor directly. Empty Discord towns show **Add character**. Users can change appearance details, upload a PNG/JPEG/WebP reference up to 2 MB, and regenerate a preview. Choosing **Add to game** or **Use this version** publishes that version to the shared roster.

Enter an idea in **Signature ability** to generate a move name, description, and transparent effect sprite. A move and an appearance can be generated together for one attempt. When editing a saved version, select **Keep this version’s appearance** to generate only its move. The preview shows the ability and its PP cost. The published version uses the generated move as its signature in duels. Generated moves use one of three combat styles with fixed game rules, and their artwork is stored with the version.

Each IP gets **three lifetime generation attempts across all towns**. Accepted attempts include adding, editing, and regenerating. The server reserves the attempt atomically before queueing work. Identical request retries return the existing job. Failed accepted attempts count toward the limit because generation may have consumed usage. IP addresses are normalized and stored as keyed hashes with a persistent database salt. Device storage has no role in enforcing the allowance.

**Show character history** contains every successful generation, including unused previews. The original character is included and its artwork is backed up when the first new generation begins. Choosing an older version restores its appearance and signature move. Restoring a saved version is free. The current version and prior generations survive service restarts. Interrupted in-progress jobs report failure while preserving existing characters and completed versions.

## Runtime

The React site calls `api/studio.mjs`. This Vercel Function proxies a bounded set of public studio routes over HTTPS to the Ubuntu service. Vercel's short-lived OIDC token authenticates the production team and project. The service validates issuer, audience, subject, project ID, team ID, expiration, and signing keys. The gateway forwards Vercel's platform-provided client IP for quota enforcement.

The Ubuntu service serializes image jobs through the existing Codex CLI and saved ChatGPT login. For server towns, the website reads their published game manifests and merges website character versions into its own stored roster. New roster data becomes available immediately through the API. Generated images and history are stored in SQLite plus immutable PNG files.

The installed service is `mint-character-studio.service`, with application files in `/opt/mint-studio/app` and persistent data in `/var/lib/mint-studio`. The website service has its own systemd unit and configuration. Its internal diagnostic credential stays on Ubuntu. Codex child processes receive the existing filtered environment.

Vercel production settings include `MINT_STUDIO_ORIGIN` and `MINT_STUDIO_CA`, which contains the public TLS CA certificate. Enable project OIDC with the team issuer. Backend defaults identify the Adventures of Mint project. `MINT_STUDIO_VERCEL_TEAM_SLUG`, `MINT_STUDIO_VERCEL_TEAM_ID`, `MINT_STUDIO_VERCEL_PROJECT_NAME`, and `MINT_STUDIO_VERCEL_PROJECT_ID` support explicitly configured deployments.

Ubuntu settings include `MINT_STUDIO_SECRET`, `MINT_STUDIO_DATA_DIR`, `MINT_STUDIO_SEED_PATH`, `MINT_STUDIO_TLS_KEY`, and `MINT_STUDIO_TLS_CERT`. The service runs Node 22.13+ or 24 and needs `sharp` and `jose`. Generate an initial cast seed with `node scripts/seed-studio.mjs`. Existing data takes precedence over the initial seed.

When deploying a cast update, regenerate the configured seed and restart the studio service with the updated application. Startup adds missing built-in characters and preserves existing versions, jobs, and quotas. The Mint studio supports 40 characters. Discord server towns support 24.

For a consistent filesystem backup, stop the studio service while it is idle, copy `/var/lib/mint-studio`, then restart the service. Keep the SQLite database and `images` directory together. Preserve `/etc/mint-studio` for TLS and internal connection configuration. The quota salt is stored in the database.

Root-game browser customizations merge with newly published shared versions. Local workshop edits survive refreshes after the same shared version has been applied. The downloadable standalone game continues using its embedded cast and local workshop.

## Validation

```sh
npm run build
npm test
npm run test:bot
npm run test:studio
npm run test:e2e
```

Studio tests cover persistent quotas, concurrent requests, idempotent retries, uploads, generation failure, original backups, previews, version restoration, published-roster imports, bridge authentication, and production-project identity. Browser tests cover adding a reference-based character, editing Miel, exhausting three attempts, restoring history, and adding characters to empty towns in portrait and landscape layouts.

The implementation follows Vercel's [backend OIDC guide](https://vercel.com/docs/oidc/api) and [trusted client-IP headers](https://vercel.com/docs/headers/request-headers).
