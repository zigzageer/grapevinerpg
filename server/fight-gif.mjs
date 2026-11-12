import sharp from "sharp";

const WIDTH = 512;
const HEIGHT = 288;
const GROUND = 236;
const SIDES = [134, 378];
const MAX_EVENTS = 24;
const MAX_ART_BYTES = 10_000_000;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CLEAR = "#00000000";
const CREAM = "#fff4dc";
const INK = "#222c29";
const GOLD = "#ffcc76";
const COLORS = ["#9adead", "#f9b896"];
const SEGMENTS = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const PROFILES = [
  { width: WIDTH, colors: 128, phases: [0, 1, 2, 3] },
  { width: 416, colors: 96, phases: [0, 1, 2, 3] },
  { width: 352, colors: 64, phases: [1, 2, 3] },
  { width: 288, colors: 40, phases: [1, 2] },
];

// Each move advances through anticipation, travel, contact, and recovery.
const MOTION = {
  strike: [-12, 61, 108, 17],
  burst: [-7, 11, 19, 5],
  projectile: [-9, 14, 11, 3],
  rush: [-17, 74, 131, 38],
  heal: [0, 2, 0, 0],
  status: [0, 0, 0, 0],
};

function health(value, max, fallback) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max
    ? value
    : fallback;
}

function timeline(match) {
  const fighters = Array.isArray(match?.sides)
    ? match.sides.map((side) => side?.players?.[0])
    : [];
  if (
    match?.kind !== "duel" ||
    match.mode !== "auto" ||
    match.status !== "finished" ||
    (match.winnerSide !== 0 && match.winnerSide !== 1) ||
    fighters.length !== 2 ||
    fighters.some((fighter) => !fighter?.id) ||
    fighters[0].id === fighters[1].id ||
    !Array.isArray(match.events) ||
    match.events.length === 0 ||
    match.events.length > MAX_EVENTS
  ) {
    throw new RangeError("Expected a finished auto fight with up to 24 events");
  }

  const maxHp = fighters.map(
    (fighter) => health(fighter.startingHp, 999, 100) || 100,
  );
  let hp = maxHp;
  const moves = match.events.map((event) => {
    const actor = fighters.findIndex((fighter) => fighter.id === event.actorId);
    const target = 1 - actor;
    if (actor < 0 || fighters[target].id !== event.targetId) {
      throw new RangeError("Fight event refers to an unknown fighter");
    }
    const before = hp;
    hp = [...before];
    hp[target] = health(event.targetHp, maxHp[target], before[target]);
    hp[actor] = health(event.actorHp, maxHp[actor], before[actor]);
    const ability = event.kind === "ability";
    const status =
      !ability && ["Burning", "Stunned", "Asleep"].includes(event.move)
        ? event.move
        : null;
    const visual = ["burst", "projectile", "rush", "strike"].includes(
      event.visual,
    )
      ? event.visual
      : ability
        ? "burst"
        : "strike";
    const style = status
      ? "status"
      : event.actorHp !== undefined
        ? "heal"
        : visual;
    return {
      actor,
      target,
      before,
      after: hp,
      ability,
      snowball: !ability && event.move === "Snowball",
      style,
      status,
      damage: Math.max(0, before[target] - hp[target]),
      healing: Math.max(0, hp[actor] - before[actor]),
      label: label(event.move, "Strike"),
    };
  });

  return { fighters, maxHp, moves, winner: match.winnerSide };
}

function label(value, fallback) {
  return (
    (typeof value === "string" &&
      value
        .slice(0, 128)
        .toWellFormed()
        .replace(/[\p{Cc}\u202A-\u202E\u2066-\u2069\uFFFE\uFFFF]/gu, " ")
        .replace(/\s+/gu, " ")
        .trim()) ||
    fallback
  );
}

function xml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
  return value.replace(/[&<>]/g, (character) => entities[character]);
}

