import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Armchair,
  Baby,
  Banknote,
  Candy,
  CarFront,
  CircleDot,
  CircleStop,
  Coffee,
  Croissant,
  Cross,
  Cylinder,
  Dog,
  Drill,
  Droplets,
  Drumstick,
  Flag,
  Flame,
  Footprints,
  Gem,
  GraduationCap,
  Heart,
  HeartPlus,
  MessageCircleMore,
  Moon,
  PartyPopper,
  PawPrint,
  Sandwich,
  Shield,
  Snowflake,
  Sparkles,
  Sword,
  Swords,
  Syringe,
  UsersRound,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { abilityArtUrl, sceneryArtUrl, uiArtUrl } from "../game/art";
import {
  battleReducer,
  createBattle,
  getMove,
  GOOD_WINDOW,
  isBasicMove,
  MOVES,
  PERFECT_WINDOW,
  TIMING_DURATION,
  TIMING_TARGET,
  timingGrade,
  type AbilityVisual,
  type BasicMoveId,
  type BattleAction,
  type BattleEvent,
  type BattleState,
  type Fighter,
  type MoveId,
  type SignatureMoveId,
  type Side,
  type TimingGrade,
} from "../game/combat";
import {
  characterScale,
  DEFAULT_CREW,
  GRACE,
  JAT,
  type Character,
} from "../game/model";
import { BabasharkEffects } from "./BabasharkEffects";
import { CharacterArt } from "./Character";
import "../cast-battle.css";

interface Props {
  actor: Character;
  other: Character;
  crew?: Character[];
  onBack: () => void;
  onClose: () => void;
}

const IMPACT_DURATION = 850;
const IMPACT_CUES: Partial<Record<AbilityVisual, readonly [number, number]>> = {
  grace: [1920, 0.55],
  "tag-team": [1430, 0.5],
  "diddy-party": [1860, 0.48],
  "kick-the-baby": [1720, 0.58],
  "simps-assemble": [1700, 0.59],
  chaz: [2150, 0.71],
  "diarrhea-spray": [1270, 0.37],
  "needle-toss": [1240, 0.54],
  "fleshlight-volley": [1350, 0.54],
  "drill-rush": [1390, 0.53],
  "first-aid": [1110, 0.46],
};
const GENESIS = DEFAULT_CREW.find(
  (character) => character.preset === "genesis",
)!;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function affectsActor(event: BattleEvent) {
  return (
    event.move === "burn" ||
    event.move === "stun" ||
    event.move === "sleep" ||
    event.move === "snack" ||
    event.visual === "simps-assemble" ||
    event.visual === "first-aid"
  );
}

function Cutout({
  character,
  mirrored = false,
  moving = false,
}: {
  character: Character;
  mirrored?: boolean;
  moving?: boolean;
}) {
  const scale = characterScale(character);
  return (
    <svg
      className="battle-cutout"
      viewBox={`${75 - 117 * scale} ${180 - 189 * scale} ${234 * scale} ${198 * scale}`}
      aria-hidden="true"
    >
      <g transform={mirrored ? "translate(150 0) scale(-1 1)" : undefined}>
        <CharacterArt c={character} moving={moving} />
      </g>
    </svg>
  );
}

function Art({ src, fallback }: { src: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    fallback
  ) : (
    <img src={src} alt="" draggable={false} onError={() => setFailed(true)} />
  );
}

function battleAbilityArt(url?: string) {
  const bundled = url?.match(/^\/abilities\/([\w-]+)\.webp$/)?.[1];
  return bundled ? abilityArtUrl(bundled) : url;
}

function BattleMeter({
  fighter,
  kind,
  previous,
}: {
  fighter: Fighter;
  kind: "health" | "power";
  previous?: number;
}) {
  const health = kind === "health";
  const amount = health ? fighter.hp : fighter.pp;
  const maximum = health ? fighter.maxHp : fighter.maxPp;
  return (
    <div className={`battle-meter fighter-${kind}`}>
      <span className="battle-meter-label" aria-hidden="true">
        {health ? "HP" : "PP"}
      </span>
      <div
        className="battle-meter-track"
        role="meter"
        aria-label={`${fighter.name} ${kind}`}
        aria-valuemin={0}
        aria-valuemax={maximum}
        aria-valuenow={amount}
      >
        <span
          className="battle-meter-fill"
          style={{ width: `${(amount / maximum) * 100}%` }}
        />
        <b
          aria-hidden="true"
          data-arriving={previous !== undefined || undefined}
        >
          {amount}
          <small> / {maximum}</small>
        </b>
        {previous !== undefined && (
          <b aria-hidden="true" data-previous>
            {previous}
            <small> / {maximum}</small>
          </b>
        )}
      </div>
    </div>
  );
}

