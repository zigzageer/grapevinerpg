import { useId } from "react";
import { characterArtUrl } from "../game/art";
import type { Character as CharacterData } from "../game/model";
export function CharacterArt({
  c,
  moving = false,
  facing = 1,
  portrait = false,
}: {
  c: CharacterData;
  moving?: boolean;
  facing?: number;
  portrait?: boolean;
}) {
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
  if (sprite)
    return (
      <g className={moving ? "paper-person walking" : "paper-person"}>
        <image
          href={sprite}
          x="0"
          y={c.preset === "zippy" ? 30 : 0}
          width="150"
          height={c.preset === "zippy" ? 150 : 180}
          preserveAspectRatio="xMidYMax meet"
        />
      </g>
    );
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
  return (
    <svg
      className={`portrait ${className}`}
      viewBox="0 0 150 180"
      aria-label={c.name}
    >
      <CharacterArt c={c} portrait />
    </svg>
  );
}
