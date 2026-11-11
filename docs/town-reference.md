# South Park town scenery

The user's requested [Fandom Buildings category](https://southpark.fandom.com/wiki/Category:Buildings) denied automated access, including its public API. The official South Park wiki supplied accessible public references instead. No access restrictions were bypassed.

## Visual references

The [official List of Locations](https://southpark.cc.com/wiki/List_of_Locations) links the following reference images. All nine were downloaded and visually inspected during development on November 11, 2026.

| Location                   | Official reference image                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| South Park Elementary      | [school.jpg](https://images.paramount.tech/path/mgid:file:gsp:entertainment-assets:/sps/shared/locations/school.jpg)                         |
| City Wok                   | [city-wok.jpg](https://images.paramount.tech/path/mgid:file:gsp:entertainment-assets:/sps/shared/locations/city-wok.jpg)                     |
| Tweek Bros. Coffee         | [tweek-bros.jpg](https://images.paramount.tech/path/mgid:file:gsp:entertainment-assets:/sps/shared/locations/tweek-bros.jpg)                 |
| Tom’s Rhinoplasty          | [toms-rhinoplasty.jpg](https://images.paramount.tech/path/mgid:file:gsp:entertainment-assets:/sps/shared/locations/toms-rhinoplasty.jpg)     |
| Park County Police Station | [park-county-police.jpg](https://images.paramount.tech/path/mgid:file:gsp:entertainment-assets:/sps/shared/locations/park-county-police.jpg) |
| Cartman Residence          | [cartman-house.jpg](https://images.paramount.tech/path/mgid:file:gsp:entertainment-assets:/sps/shared/locations/cartman-house.jpg)           |
| Marsh Residence            | [marsh-house.jpg](https://images.paramount.tech/path/mgid:file:gsp:entertainment-assets:/sps/shared/locations/marsh-house.jpg)               |
| Broflovski Residence       | [broflovski-house.jpg](https://images.paramount.tech/path/mgid:file:gsp:entertainment-assets:/sps/shared/locations/broflovski-house.jpg)     |
| McCormick Residence        | [mccormick-house.jpg](https://images.paramount.tech/path/mgid:file:gsp:entertainment-assets:/sps/shared/locations/mccormick-house.jpg)       |

## Generated assets

ChatGPT image generation used those reference images to redraw front-facing, transparent paper-cutout scenery with blank sign panels. The generated files are committed in `public/scenery/`; reference screenshots are not shipped. The result is a visual adaptation and playable town arrangement, rather than a claim of exact canonical geography or frame-perfect reproduction.

- `downtown.png`: Tweek Bros., City Wok, and Tom’s Rhinoplasty as one scenery strip. Tom’s is shown open rather than boarded up.
- `school.png`: yellow facade, purple snow-capped roof, teal windows, brick wall wings, flag.
- `police.png`: straight-on brick facade, snowy cornice, white blinds, mustard sign.
- `homes.png`: bright green Cartman house, dark green Marsh house, olive Broflovski house, and smaller run-down McCormick house, with garages.

The streets, mountains, snow, pines, directional signs, and bus-stop post are drawn in SVG. Characters, touch input, camera framing, and the optional TV treatment are retained. All assets load locally, with no requests to the reference sites during play. The downloadable demo embeds the scenery along with the cast.

## Renaming later

Edit the `name` and optional `shortName` fields in `src/game/locations.ts`. These names drive the map and live SVG signage. Coffee and police signs include a fixed category subtitle; those subtitles can be changed in `Town.tsx` when rebranding. Renaming text does not require image generation. Location IDs are stable, and footprints and entrance coordinates stay independent of the displayed names.

## Navigation

The 2400 × 2100 town has three connected blocks. The map lists ten entrances and starts ordinary walking, not teleportation. Keyboard or joystick input cancels the route. Full-segment checks avoid building corners, and movement consumes waypoints before turning. An old saved position that falls inside a new building resets to the starting street while preserving the cast and appearance preferences.
