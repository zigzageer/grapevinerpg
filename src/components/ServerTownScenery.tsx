import { memo } from "react";
import type {
  ServerBuilding,
  ServerLandmark,
  ServerTown,
} from "../game/server-town";

const facades: Record<
  ServerBuilding["kind"],
  { wall: string; roof: string; trim: string }
> = {
  hall: { wall: "#d6b681", roof: "#536173", trim: "#f0d8a0" },
  shop: { wall: "#dbb19a", roof: "#794e57", trim: "#f5dbae" },
  venue: { wall: "#b4a8c2", roof: "#514961", trim: "#eadbe2" },
  workshop: { wall: "#bba687", roof: "#4d6a64", trim: "#ebd0a4" },
  house: { wall: "#d0b991", roof: "#70624e", trim: "#f3d5a9" },
};
const grapevineFacades: Record<
  string,
  (typeof facades)[ServerBuilding["kind"]]
> = {
  "chud-cafe": { wall: "#caa98d", roof: "#74494c", trim: "#edd6b5" },
  "looksmaxxing-gym": { wall: "#959a9d", roof: "#454855", trim: "#d9e395" },
  "iranian-bazaar": { wall: "#b5c4a5", roof: "#397b79", trim: "#d2ead2" },
  "israeli-market": { wall: "#e0c79e", roof: "#5b769d", trim: "#eff0df" },
  "incel-arcade": { wall: "#a698bd", roof: "#4e416f", trim: "#f1bcdf" },
  "netanyahu-press-room": { wall: "#9eafbe", roof: "#47556f", trim: "#e0e5db" },
  "clan-hall": { wall: "#ab93aa", roof: "#594365", trim: "#dce9a6" },
};

function Building({
  building,
  accent,
  grapevine,
}: {
  building: ServerBuilding;
  accent: string;
  grapevine: boolean;
}) {
  const { x, y, w, h, kind, door, label, art } = building;
  const colors = (grapevine && grapevineFacades[building.id]) || facades[kind];
  const doorX = Math.max(23, Math.min(217, ((door.x - x) / w) * 240));
  const fontSize = Math.min(17, 320 / label.length);
  return (
    <g data-building={building.id}>
      <rect
        x={x + 8}
        y={y + 12}
        width={w + 8}
        height={h}
        rx={8}
        fill="#211d2b"
        opacity=".25"
      />
      <path
        d={`M${door.x} ${y + h - 2}V${door.y + 10}`}
        stroke="#e5c99e"
        strokeWidth={28}
        strokeLinecap="round"
      />
      <svg
        x={x}
        y={y}
        width={w}
        height={h}
        viewBox="0 0 240 160"
        preserveAspectRatio="none"
      >
        <rect
          x="4"
          y="43"
          width="232"
          height="115"
          rx="4"
          fill={colors.wall}
          stroke="#423a42"
          strokeWidth="3"
        />
        <path
          d="M1 45 30 8H210l29 37v12H1Z"
          fill={colors.roof}
          stroke="#393442"
          strokeWidth="3"
        />
        <path
          d="M35 16h170m-177 9h184m-193 9h202"
          stroke="#f9ead0"
          strokeOpacity=".23"
          strokeWidth="2"
        />
        {grapevine && building.id === "iranian-bazaar" && (
          <path
            d="m45 29 9-9 9 9-9 9Zm42 0 9-9 9 9-9 9Zm42 0 9-9 9 9-9 9Zm42 0 9-9 9 9-9 9Z"
            fill="none"
            stroke="#d2ead2"
            strokeWidth="2"
          />
        )}
        {grapevine && building.id === "israeli-market" && (
          <path d="M22 39h196M27 31h186" stroke="#e6f2f1" strokeWidth="3" />
        )}
        <path
          d="M7 65h226m-226 66h226m-226 20h226"
          stroke="#6b5552"
          strokeOpacity=".3"
          strokeWidth="2"
        />
        {[24, 79, 134, 189].map((left) => (
          <g key={left}>
            <rect
              x={left}
              y="79"
              width="27"
              height="39"
              rx="4"
              fill="#3b4858"
              stroke={colors.trim}
              strokeWidth="4"
            />
            <path
              d={`M${left + 13.5} 82v33m-12-16h24`}
              stroke="#f4deac"
              strokeOpacity=".65"
            />
          </g>
        ))}
        <path
          d={`M${doorX - 17} 159v-38a17 17 0 0 1 34 0v38Z`}
          fill="#394350"
          stroke={colors.trim}
          strokeWidth="4"
        />
        <circle cx={doorX + 9} cy="139" r="2.7" fill={accent} />
        {art && (
          <image
            href={art}
            width="240"
            height="160"
            preserveAspectRatio="xMidYMax slice"
          />
        )}
        <rect
          x="12"
          y="45"
          width="216"
          height="27"
          rx="5"
          fill="#343644"
          stroke={accent}
          strokeWidth="2"
        />
        <text
          x="120"
          y="64"
          textAnchor="middle"
          fill="#fff0d0"
          fontSize={fontSize}
          fontWeight="700"
        >
          {label}
        </text>
      </svg>
    </g>
  );
}

