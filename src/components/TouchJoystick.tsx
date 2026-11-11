import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Point } from "../game/model";

const ZERO = { x: 0, y: 0 };
export function TouchJoystick({
  onMove,
  disabled,
  resetKey,
}: {
  onMove: (vector: Point) => void;
  disabled: boolean;
  resetKey: string;
}) {
  const root = useRef<HTMLDivElement>(null),
    pointer = useRef<number | null>(null),
    move = useRef(onMove),
    tap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [knob, setKnob] = useState(ZERO);
  move.current = onMove;
  const reset = useCallback(() => {
    pointer.current = null;
    setKnob(ZERO);
    move.current(ZERO);
    clearTimeout(tap.current);
  }, []);
  useEffect(() => {
    reset();
  }, [disabled, resetKey, reset]);
  useEffect(
    () => () => {
      move.current(ZERO);
      clearTimeout(tap.current);
    },
    [],
  );
  const track = (event: PointerEvent<HTMLDivElement>) => {
    const box = root.current!.getBoundingClientRect(),
      radius = box.width * 0.3;
    const dx = event.clientX - box.x - box.width / 2,
      dy = event.clientY - box.y - box.height / 2;
    const length = Math.hypot(dx, dy),
      limit = Math.max(1, length / radius),
      x = dx / limit,
      y = dy / limit;
    setKnob({ x, y });
    move.current(
      length < radius * 0.15 ? ZERO : { x: x / radius, y: y / radius },
    );
  };
  return (
    <div
      ref={root}
      className={`touch-joystick ${pointer.current !== null ? "engaged" : ""}`}
      role="group"
      aria-label="Movement joystick"
      onPointerDown={(e) => {
        if (disabled || pointer.current !== null) return;
        e.preventDefault();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        track(e);
      }}
      onPointerMove={(e) => {
        if (pointer.current === e.pointerId) track(e);
      }}
      onPointerUp={(e) => {
        if (pointer.current === e.pointerId) reset();
      }}
      onPointerCancel={(e) => {
        if (pointer.current === e.pointerId) reset();
      }}
      onLostPointerCapture={(e) => {
        if (pointer.current === e.pointerId) reset();
      }}
    >
      <span className="joystick-ring" />
      {[
        { label: "Move up", x: 0, y: -1, Icon: ChevronUp, key: "north" },
        { label: "Move down", x: 0, y: 1, Icon: ChevronDown, key: "south" },
        { label: "Move left", x: -1, y: 0, Icon: ChevronLeft, key: "west" },
        { label: "Move right", x: 1, y: 0, Icon: ChevronRight, key: "east" },
      ].map(({ label, x, y, Icon, key }) => (
        <button
          key={key}
          className={`joystick-direction ${key}`}
          aria-label={label}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              setKnob({ x: x * 32, y: y * 32 });
              move.current({ x, y });
            }
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              reset();
            }
          }}
          onBlur={reset}
          onClick={(e) => {
            if (e.detail === 0) {
              setKnob({ x: x * 32, y: y * 32 });
              move.current({ x, y });
              clearTimeout(tap.current);
              tap.current = setTimeout(reset, 180);
            }
          }}
        >
          <Icon size={16} />
        </button>
      ))}
      <span
        className="joystick-knob"
        style={{ transform: `translate(${knob.x}px,${knob.y}px)` }}
      />
    </div>
  );
}
