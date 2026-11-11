# Character studio

Open **Characters → Add / edit character** or the corresponding pause-menu action. Empty Discord towns show **Add yourself**. Users can create a character, edit an existing character such as Miel, change appearance details, upload a PNG/JPEG/WebP reference up to 2 MB, and regenerate a preview. Choosing **Add to game** or **Use this version** publishes that version to the shared roster.

Each IP gets **three lifetime generation attempts across all towns**. Accepted attempts include adding, editing, and regenerating. The server reserves the attempt atomically before queueing work. Identical request retries return the existing job. Failed accepted attempts count toward the limit because generation may have consumed usage. IP addresses are normalized and stored as keyed hashes with a persistent database salt. Device storage has no role in enforcing the allowance.

**Show character history** contains every successful generation, including unused previews. The original character is included and its artwork is backed up when the first new generation begins. Choosing an older version restores its appearance and details. Restoring a saved version is free. The current version and prior generations survive service restarts. Interrupted in-progress jobs report failure while preserving existing characters and completed versions.

## Runtime

The React site calls `api/studio/[...route].mjs`. This Vercel Function proxies a bounded set of public studio routes over HTTPS to the Ubuntu service. Vercel's short-lived OIDC token authenticates the production team and project. The service validates issuer, audience, subject, project ID, team ID, expiration, and signing keys. The gateway forwards Vercel's platform-provided client IP for quota enforcement.

The Ubuntu service serializes image jobs through the existing Codex CLI and saved ChatGPT login. Discord `/game create` and `/game add` use this service through authenticated internal routes. New roster data becomes available immediately through the API. Generated images and history are stored in SQLite plus immutable PNG files.

The installed service is `mint-character-studio.service`, with application files in `/opt/mint-studio/app` and persistent data in `/var/lib/mint-studio`. The existing Discord bot loads its bridge settings through a systemd environment-file drop-in. The shared internal credential stays on Ubuntu. Codex child processes receive the existing filtered environment.

Vercel production settings include `MINT_STUDIO_ORIGIN` and `MINT_STUDIO_CA`, which contains the public TLS CA certificate. Enable project OIDC with the team issuer. Backend defaults identify the Adventures of Mint project. `MINT_STUDIO_VERCEL_TEAM_SLUG`, `MINT_STUDIO_VERCEL_TEAM_ID`, `MINT_STUDIO_VERCEL_PROJECT_NAME`, and `MINT_STUDIO_VERCEL_PROJECT_ID` support explicitly configured deployments.

Ubuntu settings include `MINT_STUDIO_SECRET`, `MINT_STUDIO_INTERNAL_ORIGIN`, `MINT_STUDIO_CA_PATH`, `MINT_STUDIO_DATA_DIR`, `MINT_STUDIO_SEED_PATH`, `MINT_STUDIO_TLS_KEY`, and `MINT_STUDIO_TLS_CERT`. The service runs Node 22.13+ or 24 and needs `sharp` and `jose`. Generate an initial cast seed with `node scripts/seed-studio.mjs`. Existing data takes precedence over the initial seed.

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

Studio tests cover persistent quotas, concurrent requests, idempotent retries, uploads, generation failure, original backups, previews, version restoration, Discord integration, bridge authentication, and production-project identity. Browser tests cover adding a reference-based character, editing Miel, exhausting three attempts, restoring history, and adding characters to empty towns in portrait and landscape layouts.

The implementation follows Vercel's [backend OIDC guide](https://vercel.com/docs/oidc/api) and [trusted client-IP headers](https://vercel.com/docs/headers/request-headers).
