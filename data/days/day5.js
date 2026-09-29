
{ // (this day's own names stay inside: see day1.js)
window.DAYS = window.DAYS || {};

const D5_BUSH = { thing: "bush", near: [12.5, 24.5] };
const D5_FLOCK = ["pb1", "pb2", "pb3", "pb4"];
const D5_PARROTBILLS = ["parrotbill", ...D5_FLOCK];
const D5_ROW = (i) => [8.5 + i * 0.6, 24.4 + (i % 2) * 0.2];
const D5_BERRY_BUSH = { thing: "berryBush", near: [12.5, 22.5] };

DAYS[5] = {
  chapter: 1,
  weather: "sunny",

  morning: [
    { scene: [{ act: "dance", on: "magpie", wait: false }, { emote: "heart" }, { sound: "hearts" }, { wait: 0.6 }] },
    "good_morning",
    { act: "dance", on: "magpie", seconds: 2.4, wait: false },
    { say: "d5_happy", replies: {
      "?": [{ act: "jump", on: "magpie", wait: false }, { emote: "heart" }, "d5_happy_this"],
    } },
    { learn: ["happy"] },
    { emote: "heart" },
    "come_out",
    { magpie: "away" },
  ],

  favors: [
    {
      id: "party",
      noon: true,
      birds: [
        { id: "parrotbill", species: "parrotbill", at: [15.7, 25.3], does: "ground", range: 0.2, shy: false, faceLeft: true },
        ...D5_FLOCK.map((id) => ({ id, species: "parrotbill", at: D5_BUSH, does: "ground", shy: false })),
      ],
      world: { after: [{ today: true, birds: D5_PARROTBILLS.map((id, i) => (
        { id, species: "parrotbill", at: D5_ROW(i), does: "ground", range: 0.3, shy: false, faceLeft: i % 2 === 1 })) }] },
      steps: [
        { moment: "hideIn", birds: D5_FLOCK, in: D5_BUSH },
        { meet: "parrotbill", lead: "d5_lead", ahead: true },
        { scene: [{ magpie: { perch: { bird: "parrotbill", dx: 18, dy: 1 }, face: "left" } }, { wait: 0.7 }] },
        { emote: "sweat", on: "parrotbill" },
        "d5_small",
        { learn: ["small"] },
        "d5_lost",
        { magpie: "follow" },
        { guide: { ...D5_BUSH, dy: -18 }, talking: true },
        "d5_bush",
        { tap: D5_BUSH, hint: "d5_bush", guide: { ...D5_BUSH, dy: -18 } },
        { moment: "popOut", birds: D5_FLOCK, from: D5_BUSH },
        "d5_many",
        { learn: ["bush", "many"] },
        { scene: [{ moment: "celebrate", birds: D5_PARROTBILLS }] },
        "d5_found_us",
        { friend: "parrotbill" },
        { scene: [
          ...D5_PARROTBILLS.map((bird) => ({ bird, act: "sing", seconds: 6, wait: false })),
          { act: "sing", on: "magpie", seconds: 6, wait: false },
          { wait: 1.2 },
        ] },
        { choose: "d5_sing", replies: { "*": [{ act: "sing" }] } },
        { learn: ["sing"] },
        { scene: [
          ...D5_PARROTBILLS.map((bird) => ({ bird, act: "dance", seconds: 4, wait: false })),
          { act: "dance", on: "magpie", seconds: 4, wait: false },
          { wait: 1.0 },
        ] },
        { choose: "d5_dance", replies: { "*": [{ act: "dance" }] } },
        { learn: ["dance"] },
        { scene: [
          ...D5_PARROTBILLS.map((bird) => ({ bird, act: "jump", seconds: 4, wait: false })),
          { act: "jump", on: "magpie", seconds: 4, wait: false },
          { wait: 1.0 },
        ] },
        { choose: "d5_jump", replies: { "*": [{ act: "jump" }] } },
        { learn: ["jump"] },
        { moment: "runTo", birds: D5_PARROTBILLS, to: D5_ROW(0), wait: false },
        "d5_run",
        { near: "bigTree", reach: 3.2, stop: 0, hint: "d5_run", tapWalks: [...D5_PARROTBILLS, "magpie"] },
        { scene: [...D5_PARROTBILLS.map((bird, i) => ({ bird, flyTo: D5_ROW(i), range: 0.3 })), { wait: 0.8 }] },
        { scene: [{ magpie: "joy" }, { wait: 0.4 }] },
        "d5_big",
        { learn: ["run", "big"] },
      ],
    },

    {
      id: "friends",
      phase: "sunset",
      birds: [
        { id: "f-sparrow1", species: "sparrow", at: { thing: "bigTree", dx: -20, dy: -19 }, does: "perch", sortAfter: "bigTree", faceLeft: false, flyIn: true, shy: false },
        { id: "f-sparrow2", species: "sparrow", at: { thing: "bigTree", dx: -11, dy: -20 }, does: "perch", sortAfter: "bigTree", faceLeft: true, flyIn: true, shy: false },
        { id: "f-bulbul", species: "bulbul", at: { thing: "bigTree", dx: 17, dy: -31 }, does: "perch", sortAfter: "bigTree", faceLeft: true, flyIn: true, shy: false },
        { id: "f-tit1", species: "tit", at: { ...D5_BERRY_BUSH, dx: -5, dy: -14 }, does: "perch", sortAfter: D5_BERRY_BUSH, faceLeft: true, flyIn: true, shy: false },
        { id: "f-tit2", species: "tit", at: { ...D5_BERRY_BUSH, dx: 5, dy: -13 }, does: "perch", sortAfter: D5_BERRY_BUSH, faceLeft: true, flyIn: true, shy: false },
        { id: "f-dove1", species: "dove", at: { thing: "birdBath", dx: -9, dy: -13 }, does: "perch", sortAfter: "birdBath", faceLeft: false, flyIn: true, shy: false },
        { id: "f-dove2", species: "dove", at: { thing: "birdBath", dx: 9, dy: -13 }, does: "perch", sortAfter: "birdBath", faceLeft: true, flyIn: true, shy: false },
      ],
      world: {
        after: [
          { today: true, birds: D5_PARROTBILLS.map((id, i) => (
            { id, species: "parrotbill", at: { ...D5_BUSH, dx: -16 + i * 8, dy: -8 }, does: "perch", sortAfter: D5_BUSH, faceLeft: false, act: "sleep", greets: true })).reverse() },
        ],
      },
      steps: [
        { near: "bigTree", reach: 3.5, stop: 0, lead: "d5_go_tree", onlyIfFar: true, tapWalks: ["magpie"] },
        { phase: "sunset" },
        { wait: 1.2 },
        { moment: "celebrate", birds: "all" },
        "d5_friends",
        { moment: "bringFruit", tree: "plumTree", icon: "plum", to: { her: true, dx: 18, dy: 14 }, variant: 0 },
        "d5_plum",
        "d5_share",
        { moment: "peckTogether", birds: ["f-sparrow1", "f-bulbul", "f-tit1", "parrotbill"], magpie: true, pecks: 4 },
        "d5_sweet",
        { thought: "persimmonLater" },
        "d5_later",
        { thought: null },
        { moment: "celebrate", birds: "all" },
        { magpie: "follow" },
        "d5_say_hello",
        { greet: {
          sparrow: "d5_hi_sparrow",
          bulbul: "d5_hi_bulbul",
          tit: "d5_hi_tit",
          dove: ["d5_hi_dove", "d5_hi_dove2"],
          parrotbill: "d5_hi_parrotbill",
        }, hint: "d5_say_hello" },
        { moment: "sleepInRow", birds: D5_PARROTBILLS, at: { ...D5_BUSH, dy: -8 }, sortAfter: D5_BUSH, gap: 8 },
        "d5_sleep",
        { learn: ["sleep"] },
      ],
    },
  ],

  night: {
    lookUp: "d1_look_up",
    lines: ["new_stars", { look: "@bridge", say: "d5_stars" }],
    hook: [
      { moment: "crowFeather", lines: { seen: "d5_feather", say: "d5_crow" } },
      "d5_tomorrow",
    ],
    card: "theEnd",
    chapterEnd: true,
  },
};
}
