import type { Character } from "./model";

export const ADDITIONAL_BIOS: Partial<
  Record<
    NonNullable<Character["preset"]>,
    { title: string; description: string }
  >
> = {
  "flag-girl": {
    title: "Sarina carries the Lion and Sun.",
    description:
      "Sarina wears a dark green officer cap and shirt, a black skirt, and gold bracelets. She carries the green, white, and red Lion and Sun flag.",
  },
  babashark: {
    title: "Here comes the officer.",
    description:
      "babashark wears an olive officer uniform and peaked cap. Her little daughter in a pink snowsuit comes along everywhere.",
  },
  "red-light": {
    title: "Always watching.",
    description: "Red Light is a fuzzy brown creature with enormous eyes.",
  },
  peaches: {
    title: "Never charges alone.",
    description:
      "Peaches wears gold armor and a red cloak and travels with a lion.",
  },
  lin: {
    title: "Lin and andre.",
    description:
      "Lin wears a shirt printed with names and carries an Eastern European folk doll labeled ‘andre’.",
  },
  bashu: {
    title: "Watch the ring.",
    description:
      "Bashu has long hair, a bindi, and makeup. Her Indian top reads ‘lookism mod’ and she wears an engagement ring.",
  },
  orrow: {
    title: "Still talking.",
    description:
      "Orrow wears an 18th-century British outfit and chatters through crooked teeth.",
  },
  potato: {
    title: "Sprouted legs.",
    description: "A brown potato with legs.",
  },
  kawaiikitty: {
    title: "Rolling into town.",
    description:
      "kawaiikitty is a Black girl in pink Jirai Kei fashion who rolls around in a pink gaming chair.",
  },
  grace: {
    title: "Right on cue.",
    description:
      "Grace has long blonde hair and makes a cameo in David’s signature move.",
  },
  david: {
    title: "Grace, if you’re reading this…",
    description:
      "David is Armenian, with green eyes and uncovered curly brown hair. He wears a burgundy shirt with a Cupid’s arrow through the middle.",
  },
  tommy: {
    title: "Boots on the ground.",
    description:
      "Tommy wears a red cowboy hat and stitched cowboy boots, with a straw stem between his teeth.",
  },
  steakbutterfan: {
    title: "The burger comes along.",
    description:
      "steakbutterfan is a heavyset man with dark brown skin, a shaved head, a broad cheerful face, a white T-shirt, a purple beaded necklace, dark trousers and sneakers. He holds an enormous layered hamburger with both hands near his mouth, complete with beef, cheese, lettuce, tomato, sauce and a pickle garnish.",
  },
  blindian: {
    title: "Very tall, with two styles.",
    description:
      "blindian is an exceptionally tall, lanky Black-and-Indian man with a vertical split down his face and outfit. One half has a crisp shape-up, an edged beard and goatee, hip-hop streetwear, a chain, a trouser leg and a high-top sneaker. The other half has combed-over hair, half a red forehead dot, a traditional Indian kurta, a traditional trouser leg and a jutti shoe.",
  },
  loralei: {
    title: "Meet Loralei.",
    description:
      "Loralei has long brown hair, dark sunglasses, an olive beret, and a glossy black outfit.",
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
    title: "On call with a power drill.",
    description:
      "Footjobofsteel wears blue nurse scrubs and white sneakers. He carries a yellow cordless drill.",
  },
  rocky: {
    title: "Meet Rocky.",
    description:
      "Rocky is Israeli. He wears a black Hasidic hat and coat, side curls, and an olive IDF vest.",
  },
  miel: {
    title: "Bunny ears and lace-up boots.",
    description:
      "Miel wears a bunny-ear headband, a black turtleneck dress, lace-up boots, gold hoops, and a Star of David necklace. Her long auburn hair fades to pink.",
  },
  zippy: {
    title: "Always time for takeout.",
    description:
      "Zippy wears an oversized olive cap, dark sunglasses, and an open olive uniform. He eats noodles from a takeout carton as he goes.",
  },
  jat: {
    title: "His glasses never stay put.",
    description:
      "Jat has black curls and thick black glasses. He wears a green shirt with the Bangladesh flag and green plaid trousers, and carries a wooden placard.",
  },
};
