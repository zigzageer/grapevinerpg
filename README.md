# Adventures of Mint

**Live game:** https://adventures-of-mint.vercel.app

A small, playable 2D cutout browser demo starring Mint and the whole cast. **Choose any character and move around Grapevine.** This version has no story, quests, combat, or dialogue flow.

## Play the demo

The generated `artifacts/adventures-of-mint.html` is a standalone browser game: download it and open it in Chrome, Edge, Firefox, or Safari. All character artwork, code, and fonts are embedded. No server, account, API key, or internet connection is needed to play.

To build that file again:

```sh
npm ci
npm run bundle:demo
```

For the regular development website, use Node 22.12+ or 24:

```sh
npm run dev
```

Open the address Vite prints (port 5173). Vercel uses `npm run build` and serves `dist/`, as configured in `vercel.json`. No environment variables are required. The production site is deployed at https://adventures-of-mint.vercel.app.

## Controls

- Choose a character in the sidebar, or click them in town to take control.
- WASD or arrow keys to walk; hold Shift to run.
- Click/tap the ground to walk there, with pathfinding around obstacles.
- `[` and `]` to switch characters without changing your position.
- C opens the character workshop; H opens controls; Escape closes dialogs.
- On phones, use tap-to-walk or the direction pad. The camera follows you.
- “Back to center” returns the active character to the town center.

The selected character, position, custom cast and names save in this browser. Saves are local to the current file or website origin. Export a crew backup from the workshop before clearing site data or changing domains.

## Cast

All 14 named characters are playable: **Mint, Baguette, Sarina, David, Ghost, Rocky, Miel, Zippy, Jat, Loralei, Samira, Genesis, Kain, and Footjobofsteel**. Genesis’s puppy and leash travel with his sprite. Old untouched placeholder friends are omitted from the demo; customized friends are retained. The workshop supports up to 24 characters.

Loralei uses a fully clothed black fashion outfit with heels, patterned tights and a vintage cap after the image tool blocked the first outfit request. Footjobofsteel uses an original muscular yellow-bear design after the reference-based request was rejected.

## Character workshop

Names and standard cutout traits can be edited. Generated characters use fixed illustrated sprites; upload a transparent PNG/WebP (under 1 MB), or restore a standard cutout to edit individual appearance traits. Export/import the entire crew as JSON.

The workshop also links to [Paper Town Character Creator](https://limittox.github.io/south-park-character-creator/). Upload its transparent PNGs for an exact appearance, or import its crew JSON for names and compatible basic traits. Its source and art are not copied. See [research notes](docs/character-research.md).

## Checks

```sh
npm test          # Movement, pathfinding, import validation and save migrations
npm run build    # Type check and static production build
npm run test:e2e # Build standalone demo; run actual desktop, phone and offline browser tests
```

Browser tests use system Chromium at `/usr/bin/chromium`; elsewhere set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium executable. The offline HTML is generated output and is excluded from Git.

## Main files

- `src/App.tsx`: character selection, free-roam movement, camera and local saving.
- `src/components/Town.tsx`: original town scenery and selectable cast.
- `src/components/Character.tsx`: generated sprite and editable cutout renderer.
- `src/components/CrewEditor.tsx`: names, art, crew import/export, and “Play as” selection.
- `src/game/model.ts`: cast, collisions, save validation and migration. Legacy quest flags are retained in saves for future work but are not part of the demo.
- `src/game/navigation.ts`: pathfinding.
- `scripts/bundle-demo.mjs`: standalone offline HTML packaging.
- `public/characters/`: generated character sprites; originals are retained separately.

The website bundles fonts locally and makes no third-party requests during gameplay. The external character creator is only opened when selected from the workshop.