function FighterStatus({
  fighter,
  character,
  side,
  active,
  guarding = false,
  previousHealth,
}: {
  fighter: Fighter;
  character: Character;
  side: Side;
  active: boolean;
  guarding?: boolean;
  previousHealth?: number;
}) {
  const scale = characterScale(character);
  return (
    <section
      className={`fighter-status ${side}`}
      aria-label={fighter.name}
      data-active={active || undefined}
    >
      <div className="battle-portrait" aria-hidden="true">
        <svg
          viewBox={`${75 - 62 * scale} ${180 - 182 * scale} ${124 * scale} ${124 * scale}`}
        >
          <CharacterArt c={character} portrait />
        </svg>
      </div>
      <div className="battle-vitals">
        <strong className="fighter-name" title={fighter.name}>
          {fighter.name}
        </strong>
        <BattleMeter
          fighter={fighter}
          kind="health"
          previous={previousHealth}
        />
        <BattleMeter fighter={fighter} kind="power" />
      </div>
      <div className="fighter-effects">
        <span
          title={`Armor ${fighter.armor}`}
          aria-label={`Armor ${fighter.armor}`}
        >
          <Shield size={12} /> {fighter.armor}
        </span>
        {fighter.burning > 0 && (
          <span>
            <Flame size={12} /> Burning {fighter.burning}
          </span>
        )}
        {fighter.stunned && (
          <span>
            <Zap size={12} /> Stunned
          </span>
        )}
        {fighter.asleep && (
          <span>
            <Moon size={12} /> Asleep
          </span>
        )}
        {guarding && (
          <span>
            <Shield size={12} /> Braced
          </span>
        )}
      </div>
    </section>
  );
}

function stageMotion(
  event: BattleEvent | null,
  side: Side,
  character: Character,
) {
  if (!event) return;
  if (event.actor !== side) {
    if (event.slept) return "fall-asleep";
    if (event.damage <= 0 || affectsActor(event)) return;
    return side === "player" && event.grade !== "miss" ? "guard" : "hit";
  }
  const motion = event.visual ?? event.move;
  if (
    character.preset === "kawaiikitty" &&
    !character.sprite &&
    (motion === "quick" || motion === "heavy" || motion === "rush")
  )
    return "chair-charge";
  return motion;
}

const SIGNATURE_ICONS: Partial<
  Record<NonNullable<Character["preset"]>, LucideIcon>
> = {
  "baguette-guy": Croissant,
  "flag-girl": Flag,
  ghost: Sandwich,
  rocky: GraduationCap,
  miel: Wine,
  jat: Coffee,
  loralei: Footprints,
  samira: Heart,
  genesis: Dog,
  kain: Zap,
  footjobofsteel: PawPrint,
  steakbutterfan: Sandwich,
  semi: Drumstick,
  milka: Flag,
  grace: Heart,
  tommy: Footprints,
  "red-light": CircleStop,
  peaches: PawPrint,
  lin: Baby,
  bashu: Gem,
  orrow: MessageCircleMore,
  potato: CircleDot,
  kawaiikitty: Armchair,
};

function signatureIcon(
  character: Character,
  visual?: BattleEvent["visual"],
): LucideIcon {
  if (visual === "grace") return Heart;
  if (visual === "tag-team") return UsersRound;
  if (visual === "diddy-party") return PartyPopper;
  if (visual === "kick-the-baby") return Baby;
  if (visual === "simps-assemble") return Banknote;
  if (visual === "chaz") return CarFront;
  if (visual === "diarrhea-spray") return Droplets;
  if (visual === "needle-toss") return Syringe;
  if (visual === "fleshlight-volley") return Cylinder;
  if (visual === "drill-rush") return Drill;
  if (visual === "first-aid") return HeartPlus;
  if (character.kind === "mint") return Candy;
  const preset =
    character.preset ??
    DEFAULT_CREW.find(({ id }) => id === character.id)?.preset;
  return (preset && SIGNATURE_ICONS[preset]) || Sparkles;
}

