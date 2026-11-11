import { memo } from "react";
import { characterArtUrl } from "../game/art";
import type { CameraView } from "../game/camera";
import {
  residentConversation,
  type ResidentConversation,
  type ResidentWalk,
  type StreetVehicle,
} from "../game/town-life";
import { Modal } from "./Modal";

const RESIDENT_SPRITES = {
  cartman: { width: 53.3, height: 49 },
  stan: { width: 35.9, height: 56 },
  kyle: { width: 40.6, height: 50 },
  kenny: { width: 36.1, height: 49 },
  butters: { width: 34.1, height: 54 },
  wendy: { width: 35.1, height: 52 },
  randy: { width: 33.8, height: 85 },
} satisfies Record<
  ResidentWalk["resident"]["id"],
  { width: number; height: number }
>;

const ResidentArt = memo(function ResidentArt({
  id,
  facing = 1,
  moving = false,
  watching = false,
  heldProp,
}: {
  id: ResidentWalk["resident"]["id"];
  facing?: number;
  moving?: boolean;
  watching?: boolean;
  heldProp?: "snowball" | "map";
}) {
  const { width, height } = RESIDENT_SPRITES[id];
  return (
    <g transform={`scale(${facing} 1)`} aria-hidden="true">
      <g
        className={
          moving ? "resident-steps" : watching ? "resident-watching" : undefined
        }
      >
        <image
          href={characterArtUrl(`resident-${id}`)}
          x={-width / 2}
          y={-height}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMax meet"
        />
        {heldProp === "snowball" && (
          <circle
            cx={width / 2 - 2}
            cy="-10"
            r="3.4"
            fill="#f5f8f3"
            stroke="#acc7cb"
            strokeWidth=".65"
          />
        )}
        {heldProp === "map" && (
          <g transform={`translate(${width / 2 - 4} -10) rotate(12)`}>
            <rect
              x="-4"
              y="-5"
              width="9"
              height="7"
              rx=".7"
              fill="#f1e4c3"
              stroke="#81664e"
              strokeWidth=".7"
            />
            <path
              d="M-2 0l2-3 2 2 1-2"
              fill="none"
              stroke="#a34d49"
              strokeWidth=".65"
            />
          </g>
        )}
      </g>
    </g>
  );
});

export function TownResident({
  walker,
  camera,
  onTalk,
}: {
  walker: ResidentWalk;
  camera: CameraView;
  onTalk: (conversation: ResidentConversation) => void;
}) {
  const { x, y, resident, path, facing, watching } = walker;
  const moving = path.length > 0 && !watching;
  const talk = () => onTalk(residentConversation(walker));
  const { width, height } = RESIDENT_SPRITES[resident.id];
  const centerY = y - height / 2;
  const inView =
    x >= camera.x &&
    x <= camera.x + camera.width &&
    centerY >= camera.y &&
    centerY <= camera.y + camera.height;
  const nameWidth = resident.label.length * 5.1 + 15;
  return (
    <g
      className="world-citizen town-resident"
      transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
      role="button"
      aria-label={`Talk to ${resident.name}`}
      tabIndex={inView ? 0 : -1}
      data-resident={resident.id}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        talk();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          talk();
        }
      }}
    >
      <TownShadow rx={width * 0.47} ry={4.6} y={1} />
      <ResidentArt
        id={resident.id}
        facing={facing}
        moving={moving}
        watching={watching}
        heldProp={
          !moving && !watching ? resident.stops[walker.stop].prop : undefined
        }
      />
      <g className="nameplate" transform="translate(0 12)">
        <rect
          x={-nameWidth / 2}
          y="-7"
          width={nameWidth}
          height="14"
          rx="6"
          fill="#f2eee3"
        />
        <text
          y="3"
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill="#454945"
        >
          {resident.label}
        </text>
      </g>
    </g>
  );
}

export function ResidentDialogue({
  conversation,
  onClose,
}: {
  conversation: ResidentConversation;
  onClose: () => void;
}) {
  const { resident, activity, line } = conversation;
  const { width, height } = RESIDENT_SPRITES[resident.id];
  return (
    <Modal
      title={resident.name}
      eyebrow={activity}
      className="game-modal resident-dialogue"
      onClose={onClose}
    >
      <div className="resident-dialogue-line">
        <svg
          viewBox={`${-width / 2 - 4} ${-height - 4} ${width + 8} ${height + 8}`}
          aria-hidden="true"
        >
          <ResidentArt id={resident.id} />
        </svg>
        <p>{line}</p>
      </div>
      <button className="button primary full-width" onClick={onClose}>
        Back to town
      </button>
    </Modal>
  );
}

