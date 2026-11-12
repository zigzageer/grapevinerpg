import { useCallback, useEffect, useRef, useState } from "react";
import {
  History,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Swords,
  UserRound,
  X,
} from "lucide-react";
import { Modal } from "./Modal";
import { Portrait } from "./Character";
import { normalizeCharacter, type Character } from "../game/model";
import { getSignatureMoves } from "../game/abilities";
import {
  studioRequest,
  StudioRequestError,
  type CharacterHistory,
  type CharacterVersion,
  type GenerationJob,
  type StudioGame,
} from "../game/studio";

interface Props {
  gameId: string;
  initialCharacter?: Character;
  onClose: () => void;
  onPublished: (game: StudioGame, characterId: string) => void;
}
interface ReferenceImage {
  type: string;
  base64: string;
  preview: string;
  name: string;
}

function previewCharacter(
  version: CharacterVersion,
  gameId: string,
): Character {
  const character = normalizeCharacter(version.character);
  if (
    /^\d{17,20}$/.test(gameId) &&
    /^discord-\d{17,20}$/.test(character.id) &&
    version.character.sprite === `/games/${gameId}/${character.id.slice(8)}.png`
  ) {
    return { ...character, sprite: version.character.sprite };
  }
  return character;
}

export function CharacterStudio({
  gameId,
  initialCharacter,
  onClose,
  onPublished,
}: Props) {
  const [game, setGame] = useState<StudioGame | null>(null);
  const [drafts, setDrafts] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState(initialCharacter?.id ?? "");
  const [name, setName] = useState(initialCharacter?.name || "");
  const [description, setDescription] = useState("");
  const [abilityPrompt, setAbilityPrompt] = useState("");
  const [abilityOnly, setAbilityOnly] = useState(false);
  const [image, setImage] = useState<ReferenceImage | null>(null);
  const [useCurrent, setUseCurrent] = useState(true);
  const [history, setHistory] = useState<CharacterHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(
    Boolean(initialCharacter),
  );
  const [showHistory, setShowHistory] = useState(false);
  const [preview, setPreview] = useState<CharacterVersion | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const selection = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const storageKey = `mint.studio.job.${gameId}`;
  const busy = readingImage || submitting || Boolean(pendingId);
  const editing = Boolean(selectedId);
  const moveOnly = editing && abilityOnly;
  const previewMoves = preview ? getSignatureMoves(preview.character) : [];
  const unpublished = drafts.filter(
    (draft) => !game?.characters.some((c) => c.id === draft.id),
  );
  const selectedDraft = unpublished.find((draft) => draft.id === selectedId);
  const formDisabled =
    busy ||
    applying ||
    loadingHistory ||
    (editing && !history) ||
    !game;

  const loadCharacter = useCallback(
    async (character: Character, preferredVersion?: string) => {
      const token = ++selection.current;
      setSelectedId(character.id);
      setName(character.name);
      setDescription("");
      setHistory(null);
      setLoadingHistory(true);
      setShowHistory(false);
      setPreview(null);
      setUseCurrent(true);
      if (!preferredVersion) {
        setAbilityOnly(false);
        setAbilityPrompt("");
      }
      setError("");
      setMessage("");
      try {
        const next = await studioRequest<CharacterHistory>(
          `/games/${gameId}/characters/${character.id}/history`,
        );
        if (selection.current !== token) return;
        const version =
          next.versions.find(
            (item) => item.id === (preferredVersion || next.currentVersionId),
          ) || next.versions[0];
        setHistory(next);
        if (version) {
          setPreview(version);
          setName(version.character.name);
          setDescription(version.description);
        }
      } catch (e) {
        if (selection.current === token) setError((e as Error).message);
      } finally {
        if (selection.current === token) setLoadingHistory(false);
      }
    },
    [gameId],
  );

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    if (initialCharacter) void loadCharacter(initialCharacter);
    Promise.allSettled([
      studioRequest<StudioGame>(
        `/games/${gameId}`,
        undefined,
        controller.signal,
      ),
      initialCharacter
        ? Promise.resolve([])
        : studioRequest<Character[]>(
            `/drafts/${gameId}`,
            undefined,
            controller.signal,
          ),
    ]).then((results) => {
      if (disposed) return;
      const [town, savedDrafts] = results;
      if (town.status === "fulfilled") setGame(town.value);
      else
        setError(
          town.reason instanceof Error
            ? town.reason.message
            : "The character studio could not load.",
        );
      if (savedDrafts.status === "fulfilled") setDrafts(savedDrafts.value);
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) setPendingId(saved);
      } catch {
        /* Generation can continue when device storage is unavailable. */
      }
    });
    return () => {
      disposed = true;
      controller.abort();
      selection.current++;
    };
  }, [gameId, initialCharacter, reload, loadCharacter, storageKey]);

  useEffect(() => {
    if (!pendingId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await studioRequest<GenerationJob>(
          `/jobs/${pendingId}`,
          undefined,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        // A saved job belongs to its own character, even when a different
        // character's editor is opened before that job finishes.
        if (
          selectedId
            ? next.characterId !== selectedId
            : game?.characters.some((c) => c.id === next.characterId)
        ) {
          setPendingId(null);
          return;
        }
        setJob(next);
        if (next.status === "succeeded" && next.result) {
          setPendingId(null);
          const character = next.result.character;
          setDrafts((old) => [
            ...old.filter((c) => c.id !== character.id),
            character,
          ]);
          await loadCharacter(character, next.result.versionId);
          return;
        }
        if (next.status === "failed") {
          setPendingId(null);
          setError(
            next.error ||
              "Generation failed. Your saved versions are available in history.",
          );
          try {
            localStorage.removeItem(storageKey);
          } catch {
            /* Optional device storage. */
          }
          return;
        }
        timer = setTimeout(poll, 2000);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError((e as Error).message);
          if (
            e instanceof StudioRequestError &&
            [403, 404].includes(e.status)
          ) {
            setPendingId(null);
            try {
              localStorage.removeItem(storageKey);
            } catch {
              /* Optional device storage. */
            }
            return;
          }
          timer = setTimeout(poll, 4000);
        }
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pendingId, game, loadCharacter, selectedId, storageKey]);

  const clearImage = () => {
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };
  const startNew = () => {
    selection.current++;
    setSelectedId("");
    setName("");
    setDescription("");
    setAbilityOnly(false);
    setAbilityPrompt("");
    setPreview(null);
    setHistory(null);
    setLoadingHistory(false);
    setShowHistory(false);
    setError("");
    setMessage("");
    clearImage();
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setReadingImage(true);
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 2_000_000
      )
        throw new Error(
          "Choose a PNG, JPEG, or WebP reference smaller than 2 MB.",
        );
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("That reference image could not be read."));
        reader.readAsDataURL(file);
      });
      setImage({
        type: file.type,
        base64: data.split(",")[1],
        preview: data,
        name: file.name,
      });
      setError("");
    } catch (e) {
      setError((e as Error).message);
      clearImage();
    } finally {
      setReadingImage(false);
    }
  };

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = abilityPrompt.trim();
    if (formDisabled || (moveOnly && (!preview || !prompt))) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    const requestId = crypto.randomUUID();
    try {
      const next = await studioRequest<GenerationJob>("/generations", {
        requestId,
        gameId,
        ...(editing ? { characterId: selectedId } : {}),
        ...(moveOnly
          ? { abilityOnly: true }
          : {
              name: name.trim(),
              description,
              useCurrent: editing && useCurrent,
            }),
        ...(prompt ? { abilityPrompt: prompt } : {}),
        ...(editing && preview ? { referenceVersionId: preview.id } : {}),
        ...(!moveOnly && image
          ? { image: { type: image.type, base64: image.base64 } }
          : {}),
      });
      try {
        localStorage.setItem(storageKey, next.id);
      } catch {
        /* The server retains the generation and history. */
      }
      setJob(next);
      setPendingId(next.id);
    } catch (e) {
      setError((e as Error).message);
      // Recover an accepted request if its HTTP response was interrupted.
      const accepted = await studioRequest<GenerationJob>(
        `/jobs/${requestId}`,
      ).catch(() => null);
      if (accepted) {
        try {
          localStorage.setItem(storageKey, accepted.id);
        } catch {
          /* Optional device storage. */
        }
        setJob(accepted);
        setPendingId(accepted.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const apply = async () => {
    if (!preview || !selectedId || applying) return;
    setApplying(true);
    setError("");
    try {
      const next = await studioRequest<StudioGame>(
        `/games/${gameId}/characters/${selectedId}/apply`,
        { versionId: preview.id },
      );
      setGame(next);
      setHistory((old) =>
        old ? { ...old, currentVersionId: preview.id } : old,
      );
      setMessage(`${preview.character.name} is ready in town.`);
      try {
        if (job?.characterId === selectedId)
          localStorage.removeItem(storageKey);
      } catch {
        /* Optional device storage. */
      }
      onPublished(next, selectedId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      title={
        initialCharacter ? `Edit ${initialCharacter.name}` : "Add character"
      }
      className="game-modal studio-modal"
      onClose={onClose}
      wide
    >
      <p className="studio-intro">
        You can generate an appearance and a signature ability together.
        Earlier versions are saved in character history.
      </p>
      <div className="studio-layout">
        <form className="studio-form" onSubmit={generate}>
          {!initialCharacter &&
            unpublished.length > 0 &&
            (!editing || selectedDraft) && (
              <label className="field studio-drafts">
                Saved drafts
                <select
                  disabled={busy || applying || !game}
                  value={selectedDraft?.id ?? ""}
                  onChange={(event) => {
                    const draft = unpublished.find(
                      (c) => c.id === event.target.value,
                    );
                    if (draft) {
                      clearImage();
                      void loadCharacter(draft);
                    } else startNew();
                  }}
                >
                  <option value="">New character</option>
                  {unpublished.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          <fieldset disabled={formDisabled}>
            {editing && preview && (
              <label className="studio-checkbox">
                <input
                  type="checkbox"
                  checked={abilityOnly}
                  onChange={(event) => setAbilityOnly(event.target.checked)}
                />
                Keep this version’s appearance
              </label>
            )}
            <div className="studio-appearance" hidden={moveOnly}>
              <label className="field">
                Character name
                <input
                  aria-label="Character name"
                  required
                  disabled={moveOnly}
                  maxLength={28}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Character name"
                />
              </label>
              <label className="field">
                Appearance details
                <textarea
                  aria-label="Appearance details"
                  maxLength={1000}
                  rows={5}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Hair, clothes, accessories, and anything you’d like to change…"
                />
              </label>
              {editing && (
                <label className="studio-checkbox">
                  <input
                    type="checkbox"
                    checked={useCurrent}
                    onChange={(event) => setUseCurrent(event.target.checked)}
                  />{" "}
                  Use this character as a reference
                </label>
              )}
              <label className="studio-upload">
                <ImagePlus size={19} />
                <span>
                  {image ? image.name : "Upload a reference image"}
                  <small>PNG, JPEG, or WebP · up to 2 MB</small>
                </span>
                <input
                  ref={fileRef}
                  aria-label="Reference image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
              </label>
              {image && (
                <div className="studio-reference">
                  <img src={image.preview} alt="Uploaded character reference" />
                  <button
                    className="text-button"
                    type="button"
                    onClick={clearImage}
                  >
                    <X size={14} /> Remove reference
                  </button>
                </div>
              )}
            </div>
            <label className="field">
              Signature ability{!moveOnly && " (optional)"}
              <textarea
                aria-label="Signature ability"
                required={moveOnly}
                maxLength={500}
                rows={3}
                value={abilityPrompt}
                onChange={(event) => setAbilityPrompt(event.target.value)}
                placeholder="Describe what the move does and what it looks like."
              />
            </label>
            <button
              className="button primary studio-generate"
              type="submit"
              disabled={moveOnly ? !abilityPrompt.trim() : !name.trim()}
            >
              {busy ? (
                <LoaderCircle size={17} className="studio-spinning" />
              ) : preview?.source === "website" ? (
                <RotateCcw size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              {readingImage
                ? "Reading reference…"
                : busy
                  ? "Generating…"
                  : moveOnly
                    ? "Generate ability"
                    : preview?.source === "website"
                      ? "Regenerate"
                      : editing
                        ? "Generate new version"
                        : "Generate character"}
            </button>
          </fieldset>
        </form>
        <section className="studio-preview" aria-label="Character preview">
          <div
            className={`studio-character-stage ${preview ? "" : "studio-stage-empty"}`}
          >
            {preview ? (
              <Portrait c={previewCharacter(preview, gameId)} />
            ) : (
              <UserRound size={68} strokeWidth={1.2} />
            )}
          </div>
          <strong>{preview?.character.name || name || "Your character"}</strong>
          {previewMoves.map((previewMove) => (
            <figure
              key={previewMove.id}
              className="studio-ability"
              aria-label="Signature ability preview"
            >
              <span className="studio-ability-icon">
                {previewMove.art ? (
                  <img src={previewMove.art} alt="" />
                ) : (
                  <Swords size={22} />
                )}
              </span>
              <figcaption>
                <strong>{previewMove.name}</strong>
                <span>
                  {previewMove.cost} PP · {previewMove.description}
                </span>
              </figcaption>
            </figure>
          ))}
          {busy && (
            <p className="studio-progress" role="status">
              <LoaderCircle size={16} className="studio-spinning" />
              {readingImage
                ? "Reading your reference…"
                : job?.status === "running"
                  ? "Codex is creating your preview…"
                  : "Your preview is queued…"}
            </p>
          )}
          {preview && (
            <button
              className="button primary"
              disabled={
                busy || applying || history?.currentVersionId === preview.id
              }
              onClick={() => void apply()}
            >
              {applying
                ? "Saving…"
                : history?.currentVersionId === preview.id
                  ? "Current version"
                  : game?.characters.some((c) => c.id === selectedId)
                    ? "Use this version"
                    : "Add to game"}
            </button>
          )}
          {selectedId && (
            <button
              className="text-button studio-history-toggle"
              onClick={() => setShowHistory((old) => !old)}
            >
              <History size={16} />
              {showHistory
                ? "Hide character history"
                : "Show character history"}
            </button>
          )}
          {message && (
            <p className="studio-message" role="status">
              {message}
            </p>
          )}
        </section>
      </div>
      {error && (
        <p className="studio-error" role="alert">
          {error}
        </p>
      )}
      {(!game || (editing && !loadingHistory && !history)) && (
        <button
          className="button secondary"
          onClick={() => {
            setError("");
            if (game && selectedDraft)
              void loadCharacter(selectedDraft);
            else setReload((old) => old + 1);
          }}
        >
          Reconnect studio
        </button>
      )}
      {showHistory && (
        <section className="studio-history" aria-label="Character history">
          <h3>Character history</h3>
          <p>
            Every successful generation is saved here, including versions you
            haven’t used.
          </p>
          <div className="studio-history-grid">
            {history?.versions.map((version) => (
              <button
                key={version.id}
                className={preview?.id === version.id ? "selected" : ""}
                disabled={busy}
                onClick={() => {
                  setPreview(version);
                  setName(version.character.name);
                  setDescription(version.description);
                  setUseCurrent(true);
                  setMessage("");
                }}
              >
                <span className="studio-version-art">
                  <Portrait c={previewCharacter(version, gameId)} />
                </span>
                <strong>
                  {version.source === "original"
                    ? "Original character"
                    : new Date(version.createdAt).toLocaleString()}
                </strong>
                {history.currentVersionId === version.id && (
                  <span>Current version</span>
                )}
                {version.description && <p>{version.description}</p>}
                {version.character.ability && (
                  <p>{version.character.ability.name}</p>
                )}
              </button>
            ))}
          </div>
          {!history?.versions.length && (
            <p>Your first successful generation will appear here.</p>
          )}
        </section>
      )}
    </Modal>
  );
}
