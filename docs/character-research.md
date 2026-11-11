# Character creator research

Researched on November 11, 2026 before starting the RPG.

## Best fit: Paper Town Character Creator

- Source: https://github.com/limittox/south-park-character-creator
- Live creator: https://limittox.github.io/south-park-character-creator/
- Inspected revision: `1a765d4b4546425979b30e20e9b5dfd2deb1ad5d`
- React / TypeScript / Vite; construction-paper South Park–style characters, detailed SVG parts, crew exports, and transparent PNG stickers.
- A matching interactive character creator was found via GitHub repository search for `south park character creator`.
- No LICENSE file or explicit source reuse grant was found in the inspected repository. The RPG therefore links to the creator instead of copying its implementation or assets.

## Integration in Adventures of Mint

The workshop opens the existing generator in a new tab. Export a transparent PNG from that generator and upload it as the selected friend's sprite to retain the exact generated appearance.

The JSON importer accepts `{ "app": "paper-town-creator", "version": 1, "crew": [...] }` as well as this game's own exports. It independently validates public JSON fields and maps names, skin, hair color, top/bottom colors, glasses, and supported hair/hat choices to our original renderer. Unsupported catalog choices use the selected default, so JSON alone is a **basic trait import**, not a full visual renderer for the generator's catalog. It never executes imported code or fetches imported URLs.

## Other search results

A second GitHub search for `southpark avatar` returned `chendatony31/CSS3-SouthPark` (a single Cartman avatar) and `joaoeduardogomes/JavaScript-SouthPark-TicTacToe` (a tic-tac-toe game). Neither is a comparable customizable generator.

## Mint

The user then named the game **Adventures of Mint** and supplied a round peppermint mascot reference. Mint's isolated transparent sprite was produced using ChatGPT image generation from that reference, with large cutout-style eyes, twisted wrappers, small hands and shoes. The original output was retained separately, and a copy is used at `public/characters/mint.png`. Friend 01 and Friend 02 are original temporary SVG characters, pending the user's directions for the real cast.

## Added cast members

- **Baguette**: white man with a strong square jaw, short-sided black hair with a longer swept top, charcoal jacket, and a baguette in hand. AI-generated transparent sprite at `public/characters/baguette-guy.png`.
- **Sarina**: based on the supplied brown-haired avatar with a navy bow, gold bracelets, black skirt, and navy shirt; redesigned with an exaggerated muscular build. Her shirt features a golden lamassu (winged human-headed lion), and she holds the green-white-red Persian lion-and-sun flag. AI-generated transparent sprite at `public/characters/flag-girl.png`.

The illustrated cast members appear in the park and workshop. Local saves upgrade the cast once, preserving custom names and quest progress. The workshop can rename them, replace their art, or switch them to a standard editable cutout. Crew JSON exports preserve their built-in sprite references without embedding image data.

- **David**: Armenian character with a burgundy “grace come baack” shirt (spelling retained as requested), an “i miss grace” arm tattoo, and a blue cap with a white Star of David. AI-generated transparent sprite at `public/characters/david.png`. Existing saves add David once while preserving the rest of the crew and progress.

- **Ghost**: Black British woman in a plum hijab and sage-green long-sleeved top, holding a Bible in one hand and an oval loaf of bread in the other. AI-generated transparent sprite at `public/characters/ghost.png`. Existing saves add her once without resetting the crew or quest progress.

- **Rocky**: Israeli Hasidic man in a black hat and coat, side curls, and an olive IDF vest. AI-generated transparent sprite at `public/characters/rocky.png`.
- **Miel**: adult white woman with long brown hair, exaggerated lip-filler lips, bunny ears, and a stemmed glass of pink rosé. AI-generated transparent sprite at `public/characters/miel.png`.
- **Zippy**: short, stocky, muscular gay man with a colorful floral shirt, rainbow wristband, and the requested “HIV +” and “I HAVE AIDS” arm patches. AI-generated transparent sprite at `public/characters/zippy.png`; rendered shorter than the other illustrated characters.
- **Jat**: dark-brown-skinned Sri Lankan man with a strong jaw, a Sri Lankan flag shirt, and an Asuka coffee mug. AI-generated transparent sprite at `public/characters/jat.png`.

These four join existing saves in cast update 6 without replacing customized cast members or quest state. The crew sidebar scrolls to show the growing roster, and the workshop continues to support names, sprite replacement, and crew import/export.

## Free-roam additions and demo

- **Loralei**: adult brown-haired white woman with makeup, a black vintage peaked cap, glossy black fashion coat, patterned tights and heels. Her initial image request was rejected by the image tool; the final sprite uses a fully clothed fashion outfit.
- **Samira**: brown-skinned Arab woman with dark hair and extremely exaggerated cosmetic filler lips.
- **Genesis**: brown-skinned man with a curly afro and glasses, holding a red leash attached to his little puppy. Both move together as one sprite.
- **Kain**: green Pepe-style frog based on the supplied avatar, wearing gold glasses and a pinstripe three-piece suit.
- **Footjobofsteel**: original muscular golden-yellow bear in a red athletic top and brown shorts. The reference-based image request was rejected; the final original design was generated without that reference.

The current demo replaces the story flow with a character picker and free roaming. All 14 named characters are playable; untouched placeholder friends are omitted, and customized friends are preserved. Character identity and position persist across reloads. Imported and created characters keep unique stable IDs; the workshop supports up to 24 cast members.

The standalone `artifacts/adventures-of-mint.html` embeds the complete game, fonts and art. Validation exercised all characters on desktop, touch controls and camera on phone, workshop editing, save/reload, and standalone gameplay with network disabled after the initial document loaded. Direct `file://` navigation was blocked by this managed Chromium's administrator policy, so the artifact's exact bytes were served as a single document for the network-disabled browser check.

The environment reports desktop support enabled, but neither a desktop JavaScript control tool nor `open_in_codex` is offered here. `cloud-agent-desktop --help` returned “Orbit desktop is unavailable” for environment `ccarenv_b64_Y2NhcmVudl84NmY5ZjFlOTY3NTA4MTkxYWNlMjk3MWRjMDQ0NDkxZQ`. A downloadable standalone game is provided so play does not depend on that preview runtime.

## Full-screen game and TV treatment

The website-style frame has been replaced with an edge-to-edge game viewport, a compact player HUD, a pause menu, and an overlay character picker. The world supports a thumbstick and simultaneous hold-to-run input, viewport resizing and safe areas, and portrait/landscape framing. A web app manifest, Apple metadata, and icons support iPhone Home Screen launch. Safari's browser bars are removed by opening the installed Home Screen web app, rather than by an unsupported native fullscreen call.

A default-on TV treatment applies saturation/contrast, static paper grain, light broadcast lines, and subtle edge shading to the game world. It does not filter the HUD. The switch in Pause persists in local saves.

For this cloud session, WebKit was downloaded from the official Playwright CDN. Missing Debian libraries were extracted into a user-owned directory after verifying the signed Debian release, its package-index checksum, and each package's SHA-256. Dynamic loading of the required libraries was verified. The actual bundled WebKit executable is launched with those library paths because its normal wrapper replaces `LD_LIBRARY_PATH`; no application assertions or TLS verification are disabled.
