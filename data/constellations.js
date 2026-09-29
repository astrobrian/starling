
window.CONSTELLATIONS = [
  {
    id: "bird", name: "The Little Bird", korean: "작은 새자리", at: [0.05, 0.2], size: [88, 54],
    points: [[0.94, 0.4], [0.74, 0.3], [0.46, 0], [0.42, 0.46], [0, 0.3], [0.58, 0.82], [0.22, 0.1]],
    lines: [[0, 1], [1, 3], [3, 4], [3, 2], [1, 5], [5, 4], [3, 6], [6, 2]],
    words: ["star", "look", "up", "follow", "tree", "friend", "bird"],
  },
  {
    id: "persimmon", name: "The Persimmon", korean: "감자리", at: [0.09, 0.78], size: [56, 52],
    paths: [
      { loop: true, points: skyCircle(0.5, 0.6, 0.45, 0.38, 10) },
      { points: [[0.24, 0.08], [0.5, 0], [0.76, 0.08]] },
    ],
    words: ["hungry", "berry", "persimmon", "plum", "feeder", "crackers", "candy", "eat", "seed", "rice", "bread", "drink", "sweet"],
  },
  {
    id: "house", name: "The House", korean: "집자리", at: [0.13, 0.2], size: [52, 46],
    paths: [
      { loop: true, points: [[0.5, 0.05], [0.9, 0.45], [0.9, 1], [0.1, 1], [0.1, 0.45]] },
      { points: [[0.66, 0.28], [0.66, 0.05], [0.8, 0.05], [0.8, 0.36]] },
    ],
    words: ["morning", "house", "door", "window", "roof", "desk", "cup"],
  },
  {
    id: "flower", name: "The Flower", korean: "꽃자리", at: [0.17, 0.78], size: [54, 58],
    points: [[0.5, 0.36], [0.5, 0.04], [0.8, 0.26], [0.69, 0.62], [0.31, 0.62], [0.2, 0.26], [0.5, 0.8], [0.26, 0.88], [0.74, 0.84], [0.5, 1]],
    lines: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [6, 7], [6, 8], [6, 9]],
    words: ["flower", "red", "yellow", "pink", "white", "gold", "green", "black", "colorful", "pattern"],
  },
  {
    id: "shoe", name: "The Little Shoe", korean: "꼬까신자리", at: [0.215, 0.2], size: [64, 38],
    paths: [{ loop: true, points: [[0, 0.1], [0.38, 0.1], [0.44, 0.45], [0.82, 0.58], [1, 0.82], [0.94, 1], [0.02, 1]] }],
    words: ["lost", "find", "want", "save", "give", "share", "sing", "dance", "jump", "run", "sleep", "walk", "climb"],
  },

  {
    id: "duck", name: "The Duck", korean: "오리자리", at: [0.25, 0.78], size: [62, 44],
    paths: [{ loop: true, points: [[0.82, 0.18], [1, 0.26], [0.84, 0.34], [0.74, 0.52], [1, 0.66], [0.82, 1], [0.16, 1], [0, 0.66], [0.3, 0.62], [0.64, 0.52], [0.66, 0.26]] }],
    words: ["river", "duck", "swim", "wet", "stone", "bridge", "dive", "rock", "slippery", "across", "water", "bath"],
  },
  {
    id: "umbrella", name: "The Umbrella", korean: "우산자리", at: [0.385, 0.2], size: [56, 50],
    paths: [
      { points: skyArc(0.5, 0.5, 0.5, 0.46, Math.PI, 2 * Math.PI, 7) },
      { points: [[0.5, 0.5], [0.5, 0.95], [0.38, 1], [0.3, 0.9]] },
    ],
    words: ["sky", "rain", "cloud", "umbrella", "wind", "weather", "hot", "warm", "snow"],
  },
  {
    id: "heart", name: "The Heart", korean: "하트자리", at: [0.335, 0.78], size: [54, 48],
    paths: [{ loop: true, points: skyHeart(16) }],
    words: ["happy", "shy", "scared", "brave", "sad", "angry", "tired", "surprised", "calm", "feel", "smile", "love", "kind"],
  },
  {
    id: "fish", name: "The Fish", korean: "물고기자리", at: [0.3, 0.2], size: [62, 36],
    paths: [{ loop: true, points: [[1, 0.5], [0.82, 0.12], [0.5, 0], [0.2, 0.2], [0, 0], [0.06, 0.5], [0, 1], [0.2, 0.8], [0.5, 1], [0.82, 0.88]] }],
    words: ["fish", "wait", "hide", "quiet", "catch", "long", "fast", "slow", "still", "seek"],
  },

  {
    id: "swan", name: "The Swan", korean: "백조자리", at: [0.5, 0.2], size: [66, 70], real: true,
    points: [[0.5, 0], [0.5, 0.3], [0.5, 0.6], [0.5, 0.8], [0.5, 1], [0.1, 0.16], [0.3, 0.24], [0.7, 0.24], [0.9, 0.16]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 1], [1, 7], [7, 8]],
    words: ["tail", "wing", "neck", "leg", "beak", "feather", "fly", "spread", "nest"],
    bright: ["tail"],          // Deneb
  },
  {
    id: "bridge", name: "The Bridge", korean: "오작교자리", at: [0.6, 0.78], size: [96, 30],
    paths: [{ points: skyArc(0.5, 1, 0.5, 0.9, Math.PI, 2 * Math.PI, 15) }],
    words: ["gather", "flock", "crow", "wish", "hope", "promise", "strong", "everyone", "message", "forest", "trail", "forever", "understand", "end", "beginning"],
  },

  {
    id: "compass", name: "The Compass", korean: "나침반자리", at: [0.615, 0.2], size: [58, 58],
    paths: [
      { loop: true, points: skyCircle(0.5, 0.5, 0.32, 0.32, 8) },
      { points: [[0.5, 0], [0.5, 0.18]] }, { points: [[1, 0.5], [0.82, 0.5]] },
      { points: [[0.5, 1], [0.5, 0.82]] }, { points: [[0, 0.5], [0.18, 0.5]] },
      { points: [[0.5, 0.5], [0.5, 0.5]] },
    ],
    words: ["where", "left", "right", "down", "straight", "path", "sign", "map", "near", "far", "turn", "under", "behind", "next to", "in front of", "between", "around"],
  },
  {
    id: "acorn", name: "The Acorn", korean: "도토리자리", at: [0.695, 0.185], size: [46, 56],
    paths: [
      { points: skyArc(0.5, 0.42, 0.5, 0.3, Math.PI, 2 * Math.PI, 7) },
      { points: [[0, 0.42], [1, 0.42]] },
      { points: [[0, 0.42], [0.12, 0.72], [0.5, 1], [0.88, 0.72], [1, 0.42]] },
      { points: [[0.5, 0.12], [0.72, 0]] },
    ],
    words: ["empty", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "count", "number", "some", "many", "full", "small", "big"],
  },
  {
    id: "clock", name: "The Moon Clock", korean: "달시계자리", at: [0.775, 0.2], size: [52, 52],
    paths: [
      { loop: true, points: skyCircle(0.5, 0.5, 0.5, 0.5, 12) },
      { points: [[0.5, 0.2], [0.5, 0.5], [0.72, 0.62]] },
    ],
    words: ["noon", "evening", "early", "late", "today", "before", "after", "midnight", "once", "year"],
  },
  {
    id: "owl", name: "The Owl", korean: "부엉이자리", at: [0.855, 0.2], size: [50, 56],
    paths: [
      { loop: true, points: [[0.12, 0], [0.3, 0.2], [0.7, 0.2], [0.88, 0], [0.96, 0.5], [0.8, 0.92], [0.5, 1], [0.2, 0.92], [0.04, 0.5]] },
      { loop: true, points: skyCircle(0.32, 0.45, 0.13, 0.13, 4) },
      { loop: true, points: skyCircle(0.68, 0.45, 0.13, 0.13, 4) },
    ],
    words: ["dark", "light", "glow", "firefly", "owl", "dream", "listen", "sound", "shadow", "moon", "round", "bright"],
  },

  {
    id: "nest", name: "The Nest", korean: "둥지자리", at: [0.415, 0.78], size: [60, 36],
    paths: [
      { points: skyArc(0.5, 0.35, 0.5, 0.65, 0, Math.PI, 7) },
      { points: skyArc(0.3, 0.35, 0.12, 0.18, Math.PI, 2 * Math.PI, 3) },
      { points: skyArc(0.7, 0.35, 0.12, 0.18, Math.PI, 2 * Math.PI, 3) },
    ],
    words: ["mom", "baby", "family", "father", "mother", "brother", "sister", "grandma", "grandpa", "together"],
  },
  {
    id: "seasons", name: "The Tree of Seasons", korean: "사계절 나무자리", at: [0.695, 0.78], size: [46, 58],
    paths: [
      { loop: true, points: skyCircle(0.5, 0.36, 0.48, 0.36, 6) },
      { points: [[0.5, 0.72], [0.5, 1]] },
    ],
    words: ["season", "spring", "summer", "fall", "winter", "leaf", "bush", "grow", "change"],
  },
  {
    id: "gourd", name: "The Gourd", korean: "박자리", at: [0.745, 0.78], size: [48, 60],
    paths: [
      { loop: true, points: [[0.5, 0.1], [0.72, 0.2], [0.7, 0.42], [0.96, 0.62], [0.9, 0.9], [0.5, 1], [0.1, 0.9], [0.04, 0.62], [0.3, 0.42], [0.28, 0.2]] },
      { points: [[0.5, 0.1], [0.62, 0]] },
    ],
    words: ["excuse me", "welcome", "you're welcome", "may I", "of course", "nice to meet you", "good night", "see you soon", "help", "hurt", "careful", "gentle", "heal", "better", "doctor", "gift", "surprise", "treasure"],
  },
  {
    id: "rice", name: "The Rice Sheaf", korean: "볏단자리", at: [0.815, 0.78], size: [46, 58],
    paths: [
      { points: [[0.5, 1], [0.5, 0.5], [0.5, 0]] },
      { points: [[0.5, 0.5], [0.2, 0.1], [0, 0.25]] },
      { points: [[0.5, 0.5], [0.8, 0.1], [1, 0.25]] },
      { points: [[0.3, 1], [0.5, 0.62], [0.7, 1]] },
    ],
    words: ["village", "field", "paddy", "farmer", "eaves", "mud", "build", "work", "busy", "plant", "dig", "soil", "sprout", "gourd"],
  },

  {
    id: "telescope", name: "The Telescope", korean: "망원경자리", at: [0.88, 0.78], size: [60, 50],
    paths: [
      { points: [[0.02, 0.66], [0.84, 0.12]] },
      { points: [[0.74, 0], [0.98, 0.26]] },
      { points: [[0.4, 0.42], [0.2, 1]] }, { points: [[0.4, 0.42], [0.62, 1]] },
    ],
    words: ["telescope", "observatory", "planet", "space", "lens", "huge", "tiny", "star map", "shine", "twinkle", "dim", "galaxy", "constellation", "point", "name"],
  },
  {
    id: "loom", name: "The Loom", korean: "베틀자리", at: [0.965, 0.78], size: [52, 46],
    paths: [
      { loop: true, points: [[0, 0], [1, 0], [1, 1], [0, 1]] },
      { points: [[0.34, 0], [0.34, 1]] }, { points: [[0.67, 0], [0.67, 1]] },
    ],
    words: ["story", "weaver", "weave", "cloth", "cowherd", "cow", "apart", "meet", "wonder", "curious"],
  },
  {
    id: "lantern", name: "The Lantern", korean: "등불자리", at: [0.935, 0.2], size: [40, 58],
    paths: [
      { loop: true, points: [[0.5, 0.14], [0.9, 0.3], [1, 0.58], [0.84, 0.86], [0.5, 0.92], [0.16, 0.86], [0, 0.58], [0.1, 0.3]] },
      { points: [[0.36, 0.2], [0.5, 0], [0.64, 0.2]] }, { points: [[0.5, 0.92], [0.5, 1]] },
    ],
    words: ["ready", "lantern", "invite", "party", "decorate", "wear", "dress", "music", "drum"],
  },
];

window.SKY_STARS = [
  { id: "vega", name: "the Weaver", korean: "직녀별", at: [0.545, 0.46] },
  { id: "altair", name: "the Cowherd", korean: "견우별", at: [0.455, 0.54] },
];
window.MILKY_WAY = { x: 0.5, width: 0.07 };

function skyCircle(cx, cy, rx, ry, n) {
  return Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
}
function skyArc(cx, cy, rx, ry, a0, a1, n) {
  return Array.from({ length: n }, (_, i) => { const a = a0 + ((a1 - a0) * i) / (n - 1); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
}
function skyHeart(n) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [0.5 + x / 34, 0.45 - y / 34];
  });
}
function skyFlower(cx, cy, r, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2, k = 0.55 + 0.45 * Math.abs(Math.cos((5 / 2) * (a + Math.PI / 2)));
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  });
}
