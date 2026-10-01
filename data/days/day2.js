
{ // (this day's own names stay inside: see day1.js)
window.DAYS = window.DAYS || {};

DAYS[2] = {
  chapter: 1,
  weather: "sunny",

  morning: [
    "good_morning",
    { thought: "sun" },
    "d2_morning",
    { thought: null },
    { learn: ["morning"] },
    { guide: { thing: "window", place: "room", dy: -30 }, talking: true },
    "d2_window",
    { near: { thing: "window", place: "room" }, reach: 2.5, stop: 0, hint: "d2_window", tapWalks: ["magpie"] },
    { guide: null },
    { scene: [{ magpie: "joy" }, { emote: "heart" }, { sound: "hearts" }, { wait: 0.5 }], learn: ["window"] },
    { guide: { door: true, place: "room" }, talking: true },
    { magpie: { face: "right" } },
    "d2_door",
    { guide: null },
    { magpie: "away" },
  ],

  out: [{ outside: {}, learn: ["door"] }],

  favors: [
    {
      id: "house",
      steps: [
        { scene: [{ magpie: { perch: { thing: "house", dx: -14, dy: 28 } } }, { wait: 0.9 }, { magpie: { face: "left" } }] },
        "d2_house",
        { learn: ["house"] },
        { magpie: "follow" },
      ],
    },

    {
      id: "feather",
      noon: true,
      birds: [
        { id: "sparrow", species: "sparrow", at: SPOTS.sparrowBranch, does: "perch", sortAfter: "bigTree", faceLeft: false,
          thought: "feather", look: { tail: { length: 1 } } },
      ],
      world: { after: [{ today: true, birds: [
        { id: "sparrow", species: "sparrow", at: SPOTS.sparrowBranch, does: "perch", sortAfter: "bigTree", faceLeft: false },
      ] }] },
      steps: [
        { meet: "sparrow", lead: "d2_lead", ahead: true },
        "d2_lost",
        "d2_find",
        { find: "feather", at: { ...SPOTS.roses, dx: 32, dy: 14.4 }, variant: 2, hint: "d2_find_this" },
        { resume: "found", hold: "feather" },
        { give: "feather", to: { bird: "sparrow" }, hint: "d2_lost" },
        { scene: [{ bird: "sparrow", look: null, thought: null, celebrate: true }, { wait: 1.0 }] },
        { say: "d2_found", learn: ["lost", "feather", "find"] },
      ],
    },

    {
      id: "persimmon",
      birds: [
        { id: "bulbul", species: "bulbul", at: { thing: "persimmonTree", dx: -12, dy: -40 }, does: "perch", sortAfter: "persimmonTree", thought: "plum" },
      ],
      world: { after: [
        { thing: "persimmonTree", glow: { dx: 14, dy: -27 } },
        { today: true, birds: [{ id: "bulbul", species: "bulbul", at: SPOTS.bulbulInPlumTree, does: "perch", sortAfter: "plumTree" }] },
      ] },
      steps: [
        { meet: "bulbul", lead: "d2_lead_bulbul", friendLead: "d2_lead_bulbul_back", ahead: true },
        { moment: "birdEats", bird: "bulbul", pecks: 2, celebrate: false },
        { emote: "sweat", on: "bulbul" },
        "d2_want",
        { scene: [{ magpie: "joy" }, { thought: "berry" }, { wait: 0.3 }] },
        "d2_berry",
        { thought: null },
        { bird: "bulbul", act: "shake" },
        "d2_no_berry",
        { tap: "plumTree", hint: "d2_no_berry" },
        { moment: "fruitDrop", tree: "plumTree", bird: "bulbul", icon: "plum", variant: 0 },
        { say: "d2_bulbul_yum", learn: ["want", "plum"] },
        { friend: "bulbul" },
        { resume: "plum", steps: [{ bird: "bulbul", thought: null, flyTo: SPOTS.bulbulInPlumTree, sortAfter: "plumTree" }] },
        { scene: [
          { magpie: { perch: SPOTS.magpieByPersimmon, sortAfter: "persimmonTree", face: "left" } },
          { wait: 0.9 },
        ] },
        { guide: { thing: "persimmonTree", dx: 13, dy: -33 }, talking: true },
        "d2_persimmon",
        { tap: "persimmonTree", hint: "d2_persimmon", learn: ["persimmon"] },
        { guide: null },
        { thought: "persimmonLater" },
        { moment: "birdEats", magpie: true, pecks: 2, celebrate: false, lines: { during: "d2_later" } },
        { scene: [{ world: [{ thing: "persimmonTree", glow: { dx: 14, dy: -27 } }] }, { sound: "twinkle" }, { wait: 0.4 }] },
        { guide: { thing: "persimmonTree", dx: 13, dy: -33 }, talking: true },
        "d2_save",
        { guide: null },
        { thought: null },
        { learn: ["save"] },
        "d2_bulbul_ok",
        { bird: "bulbul", flyTo: SPOTS.bulbulInPlumTree, sortAfter: "plumTree" },
        { magpie: "follow" },
      ],
    },
  ],

  night: {
    lookUp: "d1_look_up",
    lines: ["new_stars", { look: "persimmon", say: "d2_night" }],
  },
};
}