function fitLabel(value, width, size) {
  const characters = Array.from(SEGMENTS.segment(value), ({ segment }) => {
    const advance = /^[ilItfr1.,'!| ]$/.test(segment)
      ? 0.43
      : /^[MW@#%&]$/.test(segment)
        ? 1
        : /^[\x20-\x7e]$/.test(segment)
          ? 0.73
          : 1.08;
    return { segment, advance };
  });
  const advance = characters.reduce(
    (sum, character) => sum + character.advance,
    0,
  );
  const fontSize = Math.max(
    size - 3,
    Math.min(size, Math.floor(width / advance)),
  );
  if (advance * fontSize <= width) return { value: xml(value), fontSize };
  let space = width / fontSize - 1.1;
  let clipped = "";
  for (const character of characters) {
    space -= character.advance;
    if (space < 0) break;
    clipped += character.segment;
  }
  return { value: xml(`${clipped}…`), fontSize };
}

function stageSvg(width, content) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${(width * HEIGHT) / WIDTH}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${content}</svg>`,
  );
}

function openArt(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_ART_BYTES) return null;
  const png = buffer.subarray(0, 8).equals(PNG_SIGNATURE);
  const webp =
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
  const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (!png && !webp && !jpeg) return null;
  return sharp(buffer, { limitInputPixels: 8_000_000, failOn: "warning" });
}

async function rawLayer(image) {
  const { data, info } = await image
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    input: data,
    raw: { width: info.width, height: info.height, channels: 4 },
  };
}

async function loadArt(buffer, width, height, cutout, flip = false) {
  try {
    let image = openArt(buffer);
    if (!image) return null;
    if (cutout) image = image.trim({ background: CLEAR, threshold: 10 });
    if (flip) image = image.flop();
    const layer = await rawLayer(
      image.resize(width, height, { fit: cutout ? "inside" : "cover" }),
    );
    return layer.input.some((channel, index) => index % 4 === 3 && channel > 15)
      ? layer
      : null;
  } catch {
    return null;
  }
}

const ARENA_FALLBACK = `
  <rect width="512" height="288" fill="#a1bbc0"/>
  <path d="M0 105 71 43 130 91 204 47 269 99 362 43 449 94 512 61V182H0Z" fill="#536f66"/>
  <path d="M0 129 84 84 151 132 234 78 304 126 398 84 512 124V184H0Z" fill="#42605a"/>
  <path d="M0 160 84 147 163 152 244 143 333 153 415 143 512 152V184H0Z" fill="#c8d3c5"/>
  <path d="M0 176 82 173 148 181 235 175 317 180 414 174 512 181V288H0Z" fill="#36363c"/>
  <path d="M9 207h69m84 0h69m84 0h69m84 0h37" stroke="#bfb083" stroke-width="2" opacity=".34"/>
`;

async function arena(source, width, height) {
  const background =
    (await loadArt(source, width, height, false)) ??
    (await rawLayer(sharp(stageSvg(width, ARENA_FALLBACK))));
  return rawLayer(
    sharp(background.input, { raw: background.raw })
      .flatten({ background: "#343a3e" })
      .composite([
        {
          input: stageSvg(
            width,
            `<defs><linearGradient id="shade" x2="0" y2="1">
               <stop stop-color="#101b1b" stop-opacity=".16"/>
               <stop offset=".57" stop-color="#101b1b" stop-opacity=".1"/>
               <stop offset="1" stop-color="#101b1b" stop-opacity=".58"/>
             </linearGradient></defs>
             <rect width="512" height="288" fill="url(#shade)"/>`,
          ),
        },
      ]),
  );
}

async function silhouette(side, scale) {
  return rawLayer(
    sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(103 * scale)}" height="${Math.round(127 * scale)}" viewBox="0 0 103 127">
          <path d="M23 116q13-9 29 0 16-9 29 0l3 8H20Z" fill="#282e34"/>
          <path d="M25 110q-8-27 14-36h27q20 11 13 36l-5 8H29Z" fill="${side ? "#ac776e" : "#6a8e79"}" stroke="#242d32" stroke-width="3"/>
          <path d="M8 44Q7 4 50 2q41 0 44 39 2 38-41 42Q12 83 8 44Z" fill="${side ? "#7d555c" : "#456654"}" stroke="#242d32" stroke-width="3"/>
          <ellipse cx="52" cy="46" rx="31" ry="27" fill="${side ? "#cfab9a" : "#b8c8ae"}"/>
          <path d="M36 43h10m12 0h10" stroke="#26312e" stroke-width="3" stroke-linecap="round"/>
        </svg>`,
      ),
    ),
  );
}

async function fallen(sprite, side, scale) {
  const rotated = await rawLayer(
    sharp(sprite.input, { raw: sprite.raw }).rotate(side ? 84 : -84, {
      background: CLEAR,
    }),
  );
  return rawLayer(
    sharp(rotated.input, { raw: rotated.raw })
      .resize(Math.round(167 * scale), Math.round(103 * scale), {
        fit: "inside",
        withoutEnlargement: true,
      })
      .modulate({ brightness: 0.86, saturation: 0.72 }),
  );
}

