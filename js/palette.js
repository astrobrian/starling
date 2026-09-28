
const PLUM = "#5A5270";   // shared by shadows, outlines and eyes
const CREAM = "#FFF8EA";  // what highlights lean toward

const BASE_COLORS = {
  nightIndigo: "#1B2140",
  starlight: "#FFE9A8",
  duskLavender: "#8E95B5",
  meadowGreen: "#7FB77E",
  petalPink: "#F4A6B8",
  beeYellow: "#F7D154",

  plum: PLUM,
  cream: CREAM,
  grass: "#A3D196",
  path: "#EAD7AC",
  pond: "#9BCFE6",
  bark: "#AE7F62",
  roof: "#E9979B",
  wall: "#FBEFD9",
  leaf: "#6FA970",
  berry: "#8A70D6",
  skin: "#FFE1CC",
  hair: "#6B4A42",        // warm brown
  hairDark: "#403544",    // soft black
  hairChestnut: "#94604E",
  hairHoney: "#C9975F",
  ink: "#3B354F",     // "black" feathers: a very dark plum-navy
  snow: "#F6F3FA",    // white feathers: a touch of lavender
  sheen: "#4FA6A2",   // blue-green gloss on magpie tails and wings
  blush: "#F7A1B0",

  coral: "#F28A86",       // "red" flowers, ladybugs, mushroom caps
  lilac: "#B7A2E0",       // "purple" flowers
  butter: "#FBE48E",      // "yellow" flowers
  peach: "#F7B98B",       // "orange" flowers
  magenta: "#E283B5",     // deep pink cosmos
  sunflower: "#F6C445",
  seed: "#8C5B3F",        // sunflower centers
  scarlet: "#E4525C",     // a true red (빨강), for zinnias, balsams and moss roses: redder and deeper than coral

  stone: "#C9C3D3",       // rocks, stepping stones, bird bath
  wood: "#C99A70",        // fence, bench, posts
  clay: "#D98E6E",        // flower pots
  onggi: "#8E5D4A",       // 장독대 jars
  persimmon: "#F2994A",
  leafGold: "#A4BE66",    // persimmon leaves
  reed: "#9DB86A",
  willow: "#A8D27E",      // fresh willow green

  chestnut: "#B06A4F",    // sparrow cap, bulbul ear, grebe cheeks, mallard breast
  kingfisher: "#46A9CF",  // kingfisher back
  mallard: "#3F8E6D",     // mallard drake's glossy green head
  speculum: "#5B73C8",    // the blue patch on a duck's wing
  duckBrown: "#9A765F",   // mallard hen, spot-billed duck
  heronGrey: "#A7ABBF",   // grey heron, bulbul
  dove: "#B7A69C",        // turtle dove head and body
  doveBreast: "#DDB9B0",  // turtle dove's pinkish breast
  parrotbill: "#CC9582",  // vinous-throated parrotbill
  owl: "#A39284",         // scops owl
  hedge: "#5E9A66",
  woodpeckerRed: "#D9606B", // the great spotted woodpecker's red nape and under its tail
  nuthatch: "#8C9DC4",    // the nuthatch's blue-grey back
  nuthatchBuff: "#E9A873", // its orange-buff flanks
  jay: "#B3A3A3",         // the Korean jay's grey back, a touch of pink
  jayHead: "#C98C64",     // its rufous head
  jayBlue: "#5A8FDB",     // the barred blue patch on its wing
  crowGloss: "#6563A0",   // the purple-blue sheen on a crow's black
  pheasantGreen: "#3F7478", // the cock pheasant's glossy green-blue head
  pheasantCopper: "#C77B45", // his coppery breast and flanks
  pheasantTail: "#CDB07A", // his long buff tail (barred dark)
  pheasantRump: "#A9B5A3", // his grey-green rump
  pheasantHen: "#C6A67F", // the hen pheasant, sandy brown
  swallowBlue: "#39447A", // the swallow's glossy steel blue
  swallowRed: "#C45A4B",  // its brick-red forehead and throat
  nightjar: "#A1928A",    // the nightjar, grey-brown like bark
  nightjarDark: "#6E6059", // its dark mottling

  giwa: "#6F7B9E",        // slate blue
  celadon: "#86ADA5",     // soft celadon green
  roseTile: "#AD8C98",    // dusty rose
  thatch: "#D9AE66",      // golden straw (the cottage roof)
  navy: "#465A92",        // his oxford button-down shirt
  slacks: "#8F8C99",      // his grey pants

  lamplight: "#FFD98C",

  night1: "#212852",
  night2: "#283063",
  night3: "#303A73",
  starFaint: "#4A5287",
  starBand: "#5A6199",
  starBright: "#C9C3E6",
  starLine: "#60678F",
  nightTrees: "#18233A",
  daySky0: "#8CC4EA",
  daySky1: "#A2D0EF",
  daySky2: "#B9DCF3",
  daySky3: "#D2E9F6",
  firefly: "#E9F59A",
  fireflyBright: "#FBFFD0",
  dawnGlass: "#FBE3C2",
  dawnGlass2: "#D6E6F2",
  noonGlass: "#BCDDF3",
  noonGlass2: "#E2F0F9",
  duskGlass: "#F3B7A6",
  duskGlass2: "#FAD6BA",
  nightGlass: "#28305A",
  nightGlass2: "#394272",
  nightLeaves: "#2A3A52",
  duskLeaves: "#9A8A86",

  skyBlue: "#8CC6EE",     // SkyFlower the triceratops

  floorWood: "#D9B690",   // the wooden floor
  wallpaper: "#F4E6DC",   // soft cream-pink wallpaper

  forest: "#4E8A66",
  pine: "#4F8F74",
  pineBark: "#B8735A",
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return "#" + c(r) + c(g) + c(b);
}

