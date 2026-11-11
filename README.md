# Adventures of Mint

**Play:** https://adventures-of-mint.vercel.app

A full-screen 2D browser game starring Mint and the whole cast. Open the game and start walking. The world fills the display; character selection, controls, and editing live in in-game overlays. This free-roam demo has no story or quests yet.

**Discord server games:** the engine also supports a separate empty town and cast for each Discord server. The `/game create` and `/game add` bot modules generate characters from server nicknames, avatars, descriptions, and uploaded references, then commit each roster update for Vercel to publish. See [bot integration and setup](docs/discord-games.md). Bot activation requires connecting these modules to the existing Discord bot and configuring its host credentials.

The engine is custom **React + TypeScript + SVG**, with a frame-based movement loop, collision checks, A\* pathfinding, and a character-follow camera. It does not use Phaser, Unity, or a third-party game engine.

The snowy town now uses AI-generated facades based on official South Park visual references: **Tweek Bros. Coffee, City Wok, Tom’s Rhinoplasty, South Park Elementary, Park County Police Station, and the Cartman, Marsh, Broflovski, and McCormick houses**, plus the bus stop. Downtown, the school/civic block, and the neighborhood connect through walkable streets. This is a playable arrangement of recognizable locations, not an exact canonical street map. See [reference and artwork notes](docs/town-reference.md).

Open the **map button** or press **M**, then choose a destination to walk there. Movement controls immediately cancel the automatic route. Building names and house labels are defined in `src/game/locations.ts`; they are rendered separately from the images so they can be renamed later.

## Play on iPhone

The game supports portrait and landscape, safe areas, a virtual thumbstick, and two-finger hold-to-run controls. Drag the thumbstick to move, or tap the ground to walk. Tap **Characters** to switch to anyone.

For a Safari-bar-free screen: open the live site in Safari → **Share → Add to Home Screen**, then launch it from its Mint icon. The site includes a standalone web app manifest, Apple Home Screen metadata, and appropriately sized icons. An ordinary Safari tab fills the available browser viewport; Home Screen mode removes the browser bars.

## Controls

- WASD / arrow keys: walk. Hold Shift to run.
- Mouse/touch: click or tap the ground to walk around obstacles.
- Phone: drag the thumbstick; hold RUN with the other thumb to move faster.
- Characters button, player portrait, or C: open the cast picker. Choosing someone immediately resumes play.
- `[` and `]`: previous / next character.
- Pause menu or Escape: pause, adjust zoom, toggle the TV look, reset position, or open the workshop.
- H: controls. Escape closes an overlay.
- M or the map button: town map and walking destinations.

The camera follows the active character, with framing adapted to desktop, phone portrait, and phone landscape. Large movement updates use short collision steps so dropped frames do not cause slow movement or skip obstacles.

The **TV episode look** is on by default: color grading, paper grain, fine broadcast lines, and soft edge shading affect the world while HUD controls remain sharp. Toggle it in Pause. The look preference, selected character, position, cast, and names save in this browser.

## Cast & workshop

All 14 named characters are playable: **Mint, Baguette, Sarina, David, Ghost, Rocky, Miel, Zippy, Jat, Loralei, Samira, Genesis, Kain, and Footjobofsteel**. Genesis’s puppy and leash move with his sprite. Customized friends are retained from older saves; the workshop supports up to 24 characters.

Open **Pause → Character workshop** or the workshop button in the picker to edit names, upload transparent PNG/WebP sprites (under 1 MB), or export/import the crew. Restore a standard cutout to edit individual appearance traits. Generated character sprites have a fixed appearance.

The workshop links to [Paper Town Character Creator](https://limittox.github.io/south-park-character-creator/). Upload its transparent PNGs for the exact generated appearance, or import its crew JSON for names and compatible basic traits. Its source and art are not copied. See [research notes](docs/character-research.md).

## Develop & deploy

Use Node 22.12+ or 24:

```sh
npm ci
npm run dev
npm run build
```

Vite uses port 5173. Vercel builds with `npm run build` and serves `dist/`, as configured in `vercel.json`. No environment variables are required for the game.

```sh
npm test          # Movement, camera, imports, and save migrations
npm run test:e2e # Build offline demo; run Chromium desktop and mobile tests
```

Chromium tests use `/usr/bin/chromium`; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for another location. To include Safari-engine iPhone portrait/landscape tests on a machine with WebKit dependencies:

```sh
npx playwright install --with-deps webkit
MINT_TEST_WEBKIT=1 npm run test:e2e
```

`MINT_WEBKIT_EXECUTABLE` can select a custom WebKit executable. Browser tests exercise viewport coverage, all cast selections, mouse and touch movement, two-finger run input, released controls, rotation, settings, fullscreen menus, editing, saves, and standalone play.

## Downloadable demo

```sh
npm run bundle:demo
```

This creates `artifacts/adventures-of-mint.html`, a standalone file with all game code, art, and fonts embedded. Download it and open it in a browser on a computer. Gameplay needs no network after the document loads. Home Screen installation on iPhone uses the live HTTPS site, not the downloaded file.

Saves are local to the browser and origin. Export a crew backup before clearing site data or changing domains. The generated standalone HTML is excluded from Git.

## Main files

- `src/App.tsx`: full-screen game, HUD, picker, pause menus, movement, and saving.
- `src/game-screen.css`: game layout, safe areas, overlays, and TV treatment.
- `src/components/TouchJoystick.tsx`: captured pointer input and direction controls.
- `src/components/Town.tsx`: snowy town, generated facades, editable signs, and selectable cast.
- `src/components/TownMap.tsx`: in-game town map and walking destinations.
- `src/game/locations.ts`: town dimensions, location names, footprints, and entrances.
- `src/components/Character.tsx`: sprite and editable cutout renderer.
- `src/components/CrewEditor.tsx`: names, art, and import/export.
- `src/game/model.ts`: cast, collisions, save validation and migration. Old quest flags are retained in saves but are not used by the demo.
- `src/game/camera.ts` and `navigation.ts`: responsive character framing and pathfinding.
- `public/manifest.webmanifest` and `public/icons/`: Home Screen support.
- `public/scenery/`: generated downtown, school, police station, and neighborhood art.
- `scripts/bundle-demo.mjs`: offline HTML packaging.

Fonts and artwork are local. Gameplay makes no third-party requests; the external character creator only opens when selected in the workshop.