function center(layer, x, y, scale) {
  return {
    ...layer,
    left: Math.round(x * scale - layer.raw.width / 2),
    top: Math.round(y * scale - layer.raw.height / 2),
  };
}

function captions(fight, frame, hp, names) {
  const move = frame.move;
  const winner = frame.winner;
  const panels = names.map((name, side) => {
    const x = side ? 282 : 14;
    const color = hp[side] ? COLORS[side] : "#d9a0a0";
    const active = side === (winner ?? move?.actor);
    const fill = Math.round((hp[side] / fight.maxHp[side]) * 194);
    return `
      <rect x="${x}" y="14" width="216" height="44" rx="9" fill="${INK}" fill-opacity=".96"
        stroke="${active ? color : "#69796e"}" stroke-width="${active ? 2 : 1.2}"/>
      <text x="${x + 11}" y="34" font-size="${name.fontSize}" font-weight="700" fill="${CREAM}">${name.value}</text>
      <text x="${x + 205}" y="34" text-anchor="end" font-size="12" font-weight="700" fill="${color}">${hp[side]} HP</text>
      <rect x="${x + 11}" y="43" width="194" height="7" rx="3.5" fill="#5a645d"/>
      ${fill > 0 ? `<rect x="${x + 11}" y="43" width="${fill}" height="7" rx="3.5" fill="${color}"/>` : ""}`;
  });
  const caption = frame.caption;
  const accent =
    winner !== undefined ? GOLD : move ? COLORS[move.actor] : "#c6d5c7";
  const boxWidth = winner !== undefined ? 304 : move ? 236 : 88;
  return `<g font-family="DejaVu Sans, Arial, sans-serif">
    ${panels.join("")}
    <circle cx="256" cy="36" r="15.5" fill="${INK}" stroke="#809185" stroke-width="1.2"/>
    <text x="256" y="40" text-anchor="middle" font-size="10" font-weight="700" fill="${CREAM}">VS</text>
    <rect x="${(WIDTH - boxWidth) / 2}" y="250" width="${boxWidth}" height="28" rx="7"
      fill="${INK}" fill-opacity=".97" stroke="${accent}" stroke-width="1.4"/>
    <text x="256" y="270" text-anchor="middle" font-size="${caption.fontSize}" font-weight="700"
      fill="${winner !== undefined ? GOLD : CREAM}">${caption.value}</text>
  </g>`;
}

