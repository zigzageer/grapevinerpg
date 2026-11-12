import type { BasicMoveId, Move, SignatureMove } from "./combat";
import type { Character, GeneratedAbility } from "./model";

export const BASIC_MOVES: Record<BasicMoveId, Move>;
export function isStudioPng(value: unknown): value is string;
export function normalizeGeneratedAbility(
  input: unknown,
): GeneratedAbility | undefined;
export function castPreset(
  character: Pick<Character, "id" | "preset">,
): Character["preset"];
export function getSignatureMoves(
  character: Character,
): readonly SignatureMove[];
