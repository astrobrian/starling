
{ // (this day's own names stay inside: see day1.js)
window.DAYS = window.DAYS || {};

DAYS[1] = {
  chapter: 1,
  weather: "sunny",

  wakeUp: "magpie",

  skipEvening: false,

  morning: [
    "d1_window",
    "d1_window_again",
  ],

  out: [{ outside: { alone: true } }],

  favors: [
    {
      id: "star",
      understand: true,          // once it's done, the magpie's chirps are words (before: only chirps)
      steps: [
        { moment: "fallenStar", patch: 0 },
        { say: "d1_star", learn: ["star"] },
        { scene: [{ wait: 0.4 }, { hold: null }, { emote: "sparkles", on: "her" }, { sound: "twinkle" }, { wait: 0.4 }] },
      ],
    },

    {
      id: "hello",
      steps: [
        { scene: [{ magpie: "follow" }, { wait: 0.5 }, { emote: "sparkles" }] },
        { act: "flap", on: "magpie", seconds: 2.4, wait: false },
        { say: "d1_bird", replies: {
          "?": [{ act: "flap", on: "magpie", seconds: 2, wait: false }, "d1_bird_me"],
        } },
        { learn: ["bird"] },
      ],
    },

    {
      id: "berry",
      noon: true,
      steps: [
        { moment: "tummy" },
        "d1_berry",
        { give: "berry", to: "magpie", from: "berryBush", emote: "sparkles", thought: "berry", hint: "d1_berry" },
        { scene: [{ magpie: "joy" }, { emote: "heart" }, { sound: "hearts" }, { wait: 0.6 }] },
        { say: "d1_yum", learn: ["hungry", "berry"] },
      ],
    },

    {
      id: "tree",
      birds: [
        { id: "sparrow", species: "sparrow", at: SPOTS.sparrowBranch, does: "perch", sortAfter: "bigTree", faceLeft: false },
      ],
      world: { after: [{ today: true, birds: [
        { id: "sparrow", species: "sparrow", at: SPOTS.sparrowBranch, does: "perch", sortAfter: "bigTree", faceLeft: false },
      ] }] },
      steps: [
        { near: "bigTree", reach: 3.2, lead: "d1_follow",
          magpie: { perch: { thing: "bigTree", dx: 16, dy: -30 }, sortAfter: "bigTree" },
          tapWalks: ["sparrow", "magpie"], intoView: true, front: true },
        { learn: ["follow", "tree"] },
        { wait: 0.4 },
        { scene: [{ magpie: "follow" }, { wait: 0.6 }, { emote: "heart" }, { moment: "tummy", on: "sparrow" }, { wait: 0.4 }] },     // (its tummy rumbles, like the magpie's)
        "d1_hello_sparrow",
        { moment: "chirpDuet", bird: "sparrow" },
        "d1_sparrow",
        "d1_like_me",
        { moment: "bushPoke", bush: "berryBush", near: "bigTree" },
        "d1_ouch",
        { magpie: "follow" },
        { give: "berry", to: { bird: "sparrow" }, from: "berryBush", emote: "sparkles", thought: "berry", hint: "d1_sparrow" },
        { moment: "birdEats", bird: "sparrow", item: "berry", pecks: 3, cheer: true, lines: { during: "d1_eat" } },
        "d1_sparrow_yum",
        { learn: ["eat"] },
        { friend: "sparrow" },
      ],
    },

    {
      id: "friends",
      steps: [
        { moment: "hearts", on: ["sparrow", "her", "magpie"] },
        { scene: [{ magpie: "head" }, { wait: 0.6 }] },
        { say: "d1_friends", replies: { "Hello!": "d1_friend_again" } },
        { learn: ["friend"] },
        { friend: "magpie", quiet: true },
        { wait: 0.6 },
        { moment: "nameTheMagpie", lines: { named: "d1_named" } },
        { magpie: "follow" },
      ],
    },
  ],

  night: {
    lookUp: "d1_look_up",
    learn: ["look", "up"],
    lines: ["new_stars", { look: "@bridge", say: "d1_bird_star" }, "d1_tomorrow"],
    card: "theEnd",
  },
};
}
