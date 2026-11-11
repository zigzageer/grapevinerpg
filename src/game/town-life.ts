import { STREET_ROWS, STREET_WIDTH, WORLD } from "./locations";
import type { Point } from "./model";
import { findPath } from "./navigation";

type Stop = Point & {
  activity: string;
  line: string;
  prop?: "snowball" | "map";
};
type ResidentId =
  | "cartman"
  | "stan"
  | "kyle"
  | "kenny"
  | "butters"
  | "wendy"
  | "randy";
interface Resident {
  id: ResidentId;
  name: string;
  label: string;
  speed: number;
  stops: readonly Stop[];
}

const [downtown, school, neighborhood] = STREET_ROWS;
const EASTBOUND = STREET_WIDTH - 27;
const WESTBOUND = 38;
const RESIDENTS: readonly Resident[] = [
  {
    id: "cartman",
    name: "Eric Cartman",
    label: "Cartman",
    speed: 47,
    stops: [
      {
        x: 780,
        y: downtown - 1,
        activity: "Checking the City Wok menu",
        line: "I'm waiting for my order. If it smells this good from out here, I should've ordered two.",
      },
      {
        x: 960,
        y: downtown - 1,
        activity: "Window-shopping",
        line: "If anybody asks, I'm doing very important downtown business.",
      },
      {
        x: 695,
        y: downtown - 1,
        activity: "Taking a stroll",
        line: "I know a shortcut to lunch. It goes straight through lunch.",
      },
    ],
  },
  {
    id: "butters",
    name: "Butters Stotch",
    label: "Butters",
    speed: 51,
    stops: [
      {
        x: 565,
        y: downtown + 147,
        activity: "Making snowballs",
        prop: "snowball",
        line: "I made a snowball for the snowman. Then I made it a little snowball friend.",
      },
      {
        x: 735,
        y: downtown + 146,
        activity: "Scouting parade spots",
        line: "I'm saving a spot for the parade. I sure hope the drummer remembers his mittens.",
      },
      {
        x: 440,
        y: downtown + 149,
        activity: "Watching the street",
        line: "That blue car's been by twice. Maybe it's looking for a place to park.",
      },
    ],
  },
  {
    id: "wendy",
    name: "Wendy Testaburger",
    label: "Wendy",
    speed: 56,
    stops: [
      {
        x: 1140,
        y: downtown + 149,
        activity: "Checking the parade route",
        prop: "map",
        line: "The winter parade runs down this street. There's a good view from this sidewalk.",
      },
      {
        x: 1385,
        y: downtown + 147,
        activity: "Taking a walk downtown",
        line: "The snow on the trees is pretty before anybody shakes the branches.",
      },
      {
        x: 1010,
        y: downtown + 147,
        activity: "Waiting for a friend",
        line: "I told Butters I'd meet him by the shops. He might be a little busy with the snow.",
      },
    ],
  },
  {
    id: "stan",
    name: "Stan Marsh",
    label: "Stan",
    speed: 53,
    stops: [
      {
        x: 550,
        y: school - 14,
        activity: "Hanging out by the school",
        line: "I was headed home, but Kyle said he'd meet me out here.",
      },
      {
        x: 400,
        y: school - 12,
        activity: "Kicking at the snow",
        line: "The snow by the school is already taller than my boots.",
      },
      {
        x: 680,
        y: school - 15,
        activity: "Walking past the school",
        line: "It's weird seeing the school this quiet. I kind of like it.",
      },
    ],
  },
  {
    id: "kyle",
    name: "Kyle Broflovski",
    label: "Kyle",
    speed: 59,
    stops: [
      {
        x: 920,
        y: school - 14,
        activity: "Heading toward school",
        line: "Have you seen Stan? I said I'd meet him by the front steps.",
      },
      {
        x: 765,
        y: school - 10,
        activity: "Waiting on the sidewalk",
        line: "Someone should really shovel this stretch of sidewalk.",
      },
      {
        x: 1080,
        y: school - 16,
        activity: "Looking down the block",
        line: "Downtown's that way. You can follow the next street north.",
      },
    ],
  },
  {
    id: "randy",
    name: "Randy Marsh",
    label: "Randy",
    speed: 49,
    stops: [
      {
        x: 755,
        y: neighborhood - 13,
        activity: "Inspecting the driveway",
        line: "I cleared the driveway this morning. The snowplow and I have different ideas about where the snow goes.",
      },
      {
        x: 510,
        y: neighborhood - 13,
        activity: "Checking the snowbanks",
        line: "I could build a ramp out of this. For the kids, obviously.",
      },
      {
        x: 1000,
        y: neighborhood - 13,
        activity: "Taking the long way home",
        line: "I meant to go straight home. This still counts as straight if you don't look at a map.",
      },
    ],
  },
  {
    id: "kenny",
    name: "Kenny McCormick",
    label: "Kenny",
    speed: 63,
    stops: [
      {
        x: 1655,
        y: neighborhood - 13,
        activity: "Hanging around near home",
        line: "(A muffled hello from inside the orange hood.)",
      },
      {
        x: 1430,
        y: neighborhood - 14,
        activity: "Following tracks in the snow",
        line: "(Kenny points to a trail of tiny footprints.)",
      },
      {
        x: 1875,
        y: neighborhood - 12,
        activity: "Checking the snowbank",
        line: "(Kenny shakes the snow off his hood and waves.)",
      },
    ],
  },
];

