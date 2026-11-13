import { useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  ImagePlus,
  Plus,
  RotateCcw,
  Upload,
  Check,
} from "lucide-react";
import type { Character, Hair, Hat } from "../game/model";
import {
  createCrewMember,
  parseCrew,
  characterKey,
  MINT_CREW_LIMIT,
} from "../game/model";
import { ADDITIONAL_BIOS } from "../game/character-bios";
import { Portrait } from "./Character";
import { Modal } from "./Modal";
interface Props {
  crew: Character[];
  initialCharacterId?: string;
  onPlay?: (character: Character) => void;
  onChange: (crew: Character[]) => void;
  onClose: () => void;
  notify: (s: string) => void;
}
const colors = [
  "#c66c45",
  "#6a9183",
  "#8e86a6",
  "#497795",
  "#d5ad58",
  "#a9515a",
  "#394c44",
  "#eee2bd",
];
export function CrewEditor({
  crew,
  onChange,
  onClose,
  notify,
  initialCharacterId,
  onPlay,
}: Props) {
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      crew.findIndex((c) => characterKey(c) === initialCharacterId),
    ),
  );
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null),
    spriteRef = useRef<HTMLInputElement>(null);
  const index = Math.min(selected, crew.length - 1),
    c = crew[index];
  const additionalBio = c.preset ? ADDITIONAL_BIOS[c.preset] : undefined;
  const update = (partial: Partial<Character>) =>
    onChange(crew.map((m, i) => (i === index ? { ...m, ...partial } : m)));
  const exportCrew = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { app: "adventures-of-mint", version: 1, crew },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mint-and-friends.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Crew exported. Keep this file as a backup.");
  };
  const importCrew = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 8_000_000)
        throw new Error("Choose a JSON file smaller than 8 MB.");
      const imported = parseCrew(JSON.parse(await file.text()));
      const friends = (
        imported[0]?.kind === "mint" ? imported.slice(1) : imported
      ).slice(0, MINT_CREW_LIMIT - 1);
      onChange([
        crew[0],
        ...friends.map((m, i) => ({
          ...m,
          id: `friend-${i + 1}`,
          kind: "human" as const,
        })),
      ]);
      setSelected(0);
      setError("");
      notify(
        `${friends.length} friend${friends.length === 1 ? "" : "s"} imported. Mint is ready to meet them.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not read that crew file.",
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const importSprite = async (file?: File) => {
    if (!file) return;
    try {
      if (!["image/png", "image/webp"].includes(file.type))
        throw new Error("Use a transparent PNG or WebP character image.");
      if (file.size > 1_000_000)
        throw new Error(
          "Use a sprite smaller than 1 MB so your game can save it.",
        );
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read that image."));
        reader.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () =>
          reject(new Error("That image could not be opened."));
        img.src = url;
      });
      update({ sprite: url });
      setError("");
      notify(`${c.name}'s sprite updated.`);
    } catch (e) {
      setError((e as Error).message);
    }
    if (spriteRef.current) spriteRef.current.value = "";
  };
  return (
    <Modal
      title="Mint & the usual suspects"
      eyebrow="THE CHARACTER WORKSHOP"
      onClose={onClose}
      wide
    >
      <p className="modal-intro">
        A tiny peppermint. An increasingly questionable friend group. Make them
        yours.
      </p>
      <div className="crew-tabs">
        {crew.map((m, i) => (
          <button
            className={index === i ? "selected" : ""}
            key={m.id}
            aria-label={m.name}
            onClick={() => setSelected(i)}
          >
            <span className="mini-portrait">
              <Portrait c={m} />
            </span>
            {m.name}
            {index === i && <Check size={14} />}
          </button>
        ))}
        <button
          disabled={crew.length >= MINT_CREW_LIMIT}
          onClick={() => {
            onChange([...crew, createCrewMember(crew.length)]);
            setSelected(crew.length);
          }}
        >
          <Plus size={16} /> Add friend
        </button>
      </div>
      <div className="editor-layout">
        <div className="character-stage">
          <div className="stage-note">
            {index === 0
              ? "OUR UNLIKELY HERO"
              : "CAST MEMBER " + String(index).padStart(2, "0")}
          </div>
          <Portrait c={c} />
          <div className="stage-floor" />
          <strong>{c.name}</strong>
          <span>
            {c.kind === "mint"
              ? "Small. Sweet. Slightly out of his depth."
              : "Personality & backstory: coming together."}
          </span>
          <button
            className="text-button"
            onClick={() => spriteRef.current?.click()}
          >
            <ImagePlus size={15} /> Upload a character sprite
          </button>
          {(c.sprite || c.preset) && (
            <button
              className="text-button"
              onClick={() => update({ sprite: undefined, preset: undefined })}
            >
              <RotateCcw size={13} /> Restore cutout character
            </button>
          )}
        </div>
        <div className="editor-fields">
          <label className="field">
            Character name
            <input
              maxLength={28}
              value={c.name}
              onChange={(e) => update({ name: e.target.value })}
              onBlur={() => {
                if (!c.name.trim())
                  update({ name: index === 0 ? "Mint" : `Friend ${index}` });
              }}
            />
          </label>
          {c.kind === "mint" ? (
            <div className="mint-note">
              <span className="eyebrow">MEET MINT</span>
              <h3>A fresh face in a strange little town.</h3>
              <p>
                Mint’s first sprite was generated from your peppermint
                reference. His friends, personality, and adventure are ours to
                dream up next.
              </p>
              <span className="small-badge">Original AI-generated sprite</span>
            </div>
          ) : additionalBio && !c.sprite ? (
            <div className="mint-note">
              <span className="eyebrow">MEET {c.name.toUpperCase()}</span>
              <h3>{additionalBio.title}</h3>
              <p>{additionalBio.description}</p>
              <span className="small-badge">Original character sprite</span>
            </div>
          ) : c.preset === "flag-girl" && !c.sprite ? (
            <div className="mint-note">
              <span className="eyebrow">MEET THE NEW GIRL</span>
              <h3>Big muscles. Ancient wings.</h3>
              <p>
                Long brown hair, a blue bow, gold bracelets, and a bodybuilder
                build. Her navy shirt carries a golden human-headed, winged
                lion—the lamassu—and she holds the Persian lion-and-sun flag.
              </p>
              <span className="small-badge">Original character sprite</span>
            </div>
          ) : c.preset === "baguette-guy" && !c.sprite ? (
            <div className="mint-note">
              <span className="eyebrow">MEET THE NEW GUY</span>
              <h3>A strong jaw. An even stronger baguette.</h3>
              <p>
                Light skin, swept-back black hair, a square jaw, and a baguette
                in hand. His name and story are yours to decide.
              </p>
              <span className="small-badge">Original character sprite</span>
            </div>
          ) : (
            <>
              <div className="field-row">
                <label className="field">
                  Hair
                  <select
                    value={c.hair}
                    onChange={(e) => update({ hair: e.target.value as Hair })}
                  >
                    <option value="short">Short</option>
                    <option value="messy">Messy</option>
                    <option value="long">Long</option>
                    <option value="curly">Curly</option>
                    <option value="bald">No hair</option>
                  </select>
                </label>
                <label className="field">
                  Hat
                  <select
                    value={c.hat}
                    onChange={(e) => update({ hat: e.target.value as Hat })}
                  >
                    <option value="none">No hat</option>
                    <option value="beanie">Beanie</option>
                    <option value="cap">Cap</option>
                  </select>
                </label>
              </div>
              <div className="field-row">
                <label className="field color-field">
                  Skin tone
                  <input
                    type="color"
                    value={c.skin}
                    onChange={(e) => update({ skin: e.target.value })}
                  />
                </label>
                <label className="field color-field">
                  Hair color
                  <input
                    type="color"
                    value={c.hairColor}
                    onChange={(e) => update({ hairColor: e.target.value })}
                  />
                </label>
                <label className="field color-field">
                  Hat color
                  <input
                    type="color"
                    value={c.hatColor}
                    onChange={(e) => update({ hatColor: e.target.value })}
                  />
                </label>
              </div>
              <fieldset className="swatch-field">
                <legend>Jacket color</legend>
                <div className="swatches">
                  {colors.map((color) => (
                    <button
                      key={color}
                      aria-label={`Jacket ${color}`}
                      aria-pressed={c.shirt === color}
                      style={{ background: color }}
                      onClick={() => update({ shirt: color })}
                    >
                      {c.shirt === color && <Check size={17} />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={c.shirt}
                    onChange={(e) => update({ shirt: e.target.value })}
                    aria-label="Custom jacket color"
                  />
                </div>
              </fieldset>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={c.glasses}
                  onChange={(e) => update({ glasses: e.target.checked })}
                />{" "}
                Give them glasses
              </label>
              {(c.sprite || c.preset) && (
                <p className="muted">
                  Your character sprite is in use. Restore the cutout character
                  to see these appearance controls.
                </p>
              )}
            </>
          )}
          <div className="creator-callout">
            <div>
              <span className="eyebrow">WANT MORE DETAIL?</span>
              <h3>Build a South Park–style friend.</h3>
              <p>
                Use Paper Town’s full creator, export a transparent PNG, then
                upload it here. Crew JSON imports names and basic traits; PNG
                keeps the exact look.
              </p>
            </div>
            <a
              className="button secondary"
              href="https://limittox.github.io/south-park-character-creator/"
              target="_blank"
              rel="noreferrer"
            >
              Open character creator <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <footer className="modal-footer">
        <div className="button-row">
          <button
            className="button subtle"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={15} /> Import crew
          </button>
          <button className="button subtle" onClick={exportCrew}>
            <Download size={15} /> Export crew
          </button>
        </div>
        <button
          className="button primary"
          onClick={() => {
            onPlay?.(c);
            onClose();
          }}
        >
          {onPlay ? `Play as ${c.name}` : "Back to town"} <span>→</span>
        </button>
      </footer>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void importCrew(e.target.files?.[0])}
      />
      <input
        ref={spriteRef}
        type="file"
        accept="image/png,image/webp"
        hidden
        onChange={(e) => void importSprite(e.target.files?.[0])}
      />
    </Modal>
  );
}
