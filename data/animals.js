
window.ANIMALS = {

  fox: {
    name: "fox", fullName: "red fox", korean: "여우", plan: "quad", size: [26, 20],
    headR: 5.8, bodyRx: 5.2, bodyRy: 3.6, legLen: 2.5, legW: 2,
    body: "#E58B4F", belly: "cream", chest: "cream", cheek: "cream",
    muzzle: "cream", muzzleTop: "#E58B4F", muzzleLen: 2.6, nose: "ink",
    legs: "#6B4436",
    ears: { shape: "pointed", size: 4.6, color: "#6B4436", inner: "cream" },
    tail: { shape: "brush", length: 10, width: 3.4, color: "#E58B4F", tip: "cream", up: 0.75 },
    chirp: "yip", chirpPitch: 900, walkSpeed: 16, gait: "walk",
    habits: ["sit", "look", "sniff"], shy: true, shadow: [7, 1.5],
  },

  raccoonDog: {
    name: "raccoon", fullName: "raccoon dog", korean: "너구리", plan: "quad", size: [24, 18],
    headR: 4.8, bodyRx: 6.3, bodyRy: 4.4, legLen: 2.3, legW: 2,
    body: "#AE9A82", head: "#DCCDB6", belly: "#C2B29C", chest: "#6E5E5A",
    cheek: "#E9E0D0", mask: "#7C6A68", brow: "#EFE7DA", eyes: "ink",
    muzzle: "#E9E0D0", muzzleLen: 2.4, nose: "ink",
    legs: "#5B4C4E", saddle: "#7E6C66", grizzle: ["#CDBDA5", "#86735F"],
    ears: { shape: "round", size: 2, color: "#7E6C66", inner: "#DCCDB6" },
    tail: { shape: "bushy", length: 5.5, width: 2.8, color: "#9C876F", top: "#5F5055", up: 0.05 },
    chirp: "whine", chirpPitch: 700, walkSpeed: 12, gait: "walk",
    habits: ["sniff", "sit", "look"], shy: true, shadow: [7, 1.5],
  },

  hedgehog: {
    name: "hedgehog", fullName: "Amur hedgehog", korean: "고슴도치", plan: "quad", size: [18, 12],
    poses: ["curl"],
    headR: 3.2, bodyRx: 4.6, bodyRy: 3.1, legLen: 1.2, legW: 1.6, headAt: [0.95, -0.4],
    body: "#B89A80", head: "#EEE0CB", belly: "#E3D0B6", cheek: "#F6EEE2",
    muzzle: "#ECDCC4", muzzleLen: 2.6, nose: "ink",
    legs: "#A88A74",
    ears: { shape: "round", size: 1.3, color: "#D9C1A6" },
    spines: { color: "#92735C", tip: "#E6D2B2", band: "#634E42" },
    chirp: "snuffle", chirpPitch: 500, walkSpeed: 7, gait: "walk",
    habits: ["sniff", "curl"], shy: true, shadow: [5, 1],
  },

  treeFrog: {
    name: "frog", fullName: "tree frog", korean: "청개구리", plan: "frog", size: [12, 10],
    frogSize: 1.12, body: "#9CD06A", belly: "cream", stripe: "#6E6558", pads: "#D0EBA4", sac: "#F1E7A2",
    chirp: "ribbit", chirpPitch: 1800, walkSpeed: 10, gait: "hop",
    habits: ["sing"], shadow: [3, 1],
  },

  softshell: {
    name: "turtle", fullName: "soft-shelled turtle", korean: "자라", plan: "turtle", size: [22, 10],
    shell: "#7F9460", rim: "#C9CEA6", skin: "#B2AE97", belly: "#EDE3CB", spots: "#66744F",
    snoutLen: 1.2, neckLen: 3,
    chirp: "squeak", chirpPitch: 600, walkSpeed: 6, gait: "walk", swims: true,
    habits: ["bask", "tuck"], shy: true, shadow: [7, 1.2],
  },

  rhinoBeetle: {
    name: "beetle", fullName: "rhinoceros beetle", korean: "장수풍뎅이", plan: "beetle", size: [16, 12],
    body: "#A0603F", gloss: "#E3A983", legs: "#6E4131", wingsOpen: "#E6E0EE",
    horn: { length: 7, fork: true },
    chirp: "chip", chirpPitch: 1200, walkSpeed: 5, gait: "walk", flies: true,
    shadow: [4, 1],
  },

  moonMoth: {
    name: "moth", fullName: "moon moth", korean: "긴꼬리산누에나방", plan: "flier", size: [18, 20],
    wings: "#CBE9B6", edge: "#B67FB0", hind: "#C2E4AE", spot: ["#F3D98A", "#B87696"],
    tails: 4, span: 0.9, body: "snow", antennae: "#D8BE8C",
    chirp: "flutter", chirpPitch: 2400, flies: true, flapRate: 12,
    shadow: [3, 1],
  },
};