function Landmark({
  place,
  accent,
}: {
  place: ServerLandmark;
  accent: string;
}) {
  const { x, y, kind, label } = place;
  return (
    <g transform={`translate(${x} ${y})`} data-landmark={place.id}>
      <ellipse rx="52" ry="23" cy="-3" fill="#3e4038" opacity=".24" />
      {kind === "plaza" ? (
        <>
          <ellipse
            rx="44"
            ry="21"
            cy="-11"
            fill="#e1ceb1"
            stroke="#4f595b"
            strokeWidth="3"
          />
          <ellipse rx="33" ry="13" cy="-15" fill="#86aeb3" />
          <path
            d="M0-16v-30m0 13q-13-20-21 4m21-4q13-20 21 4"
            fill="none"
            stroke="#f6eee0"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : kind === "garden" ? (
        <>
          <rect
            x="-44"
            y="-33"
            width="88"
            height="30"
            rx="10"
            fill="#546859"
            stroke="#ead6aa"
            strokeWidth="3"
          />
          {[-29, -8, 16, 34].map((left, index) => (
            <circle
              key={left}
              cx={left}
              cy={-37 - (index % 2) * 7}
              r={13}
              fill={index % 2 ? "#8c9a66" : "#617b5d"}
              stroke="#455949"
              strokeWidth="2"
            />
          ))}
        </>
      ) : (
        <>
          <path
            d="M-48-8v-50H48v50"
            fill="#4e485e"
            stroke="#d4b580"
            strokeWidth="4"
          />
          <path d="M-39-47h78M-47-10h94" stroke={accent} strokeWidth="6" />
          <path
            d="M-18-31v15m18-24v24m18-15v15"
            stroke="#d7b9d8"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      )}
      <text
        y="20"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="#2a2933"
        stroke="#eed8aa"
        strokeWidth="3"
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  );
}

export const ServerTownScenery = memo(function ServerTownScenery({
  town,
}: {
  town: ServerTown;
}) {
  const { width, height, roads, buildings, landmarks, palette } = town;
  return (
    <g className="server-town-scenery" data-testid="server-town-scenery">
      <defs>
        <pattern
          id="server-town-paper"
          width="23"
          height="23"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M2 18h3m8-14h4m2 10h1"
            stroke="#332c38"
            strokeOpacity=".12"
            strokeWidth="1"
          />
        </pattern>
        <pattern
          id="server-town-paving"
          width="40"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 0h40m0 14H0M20 0v14m10 0v14M10 14v14"
            stroke="#f3dbb2"
            strokeOpacity=".2"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={palette.ground} />
      <rect width={width} height={height} fill="url(#server-town-paper)" />
      <g stroke="#e5cca0" strokeWidth="19" fill={palette.road}>
        {roads.map(({ x, y, w, h }, i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="9" />
        ))}
      </g>
      <g fill={palette.road}>
        {roads.map(({ x, y, w, h }, i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="5" />
        ))}
      </g>
      {roads.map(({ x, y, w, h }, i) => (
        <g key={i}>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx="5"
            fill="url(#server-town-paving)"
          />
          <path
            d={
              w >= h
                ? `M${x + 12} ${y + h / 2}h${w - 24}`
                : `M${x + w / 2} ${y + 12}v${h - 24}`
            }
            stroke="#f4d68f"
            strokeOpacity=".45"
            strokeWidth="2"
            strokeDasharray="18 22"
          />
        </g>
      ))}
      {buildings.map((building) => (
        <Building
          key={building.id}
          building={building}
          accent={palette.accent}
          grapevine={town.name === "Grapevine"}
        />
      ))}
      {landmarks.map((place) => (
        <Landmark key={place.id} place={place} accent={palette.accent} />
      ))}
    </g>
  );
});
