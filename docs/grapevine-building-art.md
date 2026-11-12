# Grapevine building artwork

ImageGen made seven transparent sprites for the Grapevine map. The game uses cropped WebP copies under `public/games/00000000000000001/town/`. Each sprite is anchored to its footprint’s street-facing edge, with a small name plaque on the sidewalk.

## References

- The existing downtown facades supplied the cut-paper style. [Downtown game art](../public/scenery/downtown.png)
- The café roof borrows from Googie roadside coffee shops. [Googie and the Architecture of Joy](https://prcno.org/googie-and-the-architecture-of-joy/)
- The Iranian Bazaar uses pointed arches, tile bands, and recessed bays. [Iranian Bazaar architecture](https://en.icro.ir/Architecture/Iranian-Bazaar)
- The Israeli Market uses produce stalls and fabric awnings inspired by Jerusalem’s shuk. [Machane Yehuda Market](https://en.machne.co.il/)
- The arcade takes its cabinet silhouette from early video arcades. [Smithsonian video game history](https://americanhistory.si.edu/collections/object-groups/the-father-of-the-video-game-the-ralph-baer-prototypes-and-electronic-games/video-game-history)

## ImageGen prompts

Each generation used the existing downtown art as its style reference and enabled transparent output.

```text
Use case: stylized-concept. Create ONE original building sprite for a 2D South Park-style paper-cutout neighborhood game. The provided image is a STYLE reference only: match its very flat front-elevation storefronts, simple construction-paper geometry, slightly wobbly dark cut edges, matte flat colors, and two-tone roofs. Do not copy its buildings or its snow. Keep the new building noticeably more distinctive through a strong silhouette and a few large, readable props. Use cel-flat uniform colors and a little faint paper texture; zero photorealism, zero 3D render, no beveled foam, no glossy highlights, no gradients, no realistic shadows. Straight-on orthographic camera, full facade visible with horizontal base and a centered street-facing door. Transparent empty canvas beyond the cutout, no sky or terrain. Keep the entire building inside clean transparent margins. No text, numbers, lettering, characters or watermark.
```

### chud-cafe

```text
A retro Googie coffee shop. Sweeping coral red boomerang roof and oversized steaming coffee mug silhouette, teal trim, round glass corners, two simple orange booths through the windows, checkerboard threshold, one paper bicycle. Warm cherry, pale cream, teal. Silhouette approximately 1.4 times wider than tall.
```

### looksmaxxing-gym

```text
A converted concrete garage gym with blocky asymmetric roof fins and flat charcoal shutters, punchy lime-green trim, a big dumbbell silhouette built into the front lintel, a weight rack and mirror silhouettes through tall blue windows. Distinct plain gray slabs, purple accents. Silhouette about 1.4 times wider than tall.
```

### iranian-bazaar

```text
A Persian bazaar storefront inspired by historic Iranian market architecture. Tall pointed terracotta-brick central arch, shallow cupola behind it, large simple turquoise and cobalt geometric tile bands, two lower arched merchant bays with bold woven rugs and brass lantern silhouettes. Warm terracotta and turquoise. Silhouette about 1.35 times wider than tall.
```

### israeli-market

```text
A Jerusalem produce-market shop inspired by Machane Yehuda. Wide honey limestone front in flat staggered cream blocks, low stepped parapet and broad cobalt and cream striped cloth awnings. Shutters and bakery shelf to either side of the clear central door, bold cut-paper fruit piles and wooden produce bins beneath the awnings. Silhouette about 1.5 times wider than tall.
```

### incel-arcade

```text
A wide low 1980s arcade with a facade shaped like a giant coin-op cabinet. Large pixel lightning icon and flat cyan and pink tube details against black plum panels, boxy dark windows with a few silhouette arcade cabinets, checkerboard panels and a giant red joystick sticking up from one roof corner. Silhouette about twice as wide as tall. Fluorescent elements are flat colored paper, not glowing light bloom.
```

### netanyahu-press-room

```text
A fictional TV press bureau. Low wide stepped limestone facade with blocky pillars, large midnight-blue TV-studio window showing an empty lectern, red stage curtains and two recognizable tripod camera cutouts, two oversized simple satellite dishes on the roof, small red recording lights. Simple blue and sand paper blocks. Silhouette about twice as wide as tall.
```

### clan-hall

```text
A very wide low Grapevine Clan Hall, an old limestone winery and town clubhouse with two uneven wings, purple slate roof, timber pergolas, central round-arched double doors, a large cut-paper purple grape-cluster crest with leaves, green vine silhouettes and flat planter boxes. The whole silhouette is about 2.6 times wider than tall.
```
