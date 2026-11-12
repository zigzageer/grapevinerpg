import { ADDITIONAL_BIOS } from "./character-bios.ts";
import { DEFAULT_CREW } from "./model.ts";

export const mintStudioSeed = {
  characters: DEFAULT_CREW.filter(
    (character) =>
      character.kind === "mint" || character.preset || character.sprite,
  ),
  descriptions: Object.fromEntries(
    Object.entries(ADDITIONAL_BIOS).map(([key, value]) => [
      key,
      value.description,
    ]),
  ),
};
