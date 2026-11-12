import { Banknote, Moon, Sparkles } from "lucide-react";
import { abilityArtUrl } from "../game/art";
import type { BattleEvent } from "../game/combat";
import type { Character } from "../game/model";
import { CharacterArt } from "./Character";
import "../babashark-battle.css";

export function BabasharkEffects({
  event,
  source,
}: {
  event: BattleEvent;
  source: Character;
}) {
  switch (event.visual) {
    case "diddy-party":
      return (
        <>
          <div className="babashark-party">
            <div className="babashark-disco">
              <Sparkles />
            </div>
          </div>
          {event.slept && (
            <span className="babashark-sleep-mark">
              <Moon /> Zzz
            </span>
          )}
        </>
      );
    case "kick-the-baby":
      return (
        <>
          <svg className="babashark-kick-boot" viewBox="0 0 110 48">
            <path d="M0 27 54 10 69 24 15 43Z" fill="#35333b" />
            <path
              d="m48 12 30-6 8 14 18 1 6 9-7 8-29 2-13-7Z"
              fill="#252229"
              stroke="#151319"
              strokeWidth="3"
            />
            <path d="m79 31 23 1" stroke="#6c6670" strokeWidth="2" />
          </svg>
          <img
            className="babashark-baby-flight"
            src={abilityArtUrl("babashark-daughter")}
            alt=""
            draggable={false}
          />
        </>
      );
    case "simps-assemble":
      return (
        <>
          <div className="babashark-simps">
            <img
              src={abilityArtUrl("simps-assemble")}
              alt=""
              draggable={false}
            />
            <span>Haku</span>
            <span>bellyache</span>
          </div>
          <Banknote className="babashark-cash first" />
          <Banknote className="babashark-cash second" />
        </>
      );
    case "chaz":
      return (
        <div className="babashark-car">
          <div className="babashark-car-facing">
            <img
              src={abilityArtUrl("chaz-corvette")}
              alt=""
              draggable={false}
            />
            <svg className="babashark-passenger" viewBox="24 0 104 103">
              <CharacterArt c={source} portrait />
            </svg>
            <img
              className="babashark-car-baby"
              src={abilityArtUrl("babashark-daughter")}
              alt=""
              draggable={false}
            />
            <div className="babashark-tire-smoke">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}
