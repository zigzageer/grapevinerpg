import { useId } from "react";
import { abilityArtUrl, characterArtUrl } from "../game/art";
import type { Character as CharacterData } from "../game/model";
import { characterScale } from "../game/model";

interface ArtProps {
  c: CharacterData;
  moving?: boolean;
  facing?: number;
  portrait?: boolean;
}

export function CharacterArt(props: ArtProps) {
  const scale = characterScale(props.c);
  return (
    <g
      transform={`translate(${75 * (1 - scale)} ${180 * (1 - scale)}) scale(${scale})`}
    >
      <CharacterCutout {...props} />
    </g>
  );
}

function OrrowMouth() {
  return (
    <g transform="translate(74.7 69.7)">
      <path
        d="M-4.3 0H4.3"
        stroke="#f8b68e"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <g className="orrow-speaking-mouth">
        <path
          d="M-6.8-1.3Q-2.5-2 1.3-1.6L6.8-.7Q4.4 4.7.3 4.8Q-4.6 4.8-6.8-1.3Z"
          fill="#442a26"
        />
        <path
          d="M-5.7-1.05L-3-1.38l.68 1.94-2.1.49ZM-2.65-1.44l2.62.04.84 2.26-2.66-.2ZM.44-1.38l2.7.18-.57 2.44L1.2.84ZM3.6-1.16l2.17.31-1.31 1.88-1.43.39ZM-.5 3.88l1.8-1.24 1.18.86Q.8 4.28-.5 3.88Z"
          fill="#fff1d3"
        />
      </g>
    </g>
  );
}

function BurgerBite() {
  return (
    <g aria-hidden="true">
      {/* Match the visible mouth in the cutout so the bun stays in front of it. */}
      <g className="burger-chew-face">
        <path
          d="M69.4 50.2Q76.6 50.9 84.9 50.1L85 54.1Q76.1 58.5 74.2 66.7Q69.7 69.1 66.7 65.9Q63.5 61.4 66.5 54.6Z"
          fill="#70432e"
        />
        <g className="burger-chew-mouth">
          <path
            d="M69.5 50.8Q76.1 51.5 84.5 50.8L84.6 53.7Q76.6 57.3 74.1 66.6Q69.2 68 66.9 65Q64.4 60.5 67 54.9Z"
            fill="#321f22"
          />
          <path
            d="M69.7 51.3Q76.2 51.8 83.9 51.3Q83.7 53.4 80.2 53.5H73.1Q69.9 53.2 69.7 51.3Z"
            fill="#ece7eb"
          />
          <path
            d="M66.7 60.5Q70.9 57.1 76.2 61.1L74 66.1Q69 67.9 67.4 64.6Z"
            fill="#c16d79"
          />
        </g>
      </g>
      <g className="burger-bite-crumbs">
        <path d="M69 59l3 1-2 2-2-1zM62 62l2-1 1 2-2 1z" fill="#eab45b" />
        <path d="M66 55l2 1-1 2-2-1z" fill="#f3cf82" />
      </g>
    </g>
  );
}

function ZippyChew({ sprite, clipId }: { sprite: string; clipId: string }) {
  return (
    <g className="zippy-chew" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d="M69.4 71.5Q75.6 70.9 81.5 71.6L81.5 76.2 80.4 77.8 79.2 78.7 79.1 81.4Q78.8 81.9 75.3 81.5L74.2 79.4Q71 78.9 70.6 77L69.4 75Z" />
        </clipPath>
      </defs>
      {/* Sample the neighboring paper texture behind the moving mouth and noodles. */}
      <g clipPath={`url(#${clipId})`}>
        <use href={`#${sprite}`} transform="translate(-13 -2)" />
        <g className="zippy-chew-mouth">
          <use href={`#${sprite}`} />
        </g>
      </g>
    </g>
  );
}

