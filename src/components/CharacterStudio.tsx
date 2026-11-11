import { useCallback, useEffect, useRef, useState } from "react";
import {
  History,
  ImagePlus,
  LoaderCircle,
  Plus,
  RotateCcw,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Modal } from "./Modal";
import { Portrait } from "./Character";
import { normalizeCharacter, type Character } from "../game/model";
import {
  studioRequest,
  StudioRequestError,
  type CharacterHistory,
  type CharacterVersion,
  type GenerationJob,
  type Quota,
  type StudioGame,
} from "../game/studio";

interface Props {
  gameId: string;
  initialCharacterId?: string;
  onClose: () => void;
  onPublished: (game: StudioGame, characterId: string) => void;
}
interface ReferenceImage {
  type: string;
  base64: string;
  preview: string;
  name: string;
}

export function CharacterStudio({
  gameId,
  initialCharacterId,
  onClose,
  onPublished,
}: Props) {
  const [game, setGame] = useState<StudioGame | null>(null);
  const [drafts, setDrafts] = useState<Character[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [mode, setMode] = useState<"add" | "edit">(
    initialCharacterId ? "edit" : "add",
  );
  const [selectedId, setSelectedId] = useState(initialCharacterId || "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<ReferenceImage | null>(null);
  const [useCurrent, setUseCurrent] = useState(true);
  const [history, setHistory] = useState<CharacterHistory | null>(null);
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
  const characters = [
    ...(game?.characters || []),
    ...drafts.filter(
      (draft) => !game?.characters.some((c) => c.id === draft.id),
    ),
  ];

  const loadCharacter = useCallback(
    async (character: Character, preferredVersion?: string) => {
      const token = ++selection.current;
      setMode("edit");
      setSelectedId(character.id);
      setName(character.name);
      setDescription("");
      setHistory(null);
      setPreview(null);
      setUseCurrent(true);
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
      }
    },
    [gameId],
  );

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    Promise.allSettled([
      studioRequest<StudioGame>(
        `/games/${gameId}`,
        undefined,
        controller.signal,
      ),
      studioRequest<Quota>("/quota", undefined, controller.signal),
      studioRequest<Character[]>(
        `/drafts/${gameId}`,
        undefined,
        controller.signal,
      ),
    ]).then((results) => {
      if (disposed) return;
      const [town, allowance, savedDrafts] = results;
      if (town.status === "fulfilled") {
        setGame(town.value);
        const current = town.value.characters.find(
          (c) => c.id === initialCharacterId,
        );
        if (current) void loadCharacter(current);
      } else
        setError(
          town.reason instanceof Error
            ? town.reason.message
            : "The character studio could not load.",
        );
      if (allowance.status === "fulfilled") setQuota(allowance.value);
      else
        setError(
          "Generation allowance could not be checked. Try reconnecting.",
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
  }, [gameId, initialCharacterId, reload, loadCharacter, storageKey]);

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
        setJob(next);
        setQuota(next.quota);
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
  }, [pendingId, gameId, loadCharacter, storageKey]);

  const clearImage = () => {
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };
  const addMyself = () => {
    selection.current++;
    setMode("add");
    setSelectedId("");
    setName("");
    setDescription("");
    setPreview(null);
    setHistory(null);
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
    if (busy || !quota?.remaining || !game) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    const requestId = crypto.randomUUID();
    try {
      const next = await studioRequest<GenerationJob>("/generations", {
        requestId,
        gameId,
        ...(mode === "edit" ? { characterId: selectedId } : {}),
        name: name.trim(),
        description,
        useCurrent: mode === "edit" && useCurrent,
        ...(mode === "edit" && preview
          ? { referenceVersionId: preview.id }
          : {}),
        ...(image ? { image: { type: image.type, base64: image.base64 } } : {}),
      });
      try {
        localStorage.setItem(storageKey, next.id);
      } catch {
        /* The server retains the generation and history. */
      }
      setQuota(next.quota);
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
        setQuota(accepted.quota);
        setJob(accepted);
        setPendingId(accepted.id);
      } else {
        const next = await studioRequest<Quota>("/quota").catch(() => null);
        if (next) setQuota(next);
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
      title="Make your character"
      className="game-modal studio-modal"
      onClose={onClose}
      wide
    >
      <div className="studio-heading-row">
        <div className="studio-modes" aria-label="Character creation mode">
          <button
            className={mode === "add" ? "selected" : ""}
            disabled={busy || !game}
            onClick={addMyself}
          >
            <Plus size={16} /> Add myself
          </button>
          <button
            className={mode === "edit" ? "selected" : ""}
            disabled={busy || !characters.length}
            onClick={() => {
              const character =
                characters.find((c) => c.id === selectedId) || characters[0];
              if (character) {
                clearImage();
                void loadCharacter(character);
              }
            }}
          >
            <UserRound size={16} /> Edit character
          </button>
        </div>
        <span className="studio-quota" aria-live="polite">
          {quota
            ? `${quota.remaining} of ${quota.limit} attempts left`
            : "Checking attempts…"}
        </span>
      </div>
      <p className="studio-allowance">
        Three generation attempts per IP address across this site. Adding,
        editing, and regenerating each use one attempt. Saved versions can be
        restored for free.
      </p>
      <div className="studio-layout">
        <form className="studio-form" onSubmit={generate}>
          <fieldset disabled={busy || applying || !game || !quota}>
            {mode === "edit" && (
              <label className="field">
                Character
                <select
                  aria-label="Character to edit"
                  value={selectedId}
                  onChange={(event) => {
                    const character = characters.find(
                      (c) => c.id === event.target.value,
                    );
                    if (character) {
                      clearImage();
                      void loadCharacter(character);
                    }
                  }}
                >
                  {!selectedId && <option value="">Choose a character</option>}
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {game?.characters.some((item) => item.id === c.id)
                        ? ""
                        : " (saved draft)"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              Character name
              <input
                aria-label="Character name"
                required
                maxLength={28}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
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
            {mode === "edit" && (
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
            <button
              className="button primary studio-generate"
              type="submit"
              disabled={
                !quota?.remaining ||
                !name.trim() ||
                (mode === "edit" && !selectedId)
              }
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
                  : preview?.source === "website"
                    ? "Regenerate"
                    : mode === "edit"
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
              <Portrait
                c={normalizeCharacter({
                  ...preview.character,
                  sprite: preview.image || preview.character.sprite,
                })}
              />
            ) : (
              <UserRound size={68} strokeWidth={1.2} />
            )}
          </div>
          <strong>{preview?.character.name || name || "Your character"}</strong>
          {busy && (
            <p className="studio-progress" role="status">
              <LoaderCircle size={16} className="studio-spinning" />
              {readingImage
                ? "Reading your reference…"
                : job?.status === "running"
                  ? "Codex is creating your character…"
                  : "Your character is queued…"}
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
      {(!game || !quota) && (
        <button
          className="button secondary"
          onClick={() => {
            setError("");
            setReload((old) => old + 1);
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
                  <Portrait
                    c={normalizeCharacter({
                      ...version.character,
                      sprite: version.image || version.character.sprite,
                    })}
                  />
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
