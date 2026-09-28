
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
  ],

  favors: [
    {
      id: "feather",
      noon: true,
      birds: [
        { id: "sparrow", species: "sparrow", at: { thing: "bigTree", dx: -20, dy: -19 }, does: "perch", sortAfter: "bigTree", faceLeft: false,
          thought: "feather", look: { tail: { length: 1 } } },
      ],
      world: { after: [{ today: true, birds: [
        { id: "sparrow", species: "sparrow", at: { thing: "bigTree", dx: -20, dy: -19 }, does: "perch", sortAfter: "bigTree", faceLeft: false },
      ] }] },
      steps: [
        { meet: "sparrow", lead: "d2_lead" },
        "d2_lost",
        { find: "feather", at: [17, 23], variant: 2, hint: "d2_lost" },
        { give: "feather", to: { bird: "sparrow" }, hint: "d2_lost" },
        { scene: [{ bird: "sparrow", look: null, thought: null, celebrate: true }, { wait: 1.0 }] },
        { say: "d2_found", learn: ["lost", "feather", "find"] },
        { friend: "sparrow" },
      ],
    },

    {
      id: "persimmon",
      birds: [
        { id: "bulbul", species: "bulbul", at: { thing: "persimmonTree", dx: -12, dy: -40 }, does: "perch", sortAfter: "persimmonTree", thought: "persimmon" },
      ],
      world: { after: [
        { thing: "persimmonTree", variant: 1, glow: { dx: 14, dy: -27 } },
        { today: true, birds: [{ id: "bulbul", species: "bulbul", at: { thing: "persimmonTree", dx: -12, dy: -40 }, does: "perch", sortAfter: "persimmonTree" }] },
      ] },
      steps: [
        { meet: "bulbul", lead: "d2_lead_bulbul", ahead: true },
        "d2_want",
        { tap: "persimmonTree", hint: "d2_want" },
        { moment: "fruitDrop", tree: "persimmonTree", bird: "bulbul" },
        { say: "d2_bulbul_yum", learn: ["want", "persimmon"] },
        { friend: "bulbul" },
        { say: "d2_save", replies: {
          "?": [
            { scene: [{ magpie: { perch: { thing: "persimmonTree", dx: 4, dy: -24 }, sortAfter: "persimmonTree" } }, { wait: 0.8 }] },
            "d2_save_this",
            { magpie: "follow" },
          ],
        } },
        { learn: ["save"] },
        { bird: "bulbul", flyTo: { thing: "persimmonTree", dx: -12, dy: -40 }, sortAfter: "persimmonTree" },
      ],
    },
  ],

  night: {
    lookUp: "d1_look_up",
  },
};