function DrillBit() {
  return (
    <g transform="translate(33.7 104.5) rotate(14)" aria-hidden="true">
      <path
        d="M0-.8H-6.9l-1.45.8 1.45.8H0Z"
        fill="#777675"
        stroke="#242221"
        strokeWidth=".35"
        strokeLinejoin="round"
      />
      <path
        className="drill-bit"
        d="M-7.1-.6l.85 1.2m1.04-1.2.85 1.2m1.04-1.2.85 1.2m1.04-1.2.85 1.2"
        stroke="#e2ded9"
        strokeWidth=".46"
        strokeLinecap="round"
      />
    </g>
  );
}

function SarinaPuff({ facing }: { facing: number }) {
  return (
    <g
      transform={`translate(${facing < 0 ? 150 : 0} 0) scale(${facing < 0 ? -1 : 1} 1)`}
      aria-hidden="true"
    >
      <g transform="translate(42 139)">
        <g className="sarina-walk-puff">
          <path
            d="M8 3Q2 9-6 6Q-14 9-19 4Q-26 5-27 0Q-31-5-24-8Q-21-14-13-11Q-8-15-3-10Q4-10 4-5Q10-4 8 3Z"
            fill="#d4e5ad"
            stroke="#708554"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path
            d="M-23-3q4-2 7 1m3-6q3-2 6 0m1 9q4-3 8-2"
            fill="none"
            stroke="#9aaf76"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  );
}