function numberText(x, y, value, color) {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif"
    font-size="19" font-weight="700" fill="${color}" stroke="#2c2024" stroke-width="3.5"
    paint-order="stroke">${value}</text>`;
}

function star(x, y, size, color = GOLD) {
  return `<path d="M0-13 3-5 13-7 8 0 14 7 5 6 1 13-3 6-12 9-8 0-14-5-4-5Z"
    transform="translate(${x} ${y}) scale(${size})" fill="${color}" stroke="#322a2a" stroke-width="1.5"/>`;
}

function trails(x, y, direction, color) {
  return `<path d="M${x - 50 * direction} ${y + 2}l${37 * direction}-4
      m${-52 * direction} 13 ${33 * direction}-1 m${-13 * direction}-24 ${35 * direction} 3"
      stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`;
}

function effectPosition(move, phase, actor, target, direction) {
  if (move.style === "heal") {
    return { x: actor.x - direction * 28, y: 170 };
  }
  if (move.style === "projectile") {
    const start = SIDES[move.actor] + direction * 31;
    const end = target.x - direction * 16;
    const progress = [0.03, 0.53, 1, 1][phase];
    return {
      x: start + (end - start) * progress,
      y: 169 - Math.sin(progress * Math.PI) * 30,
    };
  }
  if (move.style === "rush" && phase === 1) {
    return { x: actor.x + direction * 39, y: 195 };
  }
  return { x: target.x - direction * 13, y: 170 - (phase === 3 ? 12 : 0) };
}

function moveEffect(move, phase, poses, art, scale) {
  const actor = poses[move.actor];
  const target = poses[move.target];
  const direction = move.actor === 0 ? 1 : -1;
  const { x, y } = effectPosition(move, phase, actor, target, direction);
  const contact = phase === 2;
  const recovery = phase === 3;
  const showArt =
    art &&
    move.ability &&
    (contact ||
      (phase === 1 && ["rush", "projectile"].includes(move.style)) ||
      (recovery && move.style === "burst" && move.after[move.target] > 0));
  const layer = showArt ? center(art, x, y, scale) : null;
  const color = move.snowball
    ? "#e2f6ff"
    : move.ability
      ? COLORS[move.actor]
      : GOLD;
  let shapes = "";
  if (move.style === "heal") {
    if (phase > 0) {
      const height = contact ? 141 : 153;
      shapes = `<path d="M${actor.x - 43} ${height}h14m-7-7v14
        M${actor.x + 31} ${height - 16}h10m-5-5v10" stroke="#9ce9b1" stroke-width="4" stroke-linecap="round"/>`;
    }
  } else if (move.status === "Asleep" || move.status === "Stunned") {
    if (phase > 0) {
      const at = target.x + direction * 37;
      shapes =
        move.status === "Asleep"
          ? numberText(at, contact ? 104 : 114, "Zz", "#c2d5f6")
          : star(at, 102, 0.53) + star(at + direction * 15, 114, 0.34);
    }
  } else if (move.status === "Burning") {
    if (phase > 0) {
      shapes = `<path d="M-16 11Q-27 2-13-12q-1 12 7 9Q6-14 3-24 26-8 17 10 8 22-9 16Z"
        transform="translate(${x} ${y + 12}) scale(${contact ? 1.15 : 0.72})"
        fill="#f9a46a" stroke="#522f31" stroke-width="2"/>
        ${star(x + direction * 20, y - 7, 0.38, "#ffca78")}`;
    }
  } else if (move.style === "projectile" && phase < 3) {
    shapes = trails(x, y, direction, color);
    if (move.snowball && !contact) {
      shapes += `<circle cx="${x}" cy="${y}" r="10" fill="#e2f6ff" stroke="#7793a6" stroke-width="2"/>`;
    } else if (!showArt) {
      shapes += star(x, y, contact ? 1.55 : 0.88, color);
    }
  } else if (move.style === "burst" && phase > 0) {
    shapes = `<circle cx="${x}" cy="${y}" r="${contact ? 37 : recovery ? 43 : 22}"
      fill="none" stroke="${color}" stroke-width="${contact ? 3.5 : 2}" opacity="${recovery ? 0.6 : 0.9}"/>`;
    if (contact && !showArt) shapes += star(x, y, 1.75, color);
  } else if (move.style === "rush" || move.style === "strike") {
    if (phase === 1)
      shapes = trails(actor.x + direction * 16, 191, direction, color);
    if (contact) {
      shapes = trails(x, y, direction, color);
      if (!showArt) shapes += star(x, y, move.ability ? 1.75 : 1.35, color);
    }
  }
  if (phase >= 2 && move.damage > 0) {
    shapes += numberText(
      target.x + direction * 35,
      contact ? 134 : 116,
      `−${move.damage}`,
      "#ffddb1",
    );
  }
  if (phase >= 2 && move.healing > 0) {
    shapes += numberText(
      actor.x - direction * 33,
      contact ? 131 : 111,
      `+${move.healing}`,
      "#b7f0c1",
    );
  }
  return { layer, shapes };
}

function posesFor(frame, sprites, downed) {
  return sprites.map((sprite, side) => {
    const { move, phase, winner } = frame;
    let x = SIDES[side];
    let lift = 0;
    let ko = winner !== undefined && winner !== side;
    if (move?.actor === side) {
      const direction = side === 0 ? 1 : -1;
      x += direction * MOTION[move.style][phase];
      if (move.style !== "status") lift = [-2, 8, 11, 3][phase];
    } else if (move?.target === side && move.damage && phase >= 2) {
      x += (side === 0 ? -1 : 1) * (phase === 2 ? 15 : 9);
      lift = phase === 2 ? 9 : 0;
      ko = phase === 3 && move.after[side] === 0;
    }
    return { x, lift, ko, sprite: ko ? downed : sprite };
  });
}

