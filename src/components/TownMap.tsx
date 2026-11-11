import { ArrowUpRight, MapPin } from "lucide-react";
import type { Point } from "../game/model";
import { LOCATIONS, TOWN_NAME, WORLD } from "../game/locations";
import { Modal } from "./Modal";

export function TownMap({
  player,
  onWalk,
  onClose,
  townName = TOWN_NAME,
}: {
  player: Point;
  onWalk: (point: Point) => void;
  onClose: () => void;
  townName?: string;
}) {
  return (
    <Modal
      title={townName}
      eyebrow="TOWN MAP"
      className="game-modal town-map-modal"
      onClose={onClose}
    >
      <p className="town-map-intro">
        Choose a place to walk there. Use the thumbstick or keyboard to take
        over.
      </p>
      <div className="town-map-layout">
        <div className="town-map-paper">
          <svg
            viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
            aria-hidden="true"
          >
            <rect
              width={WORLD.width}
              height={WORLD.height}
              rx="40"
              fill="#e4ece9"
            />
            <path
              d="M0 595H2400M0 1265H2400M0 1995H2400M2175 530V2100"
              stroke="#a3b3ac"
              strokeWidth="130"
            />
            <path
              d="M0 595H2400M0 1265H2400M0 1995H2400M2175 530V2100"
              stroke="#e9efe7"
              strokeWidth="5"
              strokeDasharray="35 24"
            />
            {LOCATIONS.map((l, i) => (
              <g key={l.id}>
                <rect
                  x={l.footprint.x}
                  y={l.footprint.y}
                  width={l.footprint.w}
                  height={l.footprint.h}
                  rx="18"
                  fill={i < 3 ? "#b99e7d" : i < 5 ? "#b6b493" : "#93a98c"}
                  stroke="#768e7c"
                  strokeWidth="8"
                />
                <circle
                  cx={l.entrance.x}
                  cy={l.entrance.y}
                  r="70"
                  fill="#345e49"
                  stroke="#edf2d7"
                  strokeWidth="10"
                />
                <text
                  x={l.entrance.x}
                  y={l.entrance.y + 21}
                  textAnchor="middle"
                  fontSize="64"
                  fontWeight="700"
                  fill="#fff9df"
                >
                  {i + 1}
                </text>
              </g>
            ))}
            <circle
              cx={player.x}
              cy={player.y}
              r="53"
              fill="#edf5aa"
              stroke="#203f31"
              strokeWidth="14"
            />
            <circle cx={player.x} cy={player.y} r="17" fill="#203f31" />
          </svg>
          <span>
            <MapPin size={14} /> You are here
          </span>
        </div>
        <div
          className="town-map-places"
          role="group"
          aria-label="Town destinations"
        >
          {LOCATIONS.map((l, i) => (
            <button
              key={l.id}
              onClick={() => onWalk(l.entrance)}
              aria-label={`Walk to ${l.name}`}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{l.shortName || l.name}</strong>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