export type ResidentWalk = Point & {
  resident: Resident;
  stop: number;
  path: Point[];
  wait: number;
  facing: 1 | -1;
  watching: boolean;
};

export interface ResidentConversation {
  resident: Resident;
  activity: string;
  line: string;
}

export function residentConversation(
  walker: ResidentWalk,
): ResidentConversation {
  const { resident, stop, watching, path } = walker;
  const { activity, line } = resident.stops[stop];
  return {
    resident,
    activity: watching
      ? "Watching the winter parade"
      : path.length
        ? "Out for a walk"
        : activity,
    line: watching ? "Here comes the float!" : line,
  };
}

export type VehicleStyle =
  | "sedan"
  | "wagon"
  | "pickup"
  | "bus"
  | "marshal"
  | "float"
  | "drummer"
  | "flag-bearer";
export type StreetVehicle = Point & {
  id: string;
  style: VehicleStyle;
  color: string;
  facing: 1 | -1;
};

const STREET_MARGIN = 160;
const STREET_LENGTH = WORLD.width + 2 * STREET_MARGIN;
const PARADE_FIRST = 7;
const PARADE_INTERVAL = 88;
const PARADE_SPEED = 88;
const PARADE_LINEUP = [
  { style: "marshal", offset: 0, row: 0, color: "#b54438" },
  { style: "drummer", offset: 139, row: -11, color: "#893c55" },
  { style: "drummer", offset: 163, row: 12, color: "#315b64" },
  { style: "float", offset: 325, row: 0, color: "#35645c" },
  { style: "flag-bearer", offset: 475, row: -10, color: "#893c55" },
  { style: "flag-bearer", offset: 506, row: 12, color: "#315b64" },
] as const;
const PARADE_DURATION =
  (STREET_LENGTH + PARADE_LINEUP.at(-1)!.offset) / PARADE_SPEED;

