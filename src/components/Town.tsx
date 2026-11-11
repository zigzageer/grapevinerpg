import { memo } from "react";
import type { Character, Point } from "../game/model";
import { characterKey } from "../game/model";
import { CharacterArt } from "./Character";

function Pine({
  x,
  y,
  s = 1,
  color = "#3f6852",
}: {
  x: number;
  y: number;
  s?: number;
  color?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-5-10H5V15H-5Z" fill="#73573d" />
      <path
        d="M0-155L-36-93H-23L-52-46H-34L-67 4Q0 14 67 4L34-46H52L23-93H36Z"
        fill={color}
      />
      <path
        d="M0-155L-36-93H-9L-29-46H-8L-42 5Q-13 9 0 9Z"
        fill="#000"
        opacity=".06"
      />
      <path d="M0-155L-17-125Q-3-120 13-132Z" fill="#e0e5cb" opacity=".7" />
    </g>
  );
}
function Shrub({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#759667">
      <ellipse cx="0" cy="0" rx="32" ry="13" />
      <circle cx="-17" cy="-10" r="16" />
      <circle cx="7" cy="-17" r="23" />
      <circle cx="30" cy="-5" r="15" />
    </g>
  );
}
function Window({
  x,
  y,
  w = 40,
  h = 54,
  lit = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  lit?: boolean;
}) {
  return (
    <g>
      <rect x={x - 5} y={y - 5} width={w + 10} height={h + 10} fill="#f3e7c9" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={lit ? "#edce8b" : "#91b0a7"}
      />
      <path
        d={`M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}`}
        stroke="#f3e7c9"
        strokeWidth="4"
      />
      <path d={`M${x} ${y + h}h${w}`} stroke="#765c45" strokeWidth="5" />
    </g>
  );
}
function Lamp({ x, y }: Point) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M0 0V-117Q0-136 20-136H35"
        stroke="#3b4c41"
        strokeWidth="5"
        fill="none"
      />
      <path
        d="M24-132H45L48-115H21Z"
        fill="#f5e6ad"
        stroke="#3b4c41"
        strokeWidth="3"
      />
      <ellipse cx="0" cy="0" rx="7" ry="3" fill="#425548" />
    </g>
  );
}
function Bench({ x, y }: Point) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-45-24H45M-45-14H45M-49 0H49"
        stroke="#976d47"
        strokeWidth="8"
      />
      <path d="M-37-29V13M37-29V13" stroke="#455d4a" strokeWidth="5" />
    </g>
  );
}
const Scenery = memo(function Scenery() {
  return (
    <g className="scenery" aria-hidden="true">
      <rect width="1400" height="900" fill="#aacad0" />
      <circle cx="1120" cy="102" r="43" fill="#f4dfab" />
      <g fill="#ebefdc" opacity=".8">
        <path d="M130 87Q142 65 166 77Q186 58 207 80Q233 80 234 95H125Z" />
        <path d="M718 73Q730 45 758 61Q781 42 794 68Q826 64 828 81H715Z" />
        <path d="M1260 158Q1268 141 1289 148Q1302 130 1323 146Q1346 142 1350 165H1256Z" />
      </g>
      <path
        d="M-100 301L120 71L293 265L461 50L661 260L821 103L1036 266L1220 74L1493 313V400H-100Z"
        fill="#7f9d91"
      />
      <path
        d="M49 147L120 71L194 153L160 140L137 151L115 123L92 148L76 135ZM392 126L461 50L531 125L501 111L479 125L457 94L436 125L418 116ZM1150 150L1220 74L1302 154L1262 136L1243 147L1217 122L1198 149L1180 137Z"
        fill="#e3e5ce"
      />
      <path
        d="M-60 324L126 172L295 322L565 168L798 325L1019 180L1268 305L1438 217V450H-60Z"
        fill="#638576"
      />
      <path
        d="M0 305Q195 254 383 320T790 316T1190 298T1480 330V900H0Z"
        fill="#a9b78b"
      />
      {Array.from({ length: 32 }, (_, i) => (
        <Pine
          key={i}
          x={i * 49 - 35}
          y={320 + (i % 4) * 12}
          s={0.45 + (i % 3) * 0.13}
          color={["#456a55", "#52755c", "#3c634f"][i % 3]}
        />
      ))}
      <path
        d="M0 467Q328 454 710 465T1400 467V618Q1053 601 700 616T0 618Z"
        fill="#e1d4b3"
      />
      <path d="M0 485H1400V588H0Z" fill="#8c9991" />
      <path d="M0 485H1400M0 588H1400" stroke="#f2e6c8" strokeWidth="8" />
      <path
        d="M0 537H1400"
        stroke="#edddb2"
        strokeWidth="3"
        strokeDasharray="30 25"
      />
      <path
        d="M785 489V584M801 489V584M817 489V584M833 489V584M849 489V584"
        stroke="#e2dfcd"
        strokeWidth="9"
      />
      <path d="M418 900L519 618H699L807 900Z" fill="#d6c7a1" />
      <path
        d="M0 817Q450 755 693 803T1400 773V826Q1050 855 704 846T0 860Z"
        fill="#c6c29b"
      />
      <g opacity=".28" fill="#6f8c5e">
        {Array.from({ length: 65 }, (_, i) => (
          <path
            key={i}
            d={`M${(i * 173) % 1390} ${645 + ((i * 37) % 245)}l-3-8 6 3 5-7-2 12Z`}
          />
        ))}
      </g>
      <g transform="translate(92 284)">
        <rect x="9" y="27" width="246" height="160" fill="#d9a866" />
        <path d="M-7 33L23-24L244-24L268 33Z" fill="#9a5b48" />
        <path d="M0 26H260V39H0Z" fill="#b56d51" />
        <path d="M27-24V-44H68V-24" fill="#9e6850" />
        <path d="M21-44H74" stroke="#e1c69b" strokeWidth="5" />
        <rect x="21" y="48" width="220" height="35" rx="2" fill="#537568" />
        <text
          x="131"
          y="72"
          textAnchor="middle"
          fontSize="22"
          fontWeight="600"
          fill="#fff1ce"
          className="world-font"
        >
          CORNER STORE
        </text>
        <rect x="22" y="92" width="218" height="10" fill="#f6e7bb" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <path
            key={i}
            d={`M${22 + i * 27.3} 93h27.3l7 27H${15 + i * 27.3}Z`}
            fill={i % 2 ? "#f4e9ce" : "#a46146"}
          />
        ))}
        <Window x={28} y={126} w={58} h={45} lit />
        <Window x={170} y={126} w={58} h={45} lit />
        <rect x="104" y="117" width="49" height="70" fill="#55736a" />
        <rect x="112" y="126" width="33" height="39" fill="#b3c4a6" />
        <circle cx="143" cy="171" r="2.5" fill="#f0d797" />
        <rect x="97" y="183" width="63" height="6" fill="#bca17b" />
        <g fill="#c67b4c">
          <rect x="-5" y="154" width="25" height="33" />
          <rect x="243" y="154" width="25" height="33" />
        </g>
        <g fill="#6b8b53">
          <circle cx="5" cy="150" r="15" />
          <circle cx="255" cy="150" r="15" />
        </g>
      </g>
      <g transform="translate(409 301)">
        <path d="M0 18H245V165H0Z" fill="#e4cfaa" />
        <path d="M-7 19L23-17H225L253 19Z" fill="#57756b" />
        <rect x="15" y="32" width="215" height="36" fill="#a65d46" />
        <text
          x="122"
          y="57"
          textAnchor="middle"
          fontSize="23"
          fontWeight="600"
          fill="#fff0ca"
          className="world-font"
        >
          THE DAILY GRIND
        </text>
        <rect x="12" y="79" width="220" height="20" fill="#62847a" />
        <path d="M12 99H232L238 109H6Z" fill="#496d64" />
        <rect x="17" y="115" width="63" height="46" fill="#b3c8b7" />
        <rect x="160" y="115" width="63" height="46" fill="#b3c8b7" />
        <path d="M48 115V161M191 115V161" stroke="#f2e6c8" strokeWidth="4" />
        <rect x="97" y="91" width="46" height="74" fill="#92644d" />
        <rect x="104" y="100" width="32" height="43" fill="#b9c9b2" />
        <text x="119" y="125" textAnchor="middle" fontSize="12" fill="#405e53">
          OPEN
        </text>
        <circle cx="135" cy="151" r="2.5" fill="#ead3a4" />
        <path
          d="M64-29q-10-11 0-20m11 20q-10-11 0-20"
          stroke="#e7dec3"
          strokeWidth="4"
          fill="none"
        />
        <path d="M51-26H87V-15H51Z" fill="#d4ba87" />
      </g>
      <g transform="translate(750 277)">
        <path d="M6 48H229V185H6Z" fill="#b6b2a0" />
        <path d="M-8 51L117-31L244 51Z" fill="#7f6460" />
        <path
          d="M-8 51L117-31L244 51"
          stroke="#e3d6b8"
          strokeWidth="7"
          fill="none"
        />
        <rect x="38" y="66" width="159" height="25" fill="#576d61" />
        <text
          x="117"
          y="85"
          textAnchor="middle"
          fontSize="17"
          fill="#f6ebcc"
          className="world-font"
        >
          GRAPEVINE TOWN HALL
        </text>
        <Window x={28} y={108} w={37} h={47} />
        <Window x={172} y={108} w={37} h={47} />
        <rect x="92" y="103" width="51" height="82" fill="#84614e" />
        <rect x="99" y="110" width="37" height="39" fill="#c3ccb2" />
        <path d="M85 182H150V189H85Z" fill="#d8c5a3" />
        <circle cx="117" cy="20" r="18" fill="#ecdfbb" />
        <path
          d="M117 8V20L128 25"
          fill="none"
          stroke="#536b5e"
          strokeWidth="3"
        />
        <path d="M248 20V182" stroke="#7b755c" strokeWidth="3" />
        <path d="M250 20Q273 11 288 24V55Q267 43 250 54Z" fill="#c6845b" />
        <path d="M267 25v20m-7-13h14" stroke="#f0ddb3" strokeWidth="3" />
      </g>
      <g transform="translate(1106 343)">
        <rect x="0" y="27" width="218" height="100" fill="#8d9f8a" />
        <rect x="8" y="35" width="202" height="79" fill="#b5c4a6" />
        <path d="M-9 27L7 4H207L229 27Z" fill="#4b6c5c" />
        <path
          d="M8 28V127M210 28V127M108 30V114"
          stroke="#557060"
          strokeWidth="7"
        />
        <rect x="18" y="75" width="65" height="33" fill="#738c73" />
        <text x="51" y="89" textAnchor="middle" fontSize="9" fill="#eee2bc">
          BUS TIMES
        </text>
        <path d="M28 95H73M28 100H64" stroke="#d8d7b2" strokeWidth="2" />
        <Bench x={154} y={116} />
        <text
          x="110"
          y="20"
          textAnchor="middle"
          fontSize="15"
          fill="#f0e8ca"
          className="world-font"
        >
          GRAPEVINE TRANSIT
        </text>
      </g>
      <g transform="translate(1318 484)">
        <path d="M0 0V-105" stroke="#716752" strokeWidth="4" />
        <rect x="-15" y="-115" width="30" height="29" rx="3" fill="#e6c96b" />
        <text
          x="0"
          y="-95"
          textAnchor="middle"
          fontSize="18"
          fill="#5e654a"
          fontWeight="700"
        >
          H
        </text>
      </g>
      <path
        d="M30 362Q337 408 703 351T1370 360"
        stroke="#465949"
        strokeWidth="2"
        fill="none"
      />
      <path d="M45 308V483M1370 310V483" stroke="#7a6b4d" strokeWidth="8" />
      <path d="M28 326H62M1353 326H1387" stroke="#7a6b4d" strokeWidth="5" />
      <Lamp x={374} y={479} />
      <Lamp x={1049} y={480} />
      <g transform="translate(48 568)">
        <path
          d="M0 0Q-5-8 4-15L13-17V-34Q13-42 23-42H67L89-21H105Q118-21 118-7V0Z"
          fill="#aa5f4d"
        />
        <path d="M27-37H64L81-21H24Z" fill="#b9c8b5" />
        <circle cx="22" cy="0" r="12" fill="#3f4842" />
        <circle cx="94" cy="0" r="12" fill="#3f4842" />
        <circle cx="22" cy="0" r="5" fill="#a8ac9b" />
        <circle cx="94" cy="0" r="5" fill="#a8ac9b" />
        <path d="M52-36V-21" stroke="#aa5f4d" strokeWidth="4" />
        <rect x="110" y="-15" width="10" height="6" fill="#efdb9b" />
      </g>
      <g transform="translate(665 701)">
        <ellipse cy="17" rx="71" ry="25" fill="#8b9480" />
        <ellipse cy="10" rx="67" ry="24" fill="#c2c4ab" />
        <ellipse cy="4" rx="57" ry="16" fill="#83b8b2" />
        <path d="M-8 1V-42H8V1Z" fill="#b9bba5" />
        <ellipse cy="-42" rx="31" ry="10" fill="#c9c9b0" />
        <ellipse cy="-45" rx="25" ry="7" fill="#91c0b6" />
        <path
          d="M-18-42Q-19-67 0-67Q19-67 18-42M0-66V-82"
          fill="none"
          stroke="#bed8c7"
          strokeWidth="3"
        />
        <circle cy="-84" r="4" fill="#c1dccd" />
      </g>
      <Bench x={539} y={706} />
      <Bench x={794} y={706} />
      <g fill="#a2a184">
        <ellipse cx="566" cy="813" rx="13" ry="5" />
        <ellipse cx="743" cy="770" rx="9" ry="4" />
        <ellipse cx="409" cy="682" rx="8" ry="4" />
      </g>
      <g transform="translate(945 744)">
        <path d="M-38 1V53M38 1V53" stroke="#806c49" strokeWidth="7" />
        <rect x="-57" y="-46" width="114" height="80" fill="#79694a" />
        <rect x="-51" y="-40" width="102" height="68" fill="#b59b6b" />
        <path d="M-65-46L0-73L65-46Z" fill="#486c55" />
        <rect
          x="-38"
          y="-27"
          width="32"
          height="43"
          transform="rotate(-8)"
          fill="#ede5c9"
        />
        <path
          d="M-31-17H-12M-31-11H-16M-31-5H-12"
          stroke="#929378"
          strokeWidth="2"
        />
        <rect
          x="7"
          y="-31"
          width="31"
          height="36"
          transform="rotate(7)"
          fill="#d4be7f"
        />
        <circle cx="21" cy="-16" r="6" fill="#9f7558" />
      </g>
      <g transform="translate(1189 728)">
        <path
          d="M-52 13L-32-94H37L57 13M-32-94L-68 13M37-94L76 13"
          stroke="#7b6953"
          strokeWidth="7"
          fill="none"
        />
        <path d="M-19-90V-17M24-90V-17" stroke="#b5a580" strokeWidth="2" />
        <path d="M-25-15H30" stroke="#947151" strokeWidth="7" />
      </g>
      <g transform="translate(199 815)">
        <path d="M-65 0V44M65 0V44" stroke="#8a7251" strokeWidth="9" />
        <path d="M-91-47L84-51L91 13L-88 17Z" fill="#546e51" />
        <path
          d="M-82-38L76-42L81 5L-79 8Z"
          fill="none"
          stroke="#b3bf83"
          strokeWidth="2"
        />
        <text
          x="0"
          y="-13"
          textAnchor="middle"
          fontSize="26"
          fill="#f5ebc6"
          className="world-font"
        >
          GRAPEVINE
        </text>
        <text
          x="0"
          y="4"
          textAnchor="middle"
          fontSize="9"
          letterSpacing="2"
          fill="#c5d0a1"
        >
          A LITTLE TOO QUIET.
        </text>
      </g>
      <g stroke="#dacda8" strokeWidth="5">
        <path d="M12 651H236M12 671H236M1070 836H1395M1070 856H1395" />
        {[20, 61, 102, 143, 184, 225].map((x) => (
          <path key={x} d={`M${x} 639v45`} />
        ))}
        {[1081, 1126, 1171, 1216, 1261, 1306, 1351, 1391].map((x) => (
          <path key={x} d={`M${x} 824v45`} />
        ))}
      </g>
      <Pine x={37} y={688} s={0.92} />
      <Pine x={103} y={710} s={1.12} color="#3a614e" />
      <Pine x={307} y={764} s={0.93} />
      <Pine x={1356} y={723} s={1.25} color="#42694f" />
      <Pine x={1298} y={837} s={0.8} color="#527952" />
      <Pine x={12} y={923} s={1.15} />
      <Pine x={1398} y={922} s={1.18} />
      <Shrub x={368} y={645} s={0.7} />
      <Shrub x={845} y={789} s={0.7} />
      <Shrub x={1063} y={690} s={0.55} />
      <Shrub x={1261} y={658} s={0.7} />
      <Shrub x={72} y={870} />
      <g fill="#efd79d">
        {[285, 356, 836, 1054, 1253, 1344].map((x, i) => (
          <g key={x} transform={`translate(${x} ${680 + (i % 3) * 59})`}>
            <path d="M0 0V-12" stroke="#69805a" strokeWidth="2" />
            <circle cy="-14" r="3" />
            <circle cx="4" cy="-12" r="3" />
            <circle cx="-4" cy="-12" r="3" />
          </g>
        ))}
      </g>
      <g fill="#f2d7a1" opacity=".8">
        <path
          d="M352 264q7-8 14 0-7-3-14 0M678 184q7-8 14 0-7-3-14 0M1032 243q7-8 14 0-7-3-14 0"
          stroke="#4e6e60"
          strokeWidth="2"
          fill="none"
        />
      </g>
    </g>
  );
});
interface Props {
  player: Point;
  moving: boolean;
  facing: number;
  crew: Character[];
  activeKey: string;
  target: Point | null;
  onMove: (point: Point) => void;
  onSelect: (character: Character) => void;
}
const CITIZEN_SPOTS: Point[] = [
  { x: 225, y: 552 },
  { x: 450, y: 552 },
  { x: 865, y: 552 },
  { x: 1200, y: 528 },
  { x: 355, y: 650 },
  { x: 510, y: 650 },
  { x: 790, y: 650 },
  { x: 1020, y: 650 },
  { x: 1190, y: 650 },
  { x: 380, y: 800 },
  { x: 525, y: 805 },
  { x: 790, y: 810 },
  { x: 1045, y: 810 },
  { x: 1240, y: 805 },
  { x: 175, y: 790 },
  { x: 920, y: 815 },
  { x: 670, y: 620 },
  { x: 1080, y: 540 },
];
export function Town({
  player,
  moving,
  facing,
  crew,
  activeKey,
  target,
  onMove,
  onSelect,
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
      viewBox="0 0 1400 900"
      aria-label="Grapevine free-roam town. Click the ground to walk or a character to play as them."
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
      <Scenery />
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
