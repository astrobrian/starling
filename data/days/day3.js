
{ // (this day's own names stay inside: see day1.js)
window.DAYS = window.DAYS || {};

DAYS[3] = {
  chapter: 1,
  weather: "sunny",

  morning: {
    world: { after: [{ place: "room", thing: "window", variant: 4 }] },
    steps: [
      { scene: [{ magpie: { carry: "flower" } }, { magpie: "joy" }, { wait: 0.5 }] },
      "good_morning",
      "d3_flower",
      { scene: [
        { magpie: { carry: null } },
        { world: [{ place: "room", thing: "window", variant: 4 }] },
        { sound: "pickup" }, { emote: "heart" }, { wait: 0.6 },
      ] },
      "d3_window",
      { learn: ["flower"] },
      "d3_come_out",
      { magpie: "away" },
    ],
  },

  out: [
    { outside: { alone: true } },
    { magpie: { sit: { thing: "persimmonTree", dx: 24, dy: -25 }, sortAfter: "persimmonTree", face: "left" } },
    { near: { thing: "persimmonTree" }, reach: 3.5, stop: 0, hint: "d3_come_out", tapWalks: ["magpie"], guide: true },
    { scene: [{ magpie: "joy" }, { emote: "heart" }, { wait: 0.4 }] },
    { magpie: "follow" },
  ],

  favors: [
    {
      id: "feeder",
      noon: true,
      birds: [
        { id: "tit", species: "tit", at: { thing: "birdFeeder", dx: 4, dy: -21 }, does: "perch", sortAfter: "birdFeeder", faceLeft: true, thought: "seeds" },
      ],
      world: {
        during: [{ thing: "birdFeeder", variant: 1 }],
        after: [{ today: true, birds: [{ id: "tit", species: "tit", at: { thing: "birdFeeder", dx: 4, dy: -21 }, does: "perch", sortAfter: "birdFeeder", faceLeft: true }] }],
      },
      steps: [
        { meet: "tit", lead: "d3_lead_tit", ahead: true },
        { moment: "birdEats", bird: "tit", pecks: 2, celebrate: false },
        "d3_empty",
        { scene: [{ magpie: { perch: { thing: "birdFeeder", dx: -6, dy: -21 }, sortAfter: "birdFeeder" } }, { wait: 0.9 }, { act: "shake", on: "magpie" }] },
        "d3_empty_this",
        { magpie: "follow" },
        { guide: { thing: "seedSack", dy: -14 }, talking: true },
        "d3_seeds",
        { fetch: "seeds", from: "seedSack", guide: true, hint: "d3_seeds", learn: ["seed"] },
        { give: "seeds", to: "birdFeeder", guide: true, hint: "d3_back", learn: ["feeder", "empty"] },
        { moment: "feederFill", bird: "tit", flock: [{ id: "sparrow", species: "sparrow" }, { species: "tit", count: 1 }, { species: "sparrow", count: 1 }, { species: "tit", count: 1 }] },
        { say: "d3_tit_yum", learn: ["full"] },
        { friend: "tit" },
        { bird: "sparrow", celebrate: true },
        "d3_sparrow",
        { scene: [{ magpie: { perch: { thing: "birdFeeder", dx: -20, dy: 9 } } }, { wait: 0.8 }] },
        "d3_eat",
        { magpie: "follow" },
      ],
    },

    {
      id: "flowers",
      birds: [
        { id: "bulbul", species: "bulbul", at: { patch: 0, dx: 8, dy: -40 }, does: "ground", range: 0.3, faceLeft: true, shy: false },
      ],
      world: { after: [{ today: true, birds: [
        { id: "bulbul", species: "bulbul", at: { patch: 0, dx: 8, dy: -40 }, does: "ground", range: 0.3, faceLeft: true, shy: false, look: { pollen: true }, portrait: true },
      ] }] },
      steps: [
        { meet: "bulbul", lead: "d3_lead_bulbul", ahead: true },
        "d3_bulbul",
        { scene: [{ magpie: { perch: { thing: "berryBush", near: { patch: 0 }, dx: -13, dy: 1 } } }, { wait: 0.9 }, { thought: "berry" }, { wait: 0.5 },
          { thought: "plum" }, { wait: 0.5 },
          { emote: "exclaim" }, { thought: "persimmonLater" }, { wait: 0.3 }] },
        "d3_persimmon",
        { thought: null },
        { magpie: "follow" },
        { thought: "flowers", on: "bulbul" },
        "d3_want_flowers",
        { thought: "flowerRed", on: "bulbul" },
        "d3_red",
        { give: "flowerRed", to: { bird: "bulbul" }, from: { thing: "flower", color: "red", patch: 0 }, thought: "flowerRed", emote: "sparkles", hint: "d3_red", learn: ["give", "red"] },
        { moment: "birdEats", bird: "bulbul", item: "flowerRed", pecks: 2, celebrate: false },
        { thought: "flowerYellow", on: "bulbul" },
        "d3_yellow",
        { give: "flowerYellow", to: { bird: "bulbul" }, from: { thing: "flower", color: "yellow", patch: 0 }, thought: "flowerYellow", emote: "sparkles", hint: "d3_yellow", learn: ["yellow"] },
        { moment: "birdEats", bird: "bulbul", item: "flowerYellow", pecks: 2, celebrate: false },
        { thought: "flowerPink", on: "bulbul" },
        "d3_pink",
        { give: "flowerPink", to: { bird: "bulbul" }, from: { thing: "flower", color: "pink", patch: 0 }, thought: "flowerPink", emote: "sparkles", hint: "d3_pink", learn: ["pink"] },
        { moment: "birdEats", bird: "bulbul", item: "flowerPink", pecks: 2, celebrate: false },
        { thought: "flowerWhite", on: "bulbul" },
        "d3_white",
        { give: "flowerWhite", to: { bird: "bulbul" }, from: { thing: "flower", color: "white", patch: 0 }, thought: "flowerWhite", emote: "sparkles", hint: "d3_white", learn: ["white"] },
        { moment: "birdEats", bird: "bulbul", item: "flowerWhite", pecks: 2, celebrate: false },
        { scene: [{ bird: "bulbul", look: { pollen: true }, portrait: true }, { sound: "twinkle" }, { bird: "bulbul", celebrate: true }, { wait: 1.2 }] },
        "d3_flowers_yum",
        "d3_pollen",
        { bird: "bulbul", act: "flap", wait: false },          // it puffs up, proud
        "d3_pollen_like",
      ],
    },
  ],

  night: {
    lookUp: "d1_look_up",
    lines: ["new_stars", { look: "flower", say: "d3_night" }],
  },
};
}
