# Server town format v1

The bot publishes a server town as data and optional artwork. The website turns that data into a playable map. Start with the [JSON Schema](../contracts/town-v1.schema.json), [sample town](../examples/server-town/town.json), and [sample game manifest](../examples/server-town/game.json).

## Publishing

1. Use the server name and public channel names as inspiration for the town, street arrangement, and landmark labels. Use the Discord guild ID as a string. Keep channel messages and private channel names out of the published files.
2. Write `public/games/<guildId>/town.json`. Optional PNG or WebP building art goes under `public/games/<guildId>/town/`.
3. Keep the existing v1 `public/games/<guildId>/game.json` fields and set `"town": { "path": "/games/<guildId>/town.json" }`. A newly created game starts with `"characters": []`. Subsequent character jobs merge into the latest game manifest, including its town reference.
4. Validate before publishing and commit the town, art, and game manifest together. Use the existing guild-based game URL.

## Coordinates and artwork

- All coordinates are integer game units, with the origin at the top left. Rectangles use `x`, `y`, `w`, and `h` and must fit inside the world. Roads are walkable scenery. Building rectangles block movement.
- Place spawn points, landmarks, and doors in open space at least 28 units from the map edge. A door sits in front of its own building, with its x coordinate inside the footprint and its y coordinate 12 to 120 units below the bottom edge. Leave room to walk around the building.
- Use unique IDs across buildings and landmarks. Keep the player spawn, each door and landmark, and all character spawn points reachable from one another. Supply up to 24 character spawn points. The sample uses 12 and the renderer reuses them when needed.
- The palette uses six-digit hex colors. Each building kind has a built-in facade. Optional `art` is a same-guild PNG or WebP path such as `/games/<guildId>/town/record-shop.webp`. Keep generated building art free of labels so the game can render them clearly.
- The sample guild ID is a placeholder. Replace it in both files and all asset paths when generating a town for a real server.

Validate the sample locally with `node --experimental-strip-types scripts/validate-town.mjs examples/server-town/town.json`. The validator uses the same bounds, collision, and walking routes as the game. Open `/town-preview` to explore Signal Yard with sample characters.

The game accepts bot metadata such as `botJobs` on the roster manifest and `discordUserId` on characters. Match ownership uses the existing `discord-<userId>` character ID.
