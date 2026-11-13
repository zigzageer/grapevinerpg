import { memo } from "react";
import { uiArtUrl } from "../game/art";
import type { Character, Point } from "../game/model";
import { CharacterArt } from "./Character";
import "../town-fight.css";

export type TownFight = Point & {
  id: string;
  fighters: readonly [Character, Character];
};

export const TownFightMarker = memo(function TownFightMarker({
  fight,
}: {
  fight: TownFight;
}) {
  const [first, second] = fight.fighters;
  return (
    <g
      className="town-fight"
      data-testid="town-fight"
      data-fight-id={fight.id}
      role="img"
      aria-label={`Fight in progress: ${first.name} vs ${second.name}`}
      transform={`translate(${fight.x} ${fight.y})`}
    >
      <g aria-hidden="true">
        <ellipse cy="-3" rx="55" ry="8" fill="#26323a" opacity=".39" />
        <g transform="translate(-90 -82) scale(.47)">
          <g className="town-fight-cutout">
            <CharacterArt c={first} portrait />
          </g>
        </g>
        <g transform="translate(90 -82) scale(-.47 .47)">
          <g className="town-fight-cutout second">
            <CharacterArt c={second} portrait />
          </g>
        </g>
        <g className="town-fight-cloud">
          <path
            d="M-55-15C-68-19-70-34-59-41C-66-51-57-63-44-60C-44-72-29-80-17-70C-12-82 7-83 16-71C27-80 45-72 44-60C58-64 69-52 63-42C75-36 71-21 58-16C57-5 43-2 34-8C28 1 13 1 6-7C-5 3-20 1-26-8C-36 0-52-3-55-15Z"
            fill="#fff3d8"
            stroke="#4c3b53"
            strokeWidth="3"
          />
          <path
            d="M-59-26C-50-13-37-14-29-21C-22-12-6-10 5-19C14-10 29-11 35-20C45-15 55-18 62-27C65-19 57-14 55-14C54-7 42-5 34-11C26-1 13-3 6-10C-5 1-19-1-25-11C-35-3-51-5-53-17C-57-18-60-22-59-26Z"
            fill="#e8cde3"
          />
        </g>
        <image
          className="town-fight-flash"
          href={uiArtUrl("impact")}
          x="-36"
          y="-72"
          width="73"
          height="68"
        />
        <g
          className="town-fight-puffs"
          fill="#fbe5ef"
          stroke="#684959"
          strokeWidth="1.6"
        >
          <circle cx="-65" cy="-59" r="5.2" />
          <circle cx="-74" cy="-67" r="3" />
          <circle cx="65" cy="-62" r="5.8" />
          <circle cx="75" cy="-71" r="3.2" />
        </g>
        <rect
          x="-70"
          y="2"
          width="140"
          height="20"
          rx="10"
          fill="#493649"
          stroke="#ffc16e"
          strokeWidth="1.5"
        />
        <text
          className="town-fight-label"
          y="16"
          textAnchor="middle"
          fill="#fff3d8"
        >
          {first.name.slice(0, 9)} vs {second.name.slice(0, 9)}
        </text>
      </g>
    </g>
  );
});