function CastAbilityEffect({
  event,
  art,
  Icon,
}: {
  event: BattleEvent;
  art?: string;
  Icon: LucideIcon;
}) {
  switch (event.visual) {
    case "diarrhea-spray":
      return (
        <div className="zippy-spray">
          <span>{art ? <Art src={art} fallback={<Icon />} /> : <Icon />}</span>
        </div>
      );
    case "needle-toss":
    case "fleshlight-volley":
      return Array.from({ length: event.hits ?? 1 }, (_, index) => (
        <span
          className="zippy-throw"
          key={index}
          style={{ "--throw-index": index } as CSSProperties}
        >
          {art ? <Art src={art} fallback={<Icon />} /> : <Icon />}
        </span>
      ));
    case "drill-rush":
      return <Zap className="nurse-drill-impact" />;
    case "first-aid":
      return (
        <div className="nurse-first-aid">
          <HeartPlus />
          <Cross />
          <Cross />
        </div>
      );
    default:
      return null;
  }
}

function BattleEffects({
  event,
  crew,
  source,
}: {
  event: BattleEvent;
  crew?: Character[];
  source: Character;
}) {
  const self = affectsActor(event);
  const hit = !self && event.damage > 0;
  const mirrored = event.actor === "opponent";
  const blocked =
    (hit || event.visual === "diddy-party") &&
    mirrored &&
    event.grade !== "miss";
  const grade =
    hit &&
    (mirrored
      ? { perfect: "Perfect block!", good: "Blocked!", miss: "" }[event.grade]
      : { perfect: "Perfect!", good: "", miss: "Off beat" }[event.grade]);
  const findGuest = (fallback: Character) =>
    crew?.find(
      (character) =>
        character.id === fallback.id || character.preset === fallback.preset,
    ) ?? fallback;
  const art = battleAbilityArt(event.art);
  const targetArt =
    event.visual === "tag-team" ? abilityArtUrl("tag-team") : art;
  const projectile =
    event.move === "snowball" ||
    event.move === "spark" ||
    event.visual === "projectile";
  const EffectIcon = event.visual
    ? signatureIcon(source, event.visual)
    : event.move === "snowball"
      ? Snowflake
      : Flame;
  const impact =
    event.visual === "tag-team" ||
    event.visual === "burst" ||
    event.visual === "rush";
  return (
    <div className="battle-effects">
      <BabasharkEffects event={event} source={source} />
      <CastAbilityEffect event={event} art={art} Icon={EffectIcon} />
      {event.visual === "grace" && (
        <>
          <div className="battle-grace" data-guest="grace">
            <div className="battle-guest-motion">
              <Cutout character={findGuest(GRACE)} mirrored={mirrored} />
            </div>
          </div>
          <div className="battle-grace-hearts">
            <Heart />
            <Heart />
            <Heart />
          </div>
        </>
      )}
      {event.visual === "tag-team" && (
        <div className="battle-tag-team">
          <div className="battle-tag-rush">
            <div data-guest="jat">
              <Cutout character={findGuest(JAT)} mirrored={mirrored} />
            </div>
            <div data-guest="genesis">
              <Cutout character={findGuest(GENESIS)} mirrored={mirrored} />
            </div>
          </div>
        </div>
      )}
      {projectile && (
        <span className="battle-projectile">
          {art ? <Art src={art} fallback={<EffectIcon />} /> : <EffectIcon />}
        </span>
      )}
      {impact && !projectile && (
        <span className="battle-impact-art">
          {targetArt ? (
            <Art src={targetArt} fallback={<EffectIcon />} />
          ) : (
            <EffectIcon />
          )}
        </span>
      )}
      {hit && !blocked && event.visual !== "diarrhea-spray" && (
        <div className="battle-sparks">
          {Array.from({ length: event.hits ?? 1 }, (_, index) => (
            <i key={index} style={{ "--hit-index": index } as CSSProperties} />
          ))}
        </div>
      )}
      {(event.move === "brace" || blocked) && (
        <Shield className="battle-guard" />
      )}
      {(event.damage !== 0 || event.move === "stun" || event.tag) && (
        <div className="battle-hit-readout" data-self={self || undefined}>
          {event.tag && (
            <strong className="battle-hit-tag" data-ability-tag={event.tag}>
              {event.tag}
            </strong>
          )}
          <div className="battle-hit-result">
            {grade && <span>{grade}</span>}
            {event.damage !== 0 && (
              <b data-heal={event.damage < 0 || undefined}>
                {event.damage < 0 ? `+${-event.damage}` : `−${event.damage}`}
              </b>
            )}
            {(event.hits ?? 0) > 1 && <small>×{event.hits}</small>}
            {event.move === "stun" && <Zap size={22} />}
          </div>
        </div>
      )}
    </div>
  );
}