export function TownShadow({
  x = 0,
  y = 0,
  rx,
  ry,
}: {
  x?: number;
  y?: number;
  rx: number;
  ry: number;
}) {
  return (
    <ellipse
      cx={x}
      cy={y}
      rx={rx}
      ry={ry}
      fill="url(#town-ground-shadow)"
      pointerEvents="none"
      aria-hidden="true"
    />
  );
}

const VehicleArt = memo(function VehicleArt({
  style,
  color,
}: Pick<StreetVehicle, "style" | "color">) {
  if (style === "drummer" || style === "flag-bearer") {
    const drummer = style === "drummer";
    return (
      <g className="paper-person walking">
        <path d="M-11-20v17M8-20v17" stroke="#2d3840" strokeWidth="8" />
        <path
          d="M-18-2h12M4-2h12"
          stroke="#283137"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d="M-12-42h24l6 24h-36Z" fill={color} />
        <path d="M-10-41l21 20" stroke="#f2d79e" strokeWidth="4" />
        <ellipse cy="-48" rx="14" ry="13" fill="#edc6a4" />
        <path d="M-15-54l2-12h25l3 12Z" fill={color} />
        <path d="M-15-54h31" stroke="#ebcf8d" strokeWidth="3" />
        <circle cx="1" cy="-49" r="1.5" fill="#292635" />
        <circle cx="8" cy="-49" r="1.5" fill="#292635" />
        {drummer ? (
          <>
            <rect
              x="6"
              y="-29"
              width="22"
              height="15"
              rx="3"
              fill="#c26849"
              stroke="#644240"
              strokeWidth="1.5"
            />
            <ellipse cx="17" cy="-29" rx="11" ry="3.5" fill="#f0deb7" />
            <path
              d="M10-24l4 8 5-8 5 7M8-37l12 7"
              stroke="#f1d49f"
              fill="none"
              strokeWidth="1.5"
            />
          </>
        ) : (
          <>
            <path d="M17-75v61" stroke="#76573e" strokeWidth="3" />
            <path d="M18-74q-12 7-32 0l7 12-7 7q19 5 32-1Z" fill="#d8b95c" />
            <path
              d="M-1-71v13m-6-10 12 7m0-7-12 7"
              stroke="#fff3cf"
              strokeWidth="1.5"
            />
          </>
        )}
      </g>
    );
  }
  if (style === "float") {
    return (
      <>
        <Wheels spacing={68} />
        <path d="M-108-32h216v21h-216Z" fill="#353e46" />
        <path
          d="M-109-35h218v17q-12 5-23 0-12 6-24 0-12 6-24 0-12 6-24 0-12 6-24 0-12 6-24 0-12 6-24 0-12 6-24 0-12 5-23 0Z"
          fill={color}
          stroke="#243e3a"
          strokeWidth="2"
        />
        <path d="M-107-34q24-8 46-4t49-2q23 3 47-2 45-4 73 8Z" fill="#f4f4e4" />
        <path
          d="M-94-41l19-30 18 30m-25 0 23-46 27 46M39-40l22-38 23 38m-11 0 17-26 14 26"
          fill="#4c7e67"
          stroke="#d5e4d5"
          strokeWidth="2"
        />
        <path
          d="M-18-62l-21-13m58 12 22-14"
          fill="none"
          stroke="#745545"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <ellipse
          cy="-55"
          rx="24"
          ry="18"
          fill="#edf4ee"
          stroke="#b5c8c1"
          strokeWidth="2"
        />
        <circle
          cy="-81"
          r="16"
          fill="#f9f8ea"
          stroke="#b5c8c1"
          strokeWidth="2"
        />
        <path
          d="M-16-71q16 7 32 0v6q-16 8-32 0Zm23 6 11 12 4-6-8-10"
          fill="#b94a45"
        />
        <path
          d="M-19-91h38M-12-92v-13h24v13"
          fill="#34333c"
          stroke="#34333c"
          strokeWidth="3"
        />
        <path d="M2-80l15 3-15 2Z" fill="#db8953" />
        <path
          d="M-4-83h.1m10 0h.1M0-56h.1m0 7h.1"
          stroke="#393238"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect
          x="-54"
          y="-37"
          width="108"
          height="19"
          rx="3"
          fill="#f3ddaa"
          stroke="#a17a47"
          strokeWidth="1.5"
        />
        <text
          y="-24"
          textAnchor="middle"
          fontSize="10"
          fontWeight="800"
          fill="#65423b"
        >
          WINTER PARADE
        </text>
        <path
          d="M-99-25h.1m10 0h.1m10 0h.1m10 0h.1m138 0h.1m10 0h.1m10 0h.1m10 0h.1"
          stroke="#f5d28d"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </>
    );
  }
  if (style === "bus") {
    return (
      <>
        <path
          d="M-84-49q0-8 9-8h128q8 0 9 8l4 12h16q8 0 8 8v14q0 6-7 6H-81l-6-9Z"
          fill={color}
          stroke="#65503a"
          strokeWidth="1.4"
        />
        <path
          d="M-86-32H62m-148 6H64M-88-12h174"
          stroke="#51493f"
          strokeWidth="3"
        />
        <path d="M-74-50h128l5 14H-74Z" fill="#61757b" />
        <path
          d="M-56-50v14m20-14v14m20-14v14m20-14v14m20-14v14m20-14v14"
          stroke="#dca44e"
          strokeWidth="2.5"
        />
        <path
          d="M57-34v22H38v-22"
          fill="none"
          stroke="#725a43"
          strokeWidth="1.5"
        />
        <rect x="79" y="-29" width="10" height="5" rx="2" fill="#fff2bc" />
        <Wheels spacing={55} />
      </>
    );
  }
  const pickup = style === "pickup";
  const wagon = style === "wagon" || style === "marshal";
  return (
    <>
      <path
        d={
          pickup
            ? "M-63-28h43l9-18h30l18 17 20 2q8 1 8 9v8h-130v-13q0-5 2-5Z"
            : wagon
              ? "M-64-29l7-17h66l22 17 25 3q9 1 9 10v6h-129q-4-5 0-19Z"
              : "M-61-27l19-4 20-15h33l25 17 21 3q8 2 8 10v6H-64q-3-10 3-17Z"
        }
        fill={color}
        stroke="#3d4048"
        strokeWidth="1.35"
      />
      <path
        d={
          pickup
            ? "M-16-30l7-12h27l14 12Z"
            : wagon
              ? "M-58-30l5-12H8l18 12Z"
              : "M-37-30l17-12H10l18 12Z"
        }
        fill="#a2b8c0"
      />
      <path
        d="M2-42v12m10 3h6m-62 3h90"
        stroke="#4c5057"
        strokeOpacity=".65"
        fill="none"
        strokeWidth="1.7"
      />
      <path d="M-64-13h128" stroke="#46464c" strokeWidth="2.8" />
      <path
        d="M55-23h7"
        stroke="#fff0bd"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M-63-23h6"
        stroke="#a94743"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {style === "marshal" && (
        <>
          <rect
            x="-17"
            y="-52"
            width="27"
            height="6"
            rx="3"
            fill="#f6cb73"
            stroke="#a07043"
            strokeWidth="1.5"
          />
          <path
            d="M-3-53v-5m-13 5-3-3m28 3 4-3"
            stroke="#f9dc88"
            strokeWidth="2"
          />
          <rect x="-26" y="-23" width="48" height="10" rx="2" fill="#fae3b5" />
          <text
            x="-2"
            y="-15.5"
            textAnchor="middle"
            fontSize="7"
            fontWeight="800"
            fill="#763c36"
          >
            PARADE
          </text>
        </>
      )}
      <Wheels spacing={39} />
    </>
  );
});

function Wheels({ spacing }: { spacing: number }) {
  return (
    <g fill="#35343d" stroke="#565762" strokeWidth="1.2">
      <circle cx={-spacing} cy="-9" r="9" />
      <circle cx={spacing} cy="-9" r="9" />
      <path
        d={`M${-spacing}-9h.1m${2 * spacing} 0h.1`}
        stroke="#c4c3ba"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </g>
  );
}

export function TownVehicle({ vehicle }: { vehicle: StreetVehicle }) {
  const { x, y, facing, style, color, id } = vehicle;
  const onFoot = style === "drummer" || style === "flag-bearer";
  const scale = onFoot || style === "float" ? 0.86 : 0.91;
  return (
    <g
      transform={`translate(${x.toFixed(2)} ${y}) scale(${facing * scale} ${scale})`}
      pointerEvents="none"
      aria-hidden="true"
      data-vehicle={style}
      data-parade={id.startsWith("parade-") || undefined}
    >
      <TownShadow
        y={1}
        rx={style === "float" ? 103 : onFoot ? 18 : style === "bus" ? 86 : 63}
        ry={onFoot ? 4.5 : 10}
      />
      <VehicleArt style={style} color={color} />
    </g>
  );
}
