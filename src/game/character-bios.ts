import type { Character } from "./model";

export const ADDITIONAL_BIOS: Partial<
  Record<
    NonNullable<Character["preset"]>,
    { title: string; description: string }
  >
> = {
  loralei: {
    title: "Meet Loralei.",
    description:
      "Loralei is an adult sex worker with brown hair, bold makeup, a black vintage cap, glossy black fashion clothing, patterned tights, and high heels.",
  },
  samira: {
    title: "Making an entrance.",
    description:
      "Samira is an Arab woman with brown skin, dark brown hair, and enormous cosmetic filler lips.",
  },
  genesis: {
    title: "Never walks alone.",
    description:
      "Genesis has brown skin, a curly afro, and glasses. His little puppy joins him on a red leash wherever he goes.",
  },
  kain: {
    title: "A very well-dressed frog.",
    description:
      "Kain is a green Pepe-style frog with gold glasses and a pinstripe three-piece suit, complete with waistcoat and gold tie.",
  },
  footjobofsteel: {
    title: "Built like a bear.",
    description:
      "Footjobofsteel is a golden yellow bear with enormous muscles, a red athletic top, and brown shorts.",
  },
  rocky: {
    title: "Meet Rocky.",
    description:
      "Rocky is Israeli. He wears a black Hasidic hat and coat, side curls, and an olive IDF vest.",
  },
  miel: {
    title: "Bunny ears. A glass of rosé.",
    description:
      "Miel has light skin, long brown hair, full lip-filler lips, and a bunny-ear headband. She carries a glass of pink rosé wine.",
  },
  zippy: {
    title: "Short, strong, and full of energy.",
    description:
      "Zippy is gay, short, stocky, and muscular, with a bright floral shirt and a rainbow wristband. His arm patches read “HIV +” and “I HAVE AIDS.”",
  },
  jat: {
    title: "A strong jaw and a favorite mug.",
    description:
      "Jat is Sri Lankan, with dark brown skin and a strong square jaw. He wears the Sri Lankan flag on his shirt and carries an Asuka coffee mug.",
  },
};