function Battlefield({
  actor,
  other,
  crew,
  battle,
  event,
  actingSide,
}: Pick<Props, "actor" | "other" | "crew"> & {
  battle: BattleState;
  event: BattleEvent | null;
  actingSide: Side | undefined;
}) {
  return (
    <div
      className="duo-stage battle-field"
      data-move={event?.move}
      data-actor={event?.actor}
      data-visual={event?.visual}
      aria-hidden="true"
    >
      <div className="battle-arena">
        <Art
          src={abilityArtUrl("duel-street")}
          fallback={
            <div className="battle-arena-fallback">
              <img src={sceneryArtUrl("homes")} alt="" />
            </div>
          }
        />
      </div>
      <div className="battle-ground">
        {(
          [
            ["player", actor],
            ["opponent", other],
          ] as const
        ).map(([side, character]) => {
          const motion = stageMotion(event, side, character);
          const pointsDrillAtTarget =
            motion === "drill-rush" &&
            character.preset === "footjobofsteel" &&
            !character.sprite;
          return (
            <div
              key={side}
              className={`duo-fighter battle-fighter ${side}`}
              data-turn={actingSide === side || undefined}
              data-motion={motion}
              data-ko={
                (side === "player" && battle.phase === "defeat") ||
                (side === "opponent" && battle.phase === "victory") ||
                undefined
              }
              style={
                {
                  "--fighter-scale": characterScale(character),
                } as CSSProperties
              }
            >
              <span className="battle-fighter-shadow" />
              <div className="duo-motion">
                <Cutout
                  character={character}
                  mirrored={pointsDrillAtTarget !== (side === "opponent")}
                  moving={motion === "chair-charge"}
                />
              </div>
            </div>
          );
        })}
        {event && (
          <BattleEffects
            key={battle.eventId}
            event={event}
            crew={crew}
            source={event.actor === "player" ? actor : other}
          />
        )}
      </div>
    </div>
  );
}

const MOVE_ICONS: Record<BasicMoveId, LucideIcon> = {
  quick: Swords,
  heavy: Sword,
  snowball: Snowflake,
  spark: Flame,
  stomp: Footprints,
};
const COMMAND_MOVES = Object.keys(MOVES) as BasicMoveId[];

type BattleCommandId = MoveId | "brace" | "snack" | "abilities" | "back";
type WheelSlot = BasicMoveId | "signature" | "brace" | "snack";

const SIGNATURE_SLOTS: Record<SignatureMoveId, WheelSlot> = {
  signature: "signature",
  "diddy-party": "signature",
  "kick-the-baby": "heavy",
  "simps-assemble": "spark",
  chaz: "brace",
  "diarrhea-spray": "signature",
  "needle-toss": "heavy",
  "fleshlight-volley": "spark",
  "drill-rush": "signature",
  "first-aid": "spark",
};

interface BattleCommand {
  id: BattleCommandId;
  slot: WheelSlot;
  Icon: LucideIcon;
  name: string;
  description: string;
  detail: string;
  label: string;
  disabled: boolean;
  run: () => void;
  art?: string;
}