async function drawFrame(fight, frame, stage) {
  const { background, sprites, effects, downed, profile, names } = stage;
  const scale = profile.width / WIDTH;
  const poses = posesFor(frame, sprites, downed);
  const move = frame.move;
  const hp = move ? (frame.phase >= 2 ? move.after : move.before) : frame.hp;
  const shadows = poses
    .map(
      ({ x, lift, ko, sprite }) =>
        `<ellipse cx="${x}" cy="${GROUND + 1}" rx="${Math.max(20, sprite.raw.width / scale / (ko ? 2.1 : 2.7))}"
          ry="${ko ? 6 : 4}" fill="#14181b" opacity="${lift > 5 ? 0.42 : 0.64}"/>`,
    )
    .join("");
  const winner = frame.winner;
  const effect = move
    ? moveEffect(move, frame.phase, poses, effects[move.actor], scale)
    : { layer: null, shapes: "" };
  if (winner !== undefined) {
    const loser = 1 - winner;
    effect.shapes +=
      star(SIDES[winner] + (winner ? 51 : -51), 111, 0.68) +
      numberText(
        SIDES[loser],
        GROUND - downed.raw.height / scale - 14,
        "K.O.",
        GOLD,
      );
  }
  const layers = [
    { input: stageSvg(profile.width, shadows) },
    ...poses.map(({ x, lift, ko, sprite }) =>
      center(
        sprite,
        x,
        GROUND - lift - sprite.raw.height / scale / 2 + (ko ? 2 : 0),
        scale,
      ),
    ),
  ];
  if (effect.layer) layers.push(effect.layer);
  layers.push({
    input: stageSvg(
      profile.width,
      effect.shapes + captions(fight, frame, hp, names),
    ),
  });
  return sharp(background.input, { raw: background.raw })
    .composite(layers)
    .removeAlpha()
    .raw()
    .toBuffer();
}

function framesFor(fight, phases, winnerName) {
  const frames = [
    { hp: fight.maxHp, caption: { value: "FIGHT", fontSize: 16 }, delay: 540 },
  ];
  for (const move of fight.moves) {
    const duration = move.ability ? [130, 100, 170, 140] : [80, 70, 120, 110];
    const caption = fitLabel(move.label, 214, 16);
    let previous = -1;
    phases.forEach((phase, index) => {
      const through = index === phases.length - 1 ? 4 : phase + 1;
      const delay = duration
        .slice(previous + 1, through)
        .reduce((sum, value) => sum + value, 0);
      frames.push({ move, phase, caption, delay });
      previous = phase;
    });
  }
  const winnerCaption = fitLabel(winnerName, 215, 19);
  frames.push({
    hp: fight.moves.at(-1).after,
    caption: { ...winnerCaption, value: `${winnerCaption.value} wins` },
    winner: fight.winner,
    delay: 1900,
  });
  return frames;
}

async function encode(fight, sources, profile) {
  const width = profile.width;
  const scale = width / WIDTH;
  const height = HEIGHT * scale;
  const [background, sprites, effects] = await Promise.all([
    arena(sources.background, width, height),
    Promise.all(
      fight.fighters.map(
        async ({ id }, side) =>
          (await loadArt(
            sources.sprites?.[id],
            Math.round(149 * scale),
            Math.round(156 * scale),
            true,
          )) ?? silhouette(side, scale),
      ),
    ),
    Promise.all(
      fight.fighters.map(({ id }, side) =>
        loadArt(
          sources.effects?.[id],
          Math.round(116 * scale),
          Math.round(102 * scale),
          true,
          side === 1 &&
            fight.moves.some(
              (move) =>
                move.actor === side &&
                move.ability &&
                (move.style === "projectile" || move.style === "rush"),
            ),
        ),
      ),
    ),
  ]);
  const downed = await fallen(
    sprites[1 - fight.winner],
    1 - fight.winner,
    scale,
  );
  const names = fight.fighters.map((fighter, side) =>
    label(fighter.name, `Fighter ${side + 1}`),
  );
  const frames = framesFor(fight, profile.phases, names[fight.winner]);
  const stage = {
    background,
    sprites,
    effects,
    downed,
    profile,
    names: names.map((name) => fitLabel(name, 148, 17)),
  };
  const bytesPerFrame = width * height * 3;
  const stack = Buffer.alloc(bytesPerFrame * frames.length);
  for (let index = 0; index < frames.length; index++) {
    const pixels = await drawFrame(fight, frames[index], stage);
    pixels.copy(stack, index * bytesPerFrame);
  }
  return sharp(stack, {
    raw: {
      width,
      height: height * frames.length,
      pageHeight: height,
      channels: 3,
    },
  })
    .gif({
      loop: 0,
      delay: frames.map((frame) => frame.delay),
      colours: profile.colors,
      dither: 0,
      effort: 4,
      interFrameMaxError: 3,
      interPaletteMaxError: 3,
      keepDuplicateFrames: true,
    })
    .toBuffer();
}

export async function renderFightGif({
  match,
  background,
  sprites,
  effects,
  maxBytes = 3_000_000,
}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("Expected a positive GIF size limit");
  }
  const fight = timeline(match);
  for (const profile of PROFILES) {
    const gif = await encode(fight, { background, sprites, effects }, profile);
    if (gif.length <= maxBytes) return gif;
  }
  throw new RangeError(`Fight GIF exceeds the ${maxBytes}-byte limit`);
}
