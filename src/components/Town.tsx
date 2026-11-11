import { memo } from "react";
import type { Character, Point } from "../game/model";
import { characterKey } from "../game/model";
import type { CameraView } from "../game/camera";
import { CharacterArt } from "./Character";
import { sceneryArtUrl } from "../game/art";
import { WORLD, TOWN_NAME, location } from "../game/locations";

function Pine({ x, y, s = 1 }: Point & { s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-5-10H5V14H-5Z" fill="#594635" />
      <path
        d="M0-145L-35-91H-22L-50-43H-32L-65 3H65L32-43H50L22-91H35Z"
        fill="#17533c"
      />
      <path
        d="M0-145L-26-105L-7-110L5-120L18-110ZM-22-91L-44-54L-24-60L-13-72L-1-64L12-71L34-54L22-91ZM-32-43L-59-3L-37-10L-23-23L-12-14L3-24L19-13L34-21L56-3L32-43Z"
        fill="#f8faf8"
      />
    </g>
  );
}
function Bench({ x, y }: Point) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-43-26H43M-43-15H43M-47-2H47"
        stroke="#7c593a"
        strokeWidth="8"
      />
      <path d="M-36-31V12M36-31V12" stroke="#303b39" strokeWidth="4" />
      <path d="M-45-32H43" stroke="#f8faf8" strokeWidth="5" />
    </g>
  );
}
function Sign({ x, y, name }: Point & { name: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0V-35" stroke="#75563c" strokeWidth="4" />
      <rect
        x="-65"
        y="-54"
        width="130"
        height="25"
        rx="2"
        fill="#384d45"
        stroke="#f3f2df"
        strokeWidth="2"
      />
      <text
        y="-37"
        textAnchor="middle"
        fill="#fff9e5"
        fontSize="10"
        fontWeight="600"
      >
        {name}
      </text>
    </g>
  );
}
const Scenery = memo(function Scenery({ townName }: { townName: string }) {
  return (
    <g className="scenery" aria-hidden="true">
      <rect width={WORLD.width} height={WORLD.height} fill="#eef3f3" />
      <rect width={WORLD.width} height="390" fill="#82ccdc" />
      <g fill="#fffdf5">
        <path d="M80 65L126 41L150 54L183 47L220 66ZM1800 55L1840 29L1890 37L1922 27L1970 56Z" />
      </g>
      <path
        d="M-100 350L140 30L400 320L680 10L980 330L1270 38L1590 340L1850 4L2220 350L2430 110L2530 390H-100Z"
        fill="#27573f"
      />
      <path
        d="M60 138L140 30L242 150L180 126L150 139L118 111L92 141ZM570 138L680 10L790 140L738 118L697 137L665 102L625 133ZM1739 132L1850 4L1992 154L1910 120L1860 141L1815 107L1775 140Z"
        fill="#fafbf7"
      />
      <path
        d="M-80 390L270 145L540 390L920 167L1210 400L1550 180L1880 390L2210 150L2500 410V505H-80Z"
        fill="#1b4938"
      />
      {Array.from({ length: 38 }, (_, i) => (
        <Pine
          key={i}
          x={i * 67 - 20}
          y={420 + (i % 3) * 17}
          s={0.65 + (i % 4) * 0.08}
        />
      ))}
      {/* Three blocks connected by a north/south road. Pavements stay clear around every facade. */}
      <rect x="2080" y="515" width="220" height="1535" fill="#c2c5cd" />
      <rect x="2110" y="515" width="130" height="1535" fill="#53525b" />
      <path
        d="M2175 520V2050"
        stroke="#e9cb68"
        strokeWidth="3"
        strokeDasharray="30 23"
      />
      {[530, 1200, 1930].map((y) => (
        <g key={y}>
          <rect
            x="0"
            y={y - 26}
            width={WORLD.width}
            height="184"
            fill="#bec2cd"
          />
          <rect x="0" y={y} width={WORLD.width} height="130" fill="#53525b" />
          <path
            d={`M0 ${y + 65}H2400`}
            stroke="#e9cb68"
            strokeWidth="3"
            strokeDasharray="30 23"
          />
          <path
            d={`M0 ${y - 3}H2075M2305 ${y - 3}H2400M0 ${y + 133}H2075M2305 ${y + 133}H2400`}
            stroke="#e3e4e8"
            strokeWidth="5"
          />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x={2020}
              y={y + 9 + i * 19}
              width="45"
              height="9"
              fill="#efefec"
            />
          ))}
        </g>
      ))}
      <g stroke="#969ca9" strokeWidth="1.5" opacity=".65">
        {Array.from({ length: 22 }, (_, i) => (
          <path
            key={i}
            d={`M${i * 110} 504v22m0 136v26M${i * 110} 1174v22m0 136v26M${i * 110} 1904v22m0 136v25`}
          />
        ))}
      </g>
      <g fill="none" stroke="#dae5e9" strokeWidth="3">
        <path d="M40 725q120-30 260-10M1800 720q100-18 230 0M125 1390q350-40 580-10M1130 1395q400-40 890-5M2305 1480q50-30 90 0" />
        <path d="M0 2090q800-30 1240-5t1160-4" />
      </g>
      {Array.from({ length: 27 }, (_, i) => (
        <Pine
          key={i}
          x={150 + i * 72}
          y={760 + (i % 3) * 9}
          s={0.52 + (i % 3) * 0.07}
        />
      ))}
      {Array.from({ length: 27 }, (_, i) => (
        <Pine
          key={i}
          x={115 + i * 74}
          y={1470 + (i % 3) * 10}
          s={0.55 + (i % 4) * 0.06}
        />
      ))}
      <ellipse cx="1710" cy="402" rx="210" ry="72" fill="#d4e4e8" />
      <ellipse cx="1710" cy="396" rx="190" ry="61" fill="#abcfd7" />
      <path d="M1585 392l75-12m55 38 100-19" stroke="#d9ebee" strokeWidth="4" />
      {Array.from({ length: 9 }, (_, i) => (
        <Pine
          key={`park-${i}`}
          x={1390 + i * 76}
          y={465 + (i % 2) * 15}
          s={0.6 + (i % 3) * 0.11}
        />
      ))}
      <Bench x={1720} y={493} />
      <g transform="translate(220 185) scale(.5064456722)">
        <image href={sceneryArtUrl("downtown")} width="2172" height="724" />
        <text
          x="330"
          y="317"
          textAnchor="middle"
          fontSize="52"
          fontWeight="800"
          fill="#663b40"
          textLength="485"
          lengthAdjust="spacingAndGlyphs"
        >
          {location("coffee").shortName}
        </text>
        <text
          x="330"
          y="351"
          textAnchor="middle"
          fontSize="25"
          fontWeight="700"
          letterSpacing="6"
          fill="#663b40"
        >
          COFFEE
        </text>
        <text
          x="1140"
          y="241"
          textAnchor="middle"
          fontSize="31"
          fontWeight="700"
          fill="#fff4df"
        >
          {location("city-wok")
            .name.split(" ")
            .map((word, i) => (
              <tspan key={i} x="1140" dy={i ? 38 : 0}>
                {word.toUpperCase()}
              </tspan>
            ))}
        </text>
        <text
          x="1840"
          y="354"
          textAnchor="middle"
          fontSize="35"
          fontWeight="500"
          fill="#262331"
          textLength="460"
          lengthAdjust="spacingAndGlyphs"
        >
          {location("toms").name.toUpperCase()}
        </text>
      </g>
      <path d="M518 1103L600 1103L618 1173H498Z" fill="#b8bac7" />
      <image
        href={sceneryArtUrl("school")}
        x="150"
        y="700"
        width="820"
        height={(820 * 941) / 1672}
      />
      <text
        x="556"
        y="977"
        textAnchor="middle"
        fontFamily="Georgia,serif"
        fontSize="24"
        fontWeight="700"
        fill="#1d2230"
        textLength="418"
        lengthAdjust="spacingAndGlyphs"
      >
        {location("school").name.toUpperCase()}
      </text>
      <path d="M1590 1135H1695L1715 1173H1570Z" fill="#b8bac7" />
      <image
        href={sceneryArtUrl("police")}
        x="1240"
        y="750"
        width="800"
        height={(800 * 897) / 1754}
      />
      <text
        x="1640"
        y="977"
        textAnchor="middle"
        fontFamily="Georgia,serif"
        fontSize="17"
        fontWeight="700"
        fill="#282225"
      >
        <tspan x="1640">{location("police").name}</tspan>
        <tspan x="1640" dy="22">
          STATION
        </tspan>
      </text>
      <Bench x={1105} y={997} />
      <Pine x={2273} y={1025} s={0.7} />
      <Sign x={1095} y={1120} name="DOWNTOWN ↑" />
      <Sign x={2310} y={1350} name="NEIGHBORHOOD ↓" />
      <g fill="#c3c4cb">
        {[280, 755, 1230, 1705].map((x) => (
          <path key={x} d={`M${x - 25} 1800h65l30 100h-120Z`} />
        ))}
      </g>
      <image
        href={sceneryArtUrl("homes")}
        x="130"
        y="1320"
        width="1920"
        height="640"
      />
      {["cartman", "marsh", "broflovski", "mccormick"].map((id) => {
        const l = location(id);
        return (
          <Sign
            key={id}
            x={l.entrance.x + 120}
            y={1900}
            name={l.shortName || l.name}
          />
        );
      })}
      <g transform="translate(2285 498)">
        <path d="M0 0V-100" stroke="#7d593d" strokeWidth="7" />
        <path
          d="M-40-103H40V-61H-40Z"
          fill="#e9c66b"
          stroke="#735638"
          strokeWidth="3"
        />
        <text
          textAnchor="middle"
          y="-84"
          fontSize="12"
          fontWeight="700"
          fill="#423e38"
        >
          BUS
        </text>
        <text
          textAnchor="middle"
          y="-69"
          fontSize="12"
          fontWeight="700"
          fill="#423e38"
        >
          STOP
        </text>
        <path d="M-41-107H40" stroke="#fff" strokeWidth="6" />
      </g>
      <g transform="translate(150 695)">
        <path d="M-60 0V-41M60 0V-41" stroke="#815c3c" strokeWidth="6" />
        <path
          d="M-95-89H95V-18H-95Z"
          fill="#346047"
          stroke="#6a4d34"
          strokeWidth="5"
        />
        <text textAnchor="middle" y="-65" fontSize="13" fill="#fff1d2">
          WELCOME TO
        </text>
        <text
          textAnchor="middle"
          y="-36"
          fontSize="26"
          fontWeight="700"
          fill="#fff1d2"
        >
          {townName.toUpperCase()}
        </text>
        <path d="M-96-92H96" stroke="#fff" strokeWidth="8" />
      </g>
      {[
        { x: 2310, y: 760 },
        { x: 2320, y: 1530 },
        { x: 2320, y: 1790 },
        { x: 60, y: 1300 },
        { x: 45, y: 1840 },
      ].map((p, i) => (
        <Pine key={i} {...p} s={0.8} />
      ))}
    </g>
  );
});
interface Props {
  camera: CameraView;
  player: Point;
  moving: boolean;
  facing: number;
  crew: Character[];
  activeKey: string;
  target: Point | null;
  onMove: (point: Point) => void;
  onSelect: (character: Character) => void;
  townName?: string;
}
const CITIZEN_SPOTS: Point[] = [
  { x: 225, y: 552 },
  { x: 450, y: 552 },
  { x: 865, y: 552 },
  { x: 1200, y: 552 },
  { x: 355, y: 720 },
  { x: 740, y: 1160 },
  { x: 1830, y: 1190 },
  { x: 1105, y: 1170 },
  { x: 1850, y: 700 },
  { x: 180, y: 1870 },
  { x: 650, y: 1870 },
  { x: 1120, y: 1870 },
  { x: 1590, y: 1870 },
  { x: 2280, y: 550 },
  { x: 2200, y: 1350 },
  { x: 700, y: 1340 },
  { x: 1850, y: 1350 },
  { x: 2000, y: 1190 },
  { x: 430, y: 1350 },
  { x: 1350, y: 1350 },
  { x: 1800, y: 1870 },
  { x: 1150, y: 700 },
  { x: 2100, y: 750 },
  { x: 1100, y: 1870 },
];
export function Town({
  camera,
  player,
  moving,
  facing,
  crew,
  activeKey,
  target,
  onMove,
  onSelect,
  townName = TOWN_NAME,
}: Props) {
  const entities = crew
    .map((c, i) => ({
      c,
      key: characterKey(c),
      ...(characterKey(c) === activeKey
        ? player
        : CITIZEN_SPOTS[i % CITIZEN_SPOTS.length]),
    }))
    .sort((a, b) => a.y - b.y);
  return (
    <svg
      data-testid="town"
      className="town-svg"
      viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
      aria-label={`${townName} free-roam town. Click the ground to walk or a character to play as them.`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const matrix = e.currentTarget.getScreenCTM();
        if (!matrix) return;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
          matrix.inverse(),
        );
        onMove({ x: p.x, y: p.y });
      }}
    >
      <Scenery townName={townName} />
      {target && (
        <g
          className="walk-target"
          transform={`translate(${target.x} ${target.y})`}
          pointerEvents="none"
        >
          <ellipse
            rx="13"
            ry="6"
            fill="none"
            stroke="#fff3be"
            strokeWidth="3"
          />
          <circle r="3" fill="#fff3be" />
        </g>
      )}
      {entities.map((e) => {
        const active = e.key === activeKey;
        return (
          <g
            key={e.key}
            role={active ? undefined : "button"}
            tabIndex={active ? undefined : 0}
            aria-label={active ? undefined : `Play as ${e.c.name}`}
            className={active ? "active-citizen" : "world-citizen"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (!active) onSelect(e.c);
            }}
            onKeyDown={(event) => {
              if (!active && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onSelect(e.c);
              }
            }}
          >
            {active && (
              <ellipse
                cx={e.x}
                cy={e.y + 1}
                rx="30"
                ry="9"
                fill="#eaf2b4"
                opacity=".5"
              />
            )}
            <g
              transform={`translate(${e.x - 36} ${e.y - 90}) scale(.48)`}
              data-testid={active ? "player-sprite" : undefined}
              data-character={e.key}
              data-x={active ? player.x : undefined}
              data-y={active ? player.y : undefined}
            >
              <CharacterArt
                c={e.c}
                moving={active && moving}
                facing={active ? facing : 1}
              />
            </g>
            <g
              className="nameplate"
              transform={`translate(${e.x} ${e.y + 20})`}
            >
              <rect
                x="-49"
                y="-10"
                width="98"
                height="22"
                rx="10"
                fill={active ? "#e5f0b2" : "#f9f2dc"}
                opacity=".95"
              />
              <text
                textAnchor="middle"
                y="5"
                fill="#415748"
                fontSize="11"
                fontWeight="600"
              >
                {e.c.name.slice(0, 16)}
                {active ? " · YOU" : ""}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
