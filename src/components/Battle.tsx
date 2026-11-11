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
  Candy,
  CircleDot,
  CircleStop,
  Coffee,
  Croissant,
  Dog,
  Flag,
  Flame,
  Flower2,
  Footprints,
  Gem,
  GraduationCap,
  Heart,
  MessageCircleMore,
  PawPrint,
  Sandwich,
  Shield,
  Snowflake,
  Sparkles,
  Sword,
  Swords,
  UsersRound,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { abilityArtUrl, sceneryArtUrl } from "../game/art";
import {
  battleReducer,
  createBattle,
  getMove,
  GOOD_WINDOW,
  MOVES,
  PERFECT_WINDOW,
  TIMING_DURATION,
  TIMING_TARGET,
  timingGrade,
  type BattleAction,
  type BattleEvent,
  type BattleState,
  type Fighter,
  type MoveId,
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
import { CharacterArt } from "./Character";

interface Props {
  actor: Character;
  other: Character;
  crew?: Character[];
  onBack: () => void;
  onClose: () => void;
}

const IMPACT_DURATION = 850;
const GRACE_DURATION = 1920;
const TAG_TEAM_DURATION = 1430;
const GENESIS = DEFAULT_CREW.find(
  (character) => character.preset === "genesis",
)!;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function impactDuration(event: BattleEvent | null) {
  if (event?.visual === "grace") return GRACE_DURATION;
  if (event?.visual === "tag-team") return TAG_TEAM_DURATION;
  return IMPACT_DURATION;
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
  guarding = false,
  previousHealth,
}: {
  fighter: Fighter;
  character: Character;
  side: Side;
  guarding?: boolean;
  previousHealth?: number;
}) {
  const scale = characterScale(character);
  return (
    <section className={`fighter-status ${side}`} aria-label={fighter.name}>
      <div className="battle-portrait" aria-hidden="true">
        <svg
          viewBox={`${75 - 62 * scale} ${180 - 182 * scale} ${124 * scale} ${124 * scale}`}
        >
          <CharacterArt c={character} />
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
          {guarding && (
            <span>
              <Shield size={12} /> Braced
            </span>
          )}
        </div>
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
    if (event.damage <= 0 || event.move === "burn" || event.move === "stun")
      return;
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
  zippy: Flower2,
  jat: Coffee,
  loralei: Footprints,
  samira: Heart,
  genesis: Dog,
  kain: Zap,
  footjobofsteel: PawPrint,
  steakbutterfan: Sandwich,
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
  if (character.kind === "mint") return Candy;
  const preset =
    character.preset ??
    DEFAULT_CREW.find(({ id }) => id === character.id)?.preset;
  return (preset && SIGNATURE_ICONS[preset]) || Sparkles;
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
  const self =
    event.move === "burn" || event.move === "stun" || event.move === "snack";
  const hit = !self && event.damage > 0;
  const mirrored = event.actor === "opponent";
  const blocked = hit && mirrored && event.grade !== "miss";
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
  const targetArt =
    event.visual === "tag-team" ? abilityArtUrl("tag-team") : event.art;
  const projectile =
    event.move === "snowball" ||
    event.move === "spark" ||
    event.visual === "projectile";
  const EffectIcon =
    event.move === "signature"
      ? signatureIcon(source, event.visual)
      : event.move === "snowball"
        ? Snowflake
        : Flame;
  const impact =
    targetArt || event.visual === "burst" || event.visual === "rush";
  return (
    <div className="battle-effects">
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
          {event.art ? (
            <Art src={event.art} fallback={<EffectIcon />} />
          ) : (
            <EffectIcon />
          )}
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
      {hit && !blocked && (
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
}: Pick<Props, "actor" | "other" | "crew"> & {
  battle: BattleState;
  event: BattleEvent | null;
}) {
  const turn =
    battle.phase === "block"
      ? "opponent"
      : battle.phase === "choose" || battle.phase === "attack"
        ? "player"
        : undefined;
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
          return (
            <div
              key={side}
              className={`duo-fighter battle-fighter ${side}`}
              data-turn={turn === side || undefined}
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
                  mirrored={side === "opponent"}
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

const MOVE_ICONS: Record<Exclude<MoveId, "signature">, LucideIcon> = {
  quick: Swords,
  heavy: Sword,
  snowball: Snowflake,
  spark: Flame,
  stomp: Footprints,
};
const COMMAND_MOVES = Object.keys(MOVES) as Exclude<MoveId, "signature">[];

interface BattleCommand {
  id: MoveId | "brace" | "snack";
  Icon: LucideIcon;
  name: string;
  description: string;
  detail: string;
  label: string;
  disabled: boolean;
  action: BattleAction;
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
  const [selected, setSelected] = useState<MoveId | "brace" | "snack">("quick");
  const first = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => first.current?.focus({ preventScroll: true }), []);
  const attackCommand = (id: MoveId): BattleCommand => {
    const move = getMove(battle.player, id)!;
    return {
      id,
      Icon:
        id === "signature" ? signatureIcon(actor, move.visual) : MOVE_ICONS[id],
      name: move.name,
      description: move.description,
      detail: move.cost ? `${move.cost} PP` : "+1 PP",
      label: `Use ${move.name}`,
      disabled: battle.player.pp < move.cost,
      action: { type: "choose", move: id },
      art: move.art,
    };
  };
  const commands: BattleCommand[] = [
    ...COMMAND_MOVES.map(attackCommand),
    {
      id: "brace",
      Icon: Shield,
      name: "Brace",
      label: "Brace",
      description: "Reduce the next hit and recover power.",
      detail: "+2 PP",
      disabled: false,
      action: { type: "brace" },
    },
    {
      id: "snack",
      Icon: Sandwich,
      name: "Snack",
      label: "Eat a snack",
      description: "Restore up to 28 HP before attacking.",
      detail: `${battle.snacks} left`,
      disabled:
        battle.itemUsed ||
        !battle.snacks ||
        battle.player.hp === battle.player.maxHp,
      action: { type: "snack" },
    },
  ];
  if (battle.player.signature) commands.push(attackCommand("signature"));
  const focused =
    commands.find((command) => command.id === selected) ?? commands[0];

  function moveFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
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
        <b className="battle-grid-detail">Your turn</b>
        <b className="battle-wheel-detail">
          {focused.name} <small>{focused.detail}</small>
        </b>
        <span>{focused.description}</span>
      </div>
      <div
        className="battle-moves"
        role="group"
        aria-label="Battle actions"
        onKeyDown={moveFocus}
      >
        {commands.map(
          ({
            id,
            Icon,
            name,
            detail,
            label,
            description,
            disabled,
            action,
            art,
          }) => (
            <button
              key={id}
              ref={id === "quick" ? first : undefined}
              className="battle-move"
              data-command={id}
              data-highlight={selected === id || undefined}
              aria-label={label}
              aria-describedby={`battle-command-${id}`}
              disabled={disabled}
              onFocus={() => setSelected(id)}
              onPointerEnter={() => setSelected(id)}
              onClick={() => dispatch(action)}
            >
              <span className="battle-command-token" aria-hidden="true">
                {art ? <Art src={art} fallback={<Icon />} /> : <Icon />}
              </span>
              <strong>{name}</strong>
              <small>{detail}</small>
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
  const lingeringEvent =
    battle.event && ["snack", "burn", "stun"].includes(battle.event.move);
  const activeEvent =
    battle.phase === "impact" || (!finished && lingeringEvent)
      ? battle.event
      : null;
  const damage = battle.phase === "impact" ? (activeEvent?.damage ?? 0) : 0;
  const struck =
    damage > 0 && (activeEvent?.actor === "player" ? "opponent" : "player");
  const duration = impactDuration(activeEvent);
  const impactAt =
    activeEvent?.visual === "grace"
      ? 0.55
      : activeEvent?.visual === "tag-team"
        ? 0.5
        : 0.38;
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
    activeEvent?.move === "signature"
      ? getMove(battle[activeEvent.actor], "signature")?.name
      : undefined;

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
      />
      <div className="battle-statuses">
        <FighterStatus
          fighter={battle.player}
          character={actor}
          side="player"
          guarding={battle.guarding}
          previousHealth={
            struck === "player" ? battle.player.hp + damage : undefined
          }
        />
        <FighterStatus
          fighter={battle.opponent}
          character={other}
          side="opponent"
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
          <strong aria-hidden="true">{result}</strong>
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