function JatGlasses() {
  return (
    <g aria-hidden="true">
      <g
        className="jat-glasses"
        fill="none"
        stroke="#211b1a"
        strokeWidth="2.05"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 85.3Q18.8 84.9 17 87M58.4 85.1Q63.4 85 65.1 87.2M38 85.8Q40.4 84 43.2 85.8" />
        <path d="M21.6 85.5Q24.5 83.5 31.5 83.6Q38.2 83.7 39.7 87.2Q40.5 89.7 38.7 96.1Q37 101 31.7 101Q25 101.7 22.7 98.8Q20.5 96 20.4 90.8Q20 87.4 21.6 85.5ZM43.1 85.5Q47 83.3 53.4 83.7Q59.1 83.8 60.1 87.1Q60.9 90.9 59.5 95.8Q58 100.7 51.8 101Q45.4 101.6 43.5 97.8Q41.9 94.6 41.7 89.8Q41.5 86.8 43.1 85.5Z" />
      </g>
      <g
        transform="translate(21 131)"
        fill="#d9985f"
        stroke="#98653f"
        strokeWidth=".35"
      >
        <g className="jat-arm">
          <g className="jat-upper-arm">
            <path d="M-3.7-.3 3.8.9Q3.8 3.6 3.1 7.3L2.5 10.6Q1.8 13.4-1 13.1Q-3.4 12.9-4.3 10.2Q-4.1 3.2-3.7-.3Z" />
            <g transform="translate(-1.2 10.4)">
              <g className="jat-forearm">
                <path d="M-3-1.3Q.1-3.2 3.2-1.2L2.5 8Q1.6 9.6-1.2 9.2Q-3.7 8.9-3.8 6.6Z" />
                <path d="M-3.8 5.1Q-1.7 3.7 1.6 5Q4.4 6.5 4 9.8Q3.6 13.5.4 14.2Q-3.4 14.9-5.3 11.7Q-6.5 8-3.8 5.1Z" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

function ChairRoll({ facing }: { facing: number }) {
  return (
    <>
      <g
        className="chair-roll-streaks"
        transform={`translate(${75 - 47 * facing} 161) scale(${facing} 1)`}
      >
        <path
          d="M-19 0H-5M-26 7h15M-15 13h10"
          fill="none"
          stroke="#f2d7e2"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
      {[34.5, 64.5, 95.75].map((x) => (
        <g key={x} transform={`translate(${x} 174.3)`}>
          <path
            className="chair-caster-spokes"
            d="M-2.8 0h5.6M0-2.8v5.6"
            stroke="#665662"
            strokeWidth="0.75"
            strokeLinecap="round"
          />
        </g>
      ))}
    </>
  );
}

function CharacterCutout({
  c,
  moving = false,
  facing = 1,
  portrait = false,
}: ArtProps) {
  const id = useId().replace(/:/g, "");
  if (c.kind === "mint" && !c.sprite)
    return (
      <g className={moving ? "paper-person walking" : "paper-person"}>
        <image
          href={characterArtUrl("mint")}
          x="-37"
          y="14"
          width="224"
          height="166"
          preserveAspectRatio="xMidYMax meet"
        />
      </g>
    );
  const sprite = c.sprite || (c.preset ? characterArtUrl(c.preset) : undefined);
  if (sprite) {
    const rolling = moving && !c.sprite && c.preset === "kawaiikitty";
    const eating = !c.sprite && c.preset === "steakbutterfan";
    const chewing = !c.sprite && c.preset === "zippy";
    const adjustingGlasses = !c.sprite && c.preset === "jat" && !portrait;
    const spriteId = `zippy-sprite-${id}`;
    const motion = rolling ? " chair-rolling" : moving ? " walking" : "";
    const image = (
      <image
        id={chewing ? spriteId : undefined}
        href={adjustingGlasses ? characterArtUrl("jat-rig") : sprite}
        x="0"
        y={c.preset === "zippy" ? 30 : 0}
        width="150"
        height={c.preset === "zippy" ? 150 : 180}
        preserveAspectRatio="xMidYMax meet"
      />
    );
    return (
      <g className={`paper-person${motion}`}>
        {moving && !c.sprite && c.preset === "flag-girl" && (
          <SarinaPuff facing={facing} />
        )}
        {eating ? (
          <g className="burger-eating">
            {image}
            <BurgerBite />
          </g>
        ) : (
          image
        )}
        {chewing && (
          <ZippyChew sprite={spriteId} clipId={`zippy-mouth-${id}`} />
        )}
        {!c.sprite && c.preset === "footjobofsteel" && <DrillBit />}
        {adjustingGlasses && <JatGlasses />}
        {!c.sprite && c.preset === "orrow" && <OrrowMouth />}
        {!c.sprite && c.preset === "babashark" && (
          <image
            data-companion="babashark-daughter"
            href={abilityArtUrl("babashark-daughter")}
            x="104"
            y="109"
            width="44"
            height="71"
            preserveAspectRatio="xMidYMax meet"
          />
        )}
        {rolling && <ChairRoll facing={facing} />}
      </g>
    );
  }
  const turn = facing * 2;
  return (
    <g className={moving ? "paper-person walking" : "paper-person"}>
      <defs>
        <clipPath id={`head${id}`}>
          <ellipse cx="75" cy="65" rx="56" ry="54" />
        </clipPath>
      </defs>
      <g className="legs">
        <path d="M43 150H73V174H42Z" fill={c.pants} />
        <path d="M76 150H107V174H76Z" fill={c.pants} />
        <path d="M34 171Q52 165 73 172V180H32Z" fill="#2c3034" />
        <path d="M76 172Q99 165 115 172L118 180H76Z" fill="#2c3034" />
      </g>
      <path d="M40 108Q73 98 108 108L122 158Q77 170 28 158Z" fill={c.shirt} />
      <path
        d="M38 114L24 150"
        stroke={c.shirt}
        strokeWidth="21"
        strokeLinecap="round"
      />
      <path
        d="M111 114L126 150"
        stroke={c.shirt}
        strokeWidth="21"
        strokeLinecap="round"
      />
      <ellipse cx="23" cy="154" rx="11" ry="10" fill={c.skin} />
      <ellipse cx="128" cy="154" rx="11" ry="10" fill={c.skin} />
      <path
        d="M74 122V163M40 135L38 151M111 135L113 151"
        fill="none"
        stroke="#000"
        strokeOpacity=".18"
        strokeWidth="1.4"
      />
      <circle cx="80" cy="142" r="1.8" fill="#e2c99d" />
      <circle cx="80" cy="154" r="1.8" fill="#e2c99d" />
      {c.hair === "long" && (
        <path
          d="M16 53Q18 -5 75 9Q138 6 133 61L138 131L105 127L94 91H45L39 128L10 130Z"
          fill={c.hairColor}
        />
      )}
      <ellipse cx="75" cy="65" rx="56" ry="54" fill={c.skin} />
      {c.hair !== "bald" && (
        <g clipPath={`url(#head${id})`} fill={c.hairColor}>
          {c.hair === "short" && (
            <path d="M13 46L17 2H135L135 54L123 45L118 28L101 29L82 22L44 31L30 53Z" />
          )}
          {c.hair === "messy" && (
            <path d="M8 45L17 6L40 13L45 0L67 7L86 0L97 8L124 2L143 37L121 41L111 28L98 38L87 26L70 34L57 28L43 42L33 37L23 57Z" />
          )}
          {c.hair === "long" && (
            <path d="M6 63L7 0H142V59L121 55L114 26Q91 26 73 17Q61 36 32 37L28 65Z" />
          )}
          {c.hair === "curly" && (
            <>
              <path d="M8 34V0H141V36L119 46L97 31L75 39L49 30L29 51Z" />
              {[22, 40, 58, 77, 96, 115, 130].map((x, i) => (
                <circle key={x} cx={x} cy={20 + (i % 2) * 8} r="17" />
              ))}
            </>
          )}
        </g>
      )}
      <g transform={`translate(${turn} 0)`}>
        <ellipse
          cx="56"
          cy="65"
          rx="20"
          ry="24"
          transform="rotate(-8 56 65)"
          fill="#fffdf8"
        />
        <ellipse
          cx="94"
          cy="65"
          rx="20"
          ry="24"
          transform="rotate(8 94 65)"
          fill="#fffdf8"
        />
        <circle cx={60 + turn} cy="67" r="2.5" fill="#26272b" />
        <circle cx={90 + turn} cy="67" r="2.5" fill="#26272b" />
        <path
          d="M69 100Q75 102 81 99"
          fill="none"
          stroke="#634738"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {c.glasses && (
          <g fill="none" stroke="#343436" strokeWidth="3">
            <rect x="33" y="49" width="40" height="34" rx="9" />
            <rect x="78" y="49" width="40" height="34" rx="9" />
            <path d="M73 59H78M27 54L33 58M118 58L124 54" />
          </g>
        )}
      </g>
      {c.hat === "beanie" && (
        <g>
          <path d="M17 47Q13 0 75 2Q136 0 133 47Z" fill={c.hatColor} />
          <path d="M17 39Q76 27 133 39V51Q75 39 17 51Z" fill="#fff2c9" />
          <circle cx="75" cy="2" r="11" fill={c.hatColor} />
        </g>
      )}
      {c.hat === "cap" && (
        <g>
          <path d="M19 43Q19 0 76 4Q124 0 130 43Z" fill={c.hatColor} />
          <path d="M15 42Q83 32 143 45L143 53Q76 43 15 53Z" fill={c.hatColor} />
          <path d="M75 5V35" stroke="#000" strokeOpacity=".15" fill="none" />
        </g>
      )}
      {portrait && null}
    </g>
  );
}
export function Portrait({
  c,
  className = "",
}: {
  c: CharacterData;
  className?: string;
}) {
  const scale = characterScale(c);
  return (
    <svg
      className={`portrait ${className}`}
      viewBox={`${75 * (1 - scale)} ${180 * (1 - scale)} ${150 * scale} ${180 * scale}`}
      aria-label={c.name}
    >
      <CharacterArt c={c} portrait />
    </svg>
  );
}