export function streetTraffic(time: number): StreetVehicle[] {
  const vehicles: StreetVehicle[] = [];
  const palette = [
    "#9a5148",
    "#536e7c",
    "#b69a65",
    "#63705d",
    "#74677d",
    "#bcb1a1",
  ];
  for (const [road, row] of STREET_ROWS.entries()) {
    for (const facing of [-1, 1] as const) {
      const lane = 2 * road + Number(facing === 1);
      const interval = 5.7 + road * 0.5;
      const speed = 122 + lane * 4;
      const offset = 1 + lane * 1.6;
      const last = Math.floor((time + offset) / interval);
      for (let trip = last; ; trip--) {
        const departure = trip * interval - offset;
        const travel = (time - departure) * speed;
        if (travel > STREET_LENGTH) break;
        // Let the last eastbound car pull ahead before the parade takes its lane.
        const parade = Math.floor(
          (departure + 2 - PARADE_FIRST) / PARADE_INTERVAL,
        );
        const start = PARADE_FIRST + parade * PARADE_INTERVAL;
        if (
          row === downtown &&
          facing === 1 &&
          parade >= 0 &&
          departure < start + PARADE_DURATION
        )
          continue;
        const variant = Math.abs(trip + 3 * lane);
        const bus = road === 1 && variant % 4 === 0;
        vehicles.push({
          id: `traffic-${lane}-${trip}`,
          style: bus
            ? "bus"
            : (["sedan", "wagon", "pickup"] as const)[(variant + lane) % 3],
          color: bus ? "#e1ad4b" : palette[(variant + 2 * lane) % palette.length],
          x:
            facing === 1
              ? travel - STREET_MARGIN
              : WORLD.width + STREET_MARGIN - travel,
          y: row + (facing === 1 ? EASTBOUND : WESTBOUND),
          facing,
        });
      }
    }
  }
  return vehicles;
}

export function winterParade(time: number): StreetVehicle[] {
  if (time < PARADE_FIRST) return [];
  const elapsed = (time - PARADE_FIRST) % PARADE_INTERVAL;
  if (elapsed >= PARADE_DURATION) return [];
  return PARADE_LINEUP.flatMap(({ style, offset, row, color }, i) => {
    const x = elapsed * PARADE_SPEED - offset - STREET_MARGIN;
    return x < -STREET_MARGIN || x > WORLD.width + STREET_MARGIN
      ? []
      : [
          {
            id: `parade-${i}`,
            style,
            color,
            x,
            y: downtown + EASTBOUND + row,
            facing: 1,
          },
        ];
  });
}

export interface TownLife {
  time: number;
  residents: ResidentWalk[];
}

export function createTownLife(): TownLife {
  return {
    time: 0,
    residents: RESIDENTS.map((resident, i) => ({
      x: resident.stops[0].x,
      y: resident.stops[0].y,
      resident,
      stop: 0,
      path: [],
      wait: 1.7 + i * 0.55,
      facing: 1,
      watching: false,
    })),
  };
}

function walkResident(
  walker: ResidentWalk,
  dt: number,
  float?: StreetVehicle,
): ResidentWalk {
  if (
    float &&
    Math.abs(walker.y - float.y) < 110 &&
    Math.abs(walker.x - float.x) < 140
  ) {
    return { ...walker, watching: true, facing: float.x < walker.x ? -1 : 1 };
  }
  const next = walker.path[0];
  if (next) {
    const dx = next.x - walker.x;
    const dy = next.y - walker.y;
    const distance = Math.hypot(dx, dy);
    const travel = dt * walker.resident.speed;
    const facing = dx < 0 ? -1 : dx > 0 ? 1 : walker.facing;
    if (distance <= travel) {
      return {
        ...walker,
        ...next,
        path: walker.path.slice(1),
        facing,
        watching: false,
      };
    }
    return {
      ...walker,
      x: walker.x + (dx * travel) / distance,
      y: walker.y + (dy * travel) / distance,
      facing,
      watching: false,
    };
  }
  if (walker.wait > dt)
    return { ...walker, wait: walker.wait - dt, watching: false };
  const stops = walker.resident.stops;
  const stop =
    (walker.stop + 1 + Math.floor(Math.random() * (stops.length - 1))) %
    stops.length;
  return {
    ...walker,
    stop,
    path: findPath(walker, stops[stop]),
    wait: 2.6 + Math.random() * 3.8,
    watching: false,
  };
}

export function advanceTownLife(life: TownLife, dt: number): TownLife {
  const time = life.time + dt;
  const float = winterParade(time).find((vehicle) => vehicle.style === "float");
  return {
    time,
    residents: life.residents.map((walker) => walkResident(walker, dt, float)),
  };
}