function BattleCommands({
  battle,
  dispatch,
  actor,
}: {
  battle: BattleState;
  dispatch: Dispatch<BattleAction>;
  actor: Character;
}) {
  const [selected, setSelected] = useState<BattleCommandId>("quick");
  const [showAbilities, setShowAbilities] = useState(false);
  const { signatures } = battle.player;
  const first = useRef<HTMLButtonElement>(null);
  useLayoutEffect(
    () => first.current?.focus({ preventScroll: true }),
    [showAbilities],
  );

  function changeWheel(show: boolean) {
    setShowAbilities(show);
    setSelected(show ? signatures[0].id : "abilities");
  }

  const attackCommand = (id: MoveId): BattleCommand => {
    const move = getMove(battle.player, id)!;
    const basic = isBasicMove(id);
    const slot = basic ? id : SIGNATURE_SLOTS[id];
    return {
      id,
      slot: id === "signature" && signatures.length > 1 ? "brace" : slot,
      Icon: basic ? MOVE_ICONS[id] : signatureIcon(actor, move.visual),
      name: move.name,
      description: move.description,
      detail: move.cost ? `${move.cost} PP` : "+1 PP",
      label: `Use ${move.name}`,
      disabled: battle.player.pp < move.cost,
      run: () => dispatch({ type: "choose", move: id }),
      art: battleAbilityArt(move.art),
    };
  };
  const mainCommands: BattleCommand[] = [
    ...COMMAND_MOVES.map(attackCommand),
    {
      id: "brace",
      slot: "brace",
      Icon: Shield,
      name: "Brace",
      label: "Brace",
      description: "Reduce the next hit and recover power.",
      detail: "+2 PP",
      disabled: false,
      run: () => dispatch({ type: "brace" }),
    },
    {
      id: "snack",
      slot: "snack",
      Icon: Sandwich,
      name: "Snack",
      label: "Eat a snack",
      description: "Restore up to 28 HP before attacking.",
      detail: `${battle.snacks} left`,
      disabled:
        battle.itemUsed ||
        !battle.snacks ||
        battle.player.hp === battle.player.maxHp,
      run: () => dispatch({ type: "snack" }),
    },
  ];
  if (signatures.length === 1)
    mainCommands.push(attackCommand(signatures[0].id));
  if (signatures.length > 1) {
    mainCommands.push({
      id: "abilities",
      slot: "signature",
      Icon: Sparkles,
      name: "Abilities",
      label: "Abilities",
      description: "Open the wheel for this fighter’s signature moves.",
      detail: `${signatures.length} moves`,
      disabled: false,
      run: () => changeWheel(true),
    });
  }
  const commands: BattleCommand[] = showAbilities
    ? [
        ...signatures.map(({ id }) => attackCommand(id)),
        {
          id: "back",
          slot: "snack",
          Icon: ArrowLeft,
          name: "Back",
          label: "Back to battle actions",
          description: "Return to the main battle wheel.",
          detail: "",
          disabled: false,
          run: () => changeWheel(false),
        },
      ]
    : mainCommands;
  const focused =
    commands.find((command) => command.id === selected) ?? commands[0];
  const focusId = showAbilities
    ? commands.find((command) => !command.disabled)?.id
    : selected === "abilities"
      ? "abilities"
      : "quick";

  function moveFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && showAbilities) {
      event.preventDefault();
      event.stopPropagation();
      changeWheel(false);
      return;
    }
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ),
    ];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    event.preventDefault();
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
  }

  return (
    <div className="battle-command-area">
      <div className="battle-command-hint" aria-hidden="true">
        <b>
          {focused.name}
          {focused.detail && <small>{focused.detail}</small>}
        </b>
        <span>{focused.description}</span>
      </div>
      <div
        className="battle-moves"
        role="group"
        aria-label={showAbilities ? "Signature abilities" : "Battle actions"}
        onKeyDown={moveFocus}
      >
        {commands.map(
          ({
            id,
            slot,
            Icon,
            name,
            detail,
            label,
            description,
            disabled,
            run,
            art,
          }) => (
            <button
              key={id}
              ref={id === focusId ? first : undefined}
              className="battle-move"
              data-command={slot}
              data-highlight={selected === id || undefined}
              aria-label={label}
              aria-describedby={`battle-command-${id}`}
              disabled={disabled}
              onFocus={() => setSelected(id)}
              onPointerEnter={() => setSelected(id)}
              onClick={run}
            >
              <span className="battle-command-token" aria-hidden="true">
                {art ? <Art src={art} fallback={<Icon />} /> : <Icon />}
              </span>
              <strong>{name}</strong>
              {detail && <small>{detail}</small>}
              <span className="battle-sr-only" id={`battle-command-${id}`}>
                {description} {detail}.
              </span>
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function TimingInput({
  defending,
  title,
  onResolve,
}: {
  defending: boolean;
  title: string;
  onResolve: (grade: TimingGrade) => void;
}) {
  const meter = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const resolve = useRef<() => void>(() => {});
  const [paused, setPaused] = useState(document.hidden);
  useLayoutEffect(() => {
    let start = performance.now();
    let pausedAt = document.hidden ? start : null;
    let finished = false;
    let frame = 0;
    const finish = (progress: number) => {
      if (finished || pausedAt !== null) return;
      finished = true;
      cancelAnimationFrame(frame);
      onResolve(timingGrade(progress));
    };
    resolve.current = () =>
      finish((performance.now() - start) / TIMING_DURATION);
    const tick = (now: number) => {
      if (pausedAt !== null || finished) return;
      const progress = Math.min((now - start) / TIMING_DURATION, 1);
      meter.current?.style.setProperty(
        "--timing-progress",
        `${progress * 100}%`,
      );
      if (progress >= 1) finish(progress);
      else frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (document.hidden) {
        pausedAt = performance.now();
        cancelAnimationFrame(frame);
      } else if (pausedAt !== null) {
        start += performance.now() - pausedAt;
        pausedAt = null;
        frame = requestAnimationFrame(tick);
      }
      setPaused(document.hidden);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== " " && event.key !== "Enter") return;
      if (
        event.target instanceof HTMLButtonElement &&
        event.target !== button.current
      )
        return;
      event.preventDefault();
      if (!event.repeat) resolve.current();
    };
    button.current?.focus({ preventScroll: true });
    frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("keydown", keydown);
    return () => {
      finished = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("keydown", keydown);
    };
  }, [onResolve]);
  return (
    <div className="battle-timing" data-defending={defending || undefined}>
      <div className="battle-timing-body">
        <strong>{title}</strong>
        <div className="timing-track" ref={meter} aria-hidden="true">
          <span
            className="timing-good"
            style={{
              left: `${(TIMING_TARGET - GOOD_WINDOW) * 100}%`,
              width: `${GOOD_WINDOW * 200}%`,
            }}
          />
          <span
            className="timing-perfect"
            style={{
              left: `${(TIMING_TARGET - PERFECT_WINDOW) * 100}%`,
              width: `${PERFECT_WINDOW * 200}%`,
            }}
          />
          <span className="timing-marker" />
        </div>
        <p id="battle-timing-instructions">
          {paused
            ? "Paused while this tab is hidden"
            : "Tap or press Space on green. Gold is perfect."}
        </p>
      </div>
      <button
        className="battle-timing-button"
        ref={button}
        disabled={paused}
        onClick={() => resolve.current()}
        aria-describedby="battle-timing-instructions"
      >
        {defending ? <Shield size={23} /> : <Swords size={23} />}
        {defending ? "Block!" : "Strike!"}
      </button>
    </div>
  );
}

export function Battle({ actor, other, crew, onBack, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  const [battle, dispatch] = useReducer(battleReducer, undefined, () =>
    createBattle(actor, other),
  );
  const resolve = useCallback((grade: TimingGrade) => {
    dispatch({ type: "timing", grade, roll: Math.random() });
  }, []);
  const finished = battle.phase === "victory" || battle.phase === "defeat";
  const defending = battle.phase === "block";
  const timing = battle.phase === "attack" || defending;
  const actingSide =
    battle.phase === "choose" || battle.phase === "attack"
      ? "player"
      : defending
        ? "opponent"
        : battle.phase === "impact"
          ? battle.event?.actor
          : undefined;
  const lingeringEvent =
    battle.event &&
    ["snack", "burn", "stun", "sleep"].includes(battle.event.move);
  const activeEvent =
    battle.phase === "impact" || (!finished && lingeringEvent)
      ? battle.event
      : null;
  const damage = battle.phase === "impact" ? (activeEvent?.damage ?? 0) : 0;
  const struck =
    activeEvent &&
    damage &&
    (affectsActor(activeEvent)
      ? activeEvent.actor
      : activeEvent.actor === "player"
        ? "opponent"
        : "player");
  const [duration, impactAt] = (activeEvent?.visual &&
    IMPACT_CUES[activeEvent.visual]) ?? [IMPACT_DURATION, 0.38];
  const attack = getMove(
    defending ? battle.opponent : battle.player,
    battle.move,
  );
  const attackTitle = defending
    ? `${other.name} uses ${attack?.name ?? "an attack"}`
    : (attack?.name ?? "Strike");
  const result =
    battle.phase === "victory" ? `${actor.name} wins!` : `${other.name} wins!`;
  const abilityTitle =
    activeEvent &&
    battle[activeEvent.actor].signatures.find(
      ({ id }) => id === activeEvent.move,
    )?.name;

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element
      ?.querySelector<HTMLButtonElement>('button[data-command="quick"]')
      ?.focus({ preventScroll: true });
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (battle.phase !== "impact") return;
    const delay = window.matchMedia(REDUCED_MOTION).matches
      ? IMPACT_DURATION
      : duration;
    const timer = setTimeout(() => dispatch({ type: "advance" }), delay);
    return () => clearTimeout(timer);
  }, [battle.phase, battle.eventId, duration]);
  useLayoutEffect(() => {
    if (finished) returnButton.current?.focus({ preventScroll: true });
  }, [finished]);

  return createPortal(
    <dialog
      className="battle"
      ref={dialog}
      data-testid="battle"
      data-phase={battle.phase}
      aria-label={`${actor.name} vs ${other.name}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      style={
        {
          "--impact-duration": `${duration}ms`,
          "--impact-delay": `${activeEvent ? duration * impactAt : 0}ms`,
          "--battle-player-scale": characterScale(actor),
        } as CSSProperties
      }
    >
      <Battlefield
        actor={actor}
        other={other}
        crew={crew}
        battle={battle}
        event={activeEvent}
        actingSide={actingSide}
      />
      <div className="battle-statuses">
        <FighterStatus
          fighter={battle.player}
          character={actor}
          side="player"
          active={actingSide === "player"}
          guarding={battle.guarding}
          previousHealth={
            struck === "player" ? battle.player.hp + damage : undefined
          }
        />
        <FighterStatus
          fighter={battle.opponent}
          character={other}
          side="opponent"
          active={actingSide === "opponent"}
          previousHealth={
            struck === "opponent" ? battle.opponent.hp + damage : undefined
          }
        />
      </div>
      <p className="battle-sr-only" role="status">
        {finished
          ? result
          : timing
            ? attackTitle
            : battle.phase === "choose"
              ? "Your turn."
              : ""}
        {battle.event?.text ? ` ${battle.event.text}` : ""}
      </p>
      {!finished && (
        <button
          className="battle-leave"
          type="button"
          aria-label="Leave fight"
          title="Leave fight (Esc)"
          onClick={onClose}
        >
          <ArrowLeft size={22} />
        </button>
      )}
      {battle.phase === "choose" && (
        <BattleCommands actor={actor} battle={battle} dispatch={dispatch} />
      )}
      {timing && (
        <TimingInput
          key={`${battle.phase}-${battle.round}`}
          title={attackTitle}
          defending={defending}
          onResolve={resolve}
        />
      )}
      {abilityTitle && battle.phase === "impact" && (
        <p className="battle-ability-title">{abilityTitle}</p>
      )}
      {finished && (
        <div className="battle-result">
          <strong aria-hidden="true">
            <img
              className="battle-result-art"
              src={uiArtUrl("impact")}
              alt=""
            />
            {result}
          </strong>
          <div>
            <button ref={returnButton} onClick={onClose}>
              Back to town
            </button>
            <button onClick={onBack}>Back to {other.name}</button>
          </div>
        </div>
      )}
    </dialog>,
    document.fullscreenElement || document.body,
  );
}