function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}

function scaleColor(c, k) {
  return rgbToHex(hexToRgb(c).map((v) => v * k));
}

function lightness(c) {
  const [r, g, b] = hexToRgb(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const PLUM_LIGHTNESS = lightness(PLUM);

function darken(c, amount) {
  if (lightness(c) > PLUM_LIGHTNESS + 0.05) return mix(c, PLUM, amount);
  return scaleColor(c, 1 - amount * 0.55);
}

function toHsv(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max ? d / max : 0, max];
}
function fromHsv(h, s, v) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); v = Math.max(0, Math.min(1, v));
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return rgbToHex([f(5) * 255, f(3) * 255, f(1) * 255]);
}
function towardHue(h, target, deg) {
  const d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), deg);
}
const SHADE_HUE = 250, LIGHT_HUE = 50;     // plum's hue (shade leans toward it); sunlight (highlights do)

function hueRamp(base, soft = false) {
  const [h, s, v] = toHsv(base);
  const colorful = Math.min(1, s / 0.2);
  const warm = h < 60 || h > 330 ? 0.55 : 1;
  const boost = (k, add) => (soft ? Math.min(1, s * (1 + (k - 1) * 0.3)) : Math.min(1, s * k + add));
  return [
    fromHsv(towardHue(h, LIGHT_HUE, 6 * colorful), s * 0.66, Math.min(1, v * 1.05 + 0.02)),    // 0 highlight
    base,                                                                                        // 1 base
    fromHsv(towardHue(h, SHADE_HUE, 13 * colorful * warm), boost(1.1, 0.02), v * 0.85),           // 2 shade
    fromHsv(towardHue(h, SHADE_HUE, 26 * colorful * warm), boost(1.16, 0.04), v * 0.71),          // 3 deep shade
  ];
}

function inkRamp(base) {
  return [mix(base, BASE_COLORS.duskLavender, 0.3), base, darken(base, 0.25), darken(base, 0.48)];
}

function ramp(base) {
  return lightness(base) < 0.3 ? inkRamp(base) : hueRamp(base);
}

const LIGHT_COLORS = ["starlight", "duskLavender", "lamplight", "firefly", "fireflyBright", "starBright",
  "daySky0", "daySky1", "daySky2", "daySky3", "dawnGlass", "dawnGlass2", "noonGlass", "noonGlass2", "duskGlass", "duskGlass2"];
function lightRamp(base) {
  return [mix(base, CREAM, 0.35), base, darken(base, 0.25), darken(base, 0.48)];
}

function outlineColor(c) {
  if (lightness(c) < 0.3) return scaleColor(c, 1 - 0.68 * 0.55);
  const [h, s, v] = toHsv(c);
  const colorful = Math.min(1, s / 0.2);
  const deep = fromHsv(towardHue(h, SHADE_HUE, 30 * colorful), Math.min(0.55, s * 1.1 + 0.08), Math.max(0.26, v * 0.5));
  return mix(deep, PLUM, 0.4);
}

const PALETTE = {};
const RAMPS = {};
for (const [name, hex] of Object.entries(BASE_COLORS)) {
  PALETTE[name] = hex;
  RAMPS[name] = LIGHT_COLORS.includes(name) ? lightRamp(hex) : ramp(hex);
}

RAMPS.skin = ["#FFF1E4", "#FFE1CC", "#F6C4B2", "#E8A89C"];
RAMPS.snow = ["#FFFFFF", "#F6F3FA", "#E2DDEC", "#C8C2D8"];
RAMPS.cream = ["#FFFFFF", "#FFF8EA", "#F1E3CF", "#DCC8B4"];
RAMPS.hair[0] = "#8E6452";
RAMPS.skyBlue = hueRamp(BASE_COLORS.skyBlue, true);    // SkyFlower's frill stays sky blue in shade

const SHADOW = "rgba(90, 82, 112, 0.28)";

const extraRamps = {};
function rampFor(nameOrHex) {
  if (typeof nameOrHex !== "string") return null;
  if (nameOrHex in RAMPS) return RAMPS[nameOrHex];
  if (/^#[0-9a-fA-F]{6}$/.test(nameOrHex)) return (extraRamps[nameOrHex] ||= ramp(nameOrHex));
  return null;
}

function paletteColor(nameOrHex) {
  if (nameOrHex in PALETTE) return PALETTE[nameOrHex];
  return nameOrHex;
}
